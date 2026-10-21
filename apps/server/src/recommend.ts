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
  type Recommender,
  saveRecommendations,
  seenGames,
} from './repository/recommendation.ts'
import { type GuideFacts, guideFacts } from './repository/similar.ts'
import { type User, updateUser } from './repository/user.ts'
import { graphCandidates } from './similar.ts'

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
// batches are kept this long.
const SEEN_KEEP_DAYS = 365

export interface TasteProfile {
  summary: string
  genres: string[]
  traits: string[]
  avoid: string[]
}

/** The profile's lists the player can change. */
const TASTE_LISTS = ['genres', 'traits', 'avoid'] as const
type TasteList = (typeof TASTE_LISTS)[number]
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
interface TastePrefs {
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

interface Recommendation {
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

interface Recommendations {
  /** The model's profile with the player's changes applied. */
  profile: TasteProfile | null
  /** The model's profile as it wrote it, so the page can preview changes before saving them. */
  baseProfile?: TasteProfile | null
  prefs: TastePrefs
  items: Recommendation[]
  generatedAt: string | null
  /** Who made the batch shown: Nexo, or the assistant that saved its list. */
  by: Recommender
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

type ResearchedItem = Researched['items'][number]

// Only catalog games: a name the model made up must not become a new game.
async function catalogRows(items: ResearchedItem[], owned: Set<string>, dismissedIds: Set<string>) {
  const rows = []
  for (const item of items) {
    const game = (item.game ? await getGame(item.game) : undefined) ?? (await gameByName(item.name))
    if (!game || owned.has(game.id) || dismissedIds.has(game.id)) continue
    rows.push(recommendationRow(game.id, item))
  }
  return rows
}

function recommendationRow(game: string, item: ResearchedItem) {
  return {
    game,
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
      by: current[0]?.recommender ?? 'nexo',
    }
  }

  // Without a single game there is no taste to start from; the model is not asked.
  if (library.length === 0)
    return {
      profile: null,
      prefs,
      items: [],
      generatedAt: null,
      by: 'nexo',
      reason: 'no-library',
    }

  const owned = new Set(accountGames.map((g) => g.id))
  const [dismissed, interests, games, seen] = await Promise.all([
    listDismissed(user.id),
    listInterests(user.id, new Date().getFullYear()),
    // Games outside the catalog have no embedding, so they cannot shape the taste.
    gamesForTitles(library, false),
    seenGames(user.id, SEEN_KEEP_DAYS),
  ])
  const dismissedIds = new Set(dismissed.map((d) => d.game.id))
  const exclude = new Set([...owned, ...dismissedIds, ...interests.map((i) => i.game.id)])
  // The similar-games graph's best candidates come first in what the model looks at; without the
  // graph (edges not written yet) the service searches by taste alone.
  const candidates = await graphCandidates(user, library, games, exclude).catch(() => [])

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
        exclude: [...exclude],
        candidates,
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
  const rows = await catalogRows(result.items, owned, dismissedIds)
  await saveRecommendations(user.id, rows)
  await updateUser(user.id, { taste_profile: result.profile })
  const saved = await listRecommendations(user.id)
  return {
    profile: effectiveProfile(result.profile, prefs),
    baseProfile: result.profile,
    prefs,
    items: await Promise.all(saved.map(toView)),
    generatedAt: saved[0]?.generated_at ?? null,
    by: 'nexo',
  }
}

/** The player's taste as recommendations read it: the profile with their changes, and their rules.
 * Null profile when no batch was ever made and the player added nothing. */
export function tasteOf(user: User): { profile: TasteProfile | null; filters: RecFilters } {
  const prefs = readPrefs(user.taste_prefs) ?? emptyPrefs()
  return {
    profile: effectiveProfile((user.taste_profile as TasteProfile | null) ?? null, prefs),
    filters: prefs.filters,
  }
}

// Why a game of an assistant's list is left out, or null when it is kept.
function skipReason(game: string, owned: Set<string>, dismissed: Set<string>, f?: GuideFacts) {
  if (owned.has(game)) return 'already in their library'
  if (dismissed.has(game)) return 'they turned it down'
  if (f?.difficulty == null || f.hours == null) return 'no PlatJourney guide yet'
  return null
}

// A game of an assistant's list as a batch row, its numbers from the guide.
function assistantRow(game: Game, f: GuideFacts, why: string, similarTo: string[]) {
  return {
    game: game.id,
    platform: game.platforms?.includes('PS5') ? 'PS5' : (game.platforms?.[0] ?? 'PS5'),
    difficulty: Number(f.difficulty),
    hours: Number(f.hours),
    ...(Number(f.playthroughs) > 0 ? { playthroughs: Number(f.playthroughs) } : {}),
    ...(f.difficultyTrophy !== undefined
      ? { has_difficulty_trophy: Boolean(f.difficultyTrophy) }
      : {}),
    has_missables: Boolean(f.hasMissables),
    why,
    similar_to: similarTo,
  }
}

/** A list an assistant made with the player, saved as the latest batch under its name, so Discover
 * shows it where Nexo's picks are. Only games with a guide (the cards show its numbers) that the
 * player neither owns nor turned down; the rest come back as skipped. The assistant's profile is
 * kept only when there is none yet: Nexo's, and the player's changes to it, stay. */
export async function saveAssistantRecommendations(
  user: User,
  items: { game: Game; why: string; similarTo: string[] }[],
  accountGames: Game[],
  assistant: Exclude<Recommender, 'nexo'>,
  profile?: TasteProfile,
): Promise<{ saved: Game[]; skipped: { game: string; reason: string }[] }> {
  const owned = new Set(accountGames.map((g) => g.id))
  const dismissed = new Set((await listDismissed(user.id)).map((d) => d.game.id))
  const facts = new Map((await guideFacts(items.map((i) => i.game.id))).map((f) => [f.game, f]))
  const saved: Game[] = []
  const skipped: { game: string; reason: string }[] = []
  const rows = []
  for (const { game, why, similarTo } of items) {
    const f = facts.get(game.id)
    const reason = skipReason(game.id, owned, dismissed, f)
    if (reason || !f) {
      skipped.push({ game: game.name, reason: reason ?? 'no PlatJourney guide yet' })
      continue
    }
    saved.push(game)
    rows.push(assistantRow(game, f, why, similarTo))
  }
  if (rows.length) await saveRecommendations(user.id, rows, assistant)
  if (rows.length && profile && !user.taste_profile)
    await updateUser(user.id, { taste_profile: profile })
  return { saved, skipped }
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
        `${i + 1}. ${r.game.name} (${r.platform}): ${r.difficulty}/10, ~${r.hours}h${r.hasMissables ? t('hasMissables') : ''}\n   ${r.why}`,
    ),
  ].join('\n')
}
