import { ai } from './ai.ts'
import { tagged } from './costs.ts'
import { isDemo } from './demo.ts'
import { DEFAULT_LOCALE, defineMessages, Language, type Locale, translator } from './i18n.ts'
import { aroundModel } from './plugins.ts'
import type { TitleProgress } from './psn.ts'
import { type Game, gameByName, gamesForTitles, getGame } from './repository/game.ts'
import { getGuide } from './repository/guide.ts'
import { listInterests } from './repository/interest.ts'
import {
  type DismissReason,
  dismiss,
  listDismissed,
  listRecommendations,
  type RecommendationRow,
  replaceRecommendations,
  seenGames,
} from './repository/recommendation.ts'
import { type User, updateUser } from './repository/user.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    none: 'Ainda não tenho recomendações. Tenta de novo em 1 minuto.',
    profile: 'Seu perfil: {summary}',
    genres: 'Gêneros: {genres}',
    title: 'Próximas platinas pro seu gosto:',
    hasMissables: ', tem missables',
  },
  [Language.En]: {
    none: "I don't have recommendations yet. Try again in a minute.",
    profile: 'Your profile: {summary}',
    genres: 'Genres: {genres}',
    title: 'Next platinums for your taste:',
    hasMissables: ', has missables',
  },
})

const CACHE_DAYS = 7
// A game shown as a recommendation stays out of new batches while there are unseen candidates; the
// marks are kept this long.
export const SEEN_KEEP_DAYS = 365

export interface TasteProfile {
  summary: string
  genres: string[]
  traits: string[]
  avoid: string[]
}

/** The profile's lists the player can change. */
export const TASTE_LISTS = ['genres', 'traits', 'avoid'] as const
export type TasteList = (typeof TASTE_LISTS)[number]
type Lists = Record<TasteList, string[]>

/** Rules every recommendation follows, checked against the guides we have. */
export interface RecFilters {
  noMissables?: boolean
  onePlaythrough?: boolean
  noDifficultyTrophy?: boolean
  noOnline?: boolean
  maxHours?: number | null
  maxDifficulty?: number | null
}

/** The player's changes to the model's profile, kept when it writes the profile again, and their
 * rules. */
export interface TastePrefs {
  added: Lists
  removed: Lists
  filters: RecFilters
}

const emptyLists = (): Lists => ({ genres: [], traits: [], avoid: [] })
export const emptyPrefs = (): TastePrefs => ({
  added: emptyLists(),
  removed: emptyLists(),
  filters: {},
})

const MAX_ITEMS = 8
const MAX_TEXT = 40
const FLAGS = ['noMissables', 'onePlaythrough', 'noDifficultyTrophy', 'noOnline'] as const

/** Stored or sent preferences, kept to what is valid: short texts, a few per list, sane numbers.
 * Null when the shape is wrong. */
export function readPrefs(raw: unknown): TastePrefs | null {
  if (raw == null) return emptyPrefs()
  if (typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const lists = (value: unknown): Lists | null => {
    const v = (value ?? {}) as Record<string, unknown>
    if (typeof v !== 'object') return null
    const out = emptyLists()
    for (const key of TASTE_LISTS) {
      const items = v[key] ?? []
      if (!Array.isArray(items)) return null
      const seen = new Set<string>()
      out[key] = items
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim().slice(0, MAX_TEXT))
        .filter((x) => {
          const k = x.toLocaleLowerCase()
          if (!x || seen.has(k)) return false
          seen.add(k)
          return true
        })
        .slice(0, MAX_ITEMS)
    }
    return out
  }
  const added = lists(r.added)
  const removed = lists(r.removed)
  if (!added || !removed) return null
  const f = (r.filters ?? {}) as Record<string, unknown>
  const filters: RecFilters = {}
  for (const flag of FLAGS) if (f[flag] === true) filters[flag] = true
  const bounded = (value: unknown, lo: number, hi: number) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(hi, Math.max(lo, Math.round(value)))
      : null
  const hours = bounded(f.maxHours, 1, 500)
  const difficulty = bounded(f.maxDifficulty, 1, 10)
  if (hours) filters.maxHours = hours
  if (difficulty) filters.maxDifficulty = difficulty
  return { added, removed, filters }
}

