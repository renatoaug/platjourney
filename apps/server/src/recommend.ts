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

export interface TasteProfile {
  summary: string
  genres: string[]
  traits: string[]
  avoid: string[]
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
  profile: TasteProfile | null
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
): Promise<Recommendations> {
  const current = await listRecommendations(user.id)
  const generatedAt = current[0]?.generated_at ?? null
  const fresh =
    generatedAt && Date.now() - new Date(generatedAt).getTime() < CACHE_DAYS * 86_400_000
  // The demo player keeps the stored batch, however old: a new one would call the model.
  if (isDemo(user) || (current.length && fresh && !force)) {
    return {
      profile: (user.taste_profile as TasteProfile | null) ?? null,
      items: await Promise.all(current.map(toView)),
      generatedAt,
    }
  }

  // Without a single game there is no taste to start from; the model is not asked.
  if (library.length === 0)
    return { profile: null, items: [], generatedAt: null, reason: 'no-library' }

  const owned = new Set(accountGames.map((g) => g.id))
  const [dismissed, interests, games] = await Promise.all([
    listDismissed(user.id),
    listInterests(user.id, new Date().getFullYear()),
    // Games outside the catalog have no embedding, so they cannot shape the taste.
    gamesForTitles(library, false),
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
        // A game turned down before the player bought it says nothing about their taste now.
        dismissed: dismissed
          .filter((d) => !owned.has(d.game.id))
          .map((d) => ({ name: d.game.name, reason: d.reason ?? null })),
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
    profile: result.profile,
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