/** The profile the player sees: the model's, without what they removed and with what they added. */
export function effectiveProfile(
  profile: TasteProfile | null,
  prefs: TastePrefs,
): TasteProfile | null {
  const anyAdded = TASTE_LISTS.some((k) => prefs.added[k].length)
  if (!profile && !anyAdded) return null
  const base = profile ?? { summary: '', genres: [], traits: [], avoid: [] }
  const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase()
  const merged = (key: TasteList) => {
    const kept = (base[key] ?? []).filter((x) => !prefs.removed[key].some((r) => same(r, x)))
    return [...kept, ...prefs.added[key].filter((x) => !kept.some((k) => same(k, x)))]
  }
  return {
    summary: base.summary,
    genres: merged('genres'),
    traits: merged('traits'),
    avoid: merged('avoid'),
  }
}

export interface Recommendation {
  game: Game
  platform: string
  difficulty: number
  hours: number
  playthroughs: number | null
  hasDifficultyTrophy: boolean | null
  why: string
  hasMissables: boolean
  similarTo: string[]
}

export interface Recommendations {
  /** The model's profile with the player's changes applied. */
  profile: TasteProfile | null
  /** The model's profile as it wrote it, so the page can preview changes before saving them. */
  baseProfile?: TasteProfile | null
  prefs: TastePrefs
  items: Recommendation[]
  generatedAt: string | null
  /** No library to learn a taste from: nothing was searched. */
  reason?: 'no-library'
}

// What the service answers: the profile and the picks, each tied to the candidate
// it names (null when the model strayed from the list).
interface Researched {
  profile: TasteProfile
  items: {
    name: string
    platform: string
    difficulty: number
    hours: number
    playthroughs: number | null
    hasDifficultyTrophy: boolean | null
    why: string
    hasMissables: boolean
    game: string | null
    similarTo: string[]
  }[]
}

const toView = async (r: RecommendationRow): Promise<Recommendation> => {
  const guide =
    r.playthroughs == null || r.has_difficulty_trophy == null
      ? await getGuide<{ playthroughs?: number; difficultyTrophy?: string | null }>(r.game.id)
      : undefined
  const runs = r.playthroughs ?? guide?.playthroughs
  return {
    game: r.game,
    platform: r.platform,
    difficulty: r.difficulty,
    hours: r.hours,
    playthroughs: Number.isInteger(runs) && Number(runs) > 0 ? Number(runs) : null,
    hasDifficultyTrophy:
      r.has_difficulty_trophy ??
      (guide?.difficultyTrophy !== undefined ? Boolean(guide.difficultyTrophy) : null),
    why: r.why,
    hasMissables: r.has_missables,
    similarTo: r.similar_to ?? [],
  }
}

// Suggests platinums the player does not own, based on what they finished and are
// playing. Results are resolved to catalog games, so "already owned" and "dismissed"
// are id comparisons.
export async function recommendations(
  user: User,
  library: TitleProgress[],
  accountGames: Game[],
  force = false,
  /** Only what is stored, never a new batch: answering a change of preferences. */
  storedOnly = false,
): Promise<Recommendations> {
  const prefs = readPrefs(user.taste_prefs) ?? emptyPrefs()
  const current = await listRecommendations(user.id)
  const generatedAt = current[0]?.generated_at ?? null
  const fresh =
    generatedAt && Date.now() - new Date(generatedAt).getTime() < CACHE_DAYS * 86_400_000
  // The demo player keeps the stored batch, however old: a new one would call the model.
  if (isDemo(user) || storedOnly || (current.length && fresh && !force)) {
    return {
      profile: effectiveProfile((user.taste_profile as TasteProfile | null) ?? null, prefs),
      baseProfile: (user.taste_profile as TasteProfile | null) ?? null,
      prefs,
      items: await Promise.all(current.map(toView)),
      generatedAt,
    }
  }

  // Without a single game there is no taste to start from; the model is not asked.
  if (library.length === 0)
    return { profile: null, prefs, items: [], generatedAt: null, reason: 'no-library' }

  const owned = new Set(accountGames.map((g) => g.id))
  const [dismissed, interests, games, seen] = await Promise.all([
    listDismissed(user.id),
    listInterests(user.id, new Date().getFullYear()),
    // Games outside the catalog have no embedding, so they cannot shape the taste.
    gamesForTitles(library, false),
    seenGames(user.id, SEEN_KEEP_DAYS),
  ])
  const dismissedIds = new Set(dismissed.map((d) => d.game.id))

  // The service retrieves the catalog games closest to the player's taste (owned,
  // dismissed and already-saved interests are off the table) and has the model
  // rank, verify and explain them. A fresh batch is model work; serving the cached one above
  // is not.
  const result = await aroundModel({ user, action: 'recommend' }, () =>
    tagged({ user: user.id, action: 'recommend' }, () =>
      ai<Researched>('/recommend', {
        library: library.map((t) => ({
          name: t.name,
          progress: t.progress,
          lastUpdated: t.lastUpdated,
          earnedByType: t.earnedByType,
          game: games.get(t.npCommunicationId)?.id ?? null,
        })),
        exclude: [...new Set([...owned, ...dismissedIds, ...interests.map((i) => i.game.id)])],
        // Already shown, the longest ago first: they come back only when the unseen run out.
        seen,
        // A game turned down before the player bought it says nothing about their taste now.
        dismissed: dismissed
          .filter((d) => !owned.has(d.game.id))
          .map((d) => ({ name: d.game.name, reason: d.reason ?? null })),
        // What the player said wins over what the library suggests.
        preferences: {
          likes: [...prefs.added.genres, ...prefs.added.traits],
          avoid: prefs.added.avoid,
          wrong: TASTE_LISTS.flatMap((k) => prefs.removed[k]),
          filters: prefs.filters,
        },
      }),
    ),
  )
  const rows = []
  for (const item of result.items) {
    // Only catalog games: a name the model made up must not become a new game.
    const game = (item.game ? await getGame(item.game) : undefined) ?? (await gameByName(item.name))
    if (!game || owned.has(game.id) || dismissedIds.has(game.id)) continue
    rows.push({
      game: game.id,
      platform: item.platform,
      difficulty: item.difficulty,
      hours: item.hours,
      ...(Number.isInteger(item.playthroughs) && Number(item.playthroughs) > 0
        ? { playthroughs: Number(item.playthroughs) }
        : {}),
      ...(typeof item.hasDifficultyTrophy === 'boolean'
        ? { has_difficulty_trophy: item.hasDifficultyTrophy }
        : {}),
      has_missables: item.hasMissables,
      why: item.why,
      similar_to: item.similarTo,
    })
  }
  await replaceRecommendations(user.id, rows)
  await updateUser(user.id, { taste_profile: result.profile })
  const saved = await listRecommendations(user.id)
  return {
    profile: effectiveProfile(result.profile, prefs),
    baseProfile: result.profile,
    prefs,
    items: await Promise.all(saved.map(toView)),
    generatedAt: saved[0]?.generated_at ?? null,
  }
}

export async function dismissRecommendation(
  user: User,
  game: string,
  reason?: DismissReason,
): Promise<void> {
  await dismiss(user.id, game, reason)
}

// Labels in the player's language; the profile and the reasons are the model's.
export function recommendationReport(
  { profile, items }: Recommendations,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const t = translator(messages, locale)
  if (items.length === 0) return t('none')
  return [
    ...(profile
      ? [
          t('profile', { summary: profile.summary }),
          t('genres', { genres: profile.genres.join(', ') }),
          '',
        ]
      : []),
    t('title'),
    ...items.map(
      (r, i) =>
        `${i + 1}. ${r.game.name} (${r.platform}) — ${r.difficulty}/10, ~${r.hours}h${r.hasMissables ? t('hasMissables') : ''}\n   ${r.why}`,
    ),
  ].join('\n')
}
