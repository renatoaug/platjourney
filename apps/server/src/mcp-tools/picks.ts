/** What PlatJourney ranks and recommends without the model: the next platinums, the similar-games
 * picks and the player's taste profile. */
import { library, ownedGames } from '../library.ts'
import { rankNextPlatinum } from '../ranking.ts'
import { tasteOf } from '../recommend.ts'
import { guideFacts } from '../repository/similar.ts'
import { similarPicks } from '../similar.ts'
import { gameRow, limitOf, SAVE_LIST, SAVE_PICK, type Tool } from './shared.ts'

export const getNextPlatinums: Tool = {
  name: 'get_next_platinums',
  description:
    "The player's own games closest to the platinum, ranked by PlatJourney by the effort left (base game only), with each guide's difficulty and hours.",
  inputSchema: {
    type: 'object',
    properties: { limit: { type: 'number', description: 'How many, up to 20 (default 10).' } },
  },
  next: SAVE_PICK,
  run: async (user, args) => {
    const ranked = await rankNextPlatinum(
      await library(user.psn_account_id),
      user,
      limitOf(args, 10, 20),
    )
    const facts = new Map(
      (await guideFacts(ranked.map((r) => r.game.id))).map((f) => [String(f.game), f]),
    )
    return {
      games: ranked.map((r) => {
        const f = facts.get(r.game.id)
        return {
          game: gameRow(r.game),
          platform: r.title.platform,
          baseProgress: r.baseProgress,
          trophiesLeft: r.remaining,
          guide: f
            ? {
                difficulty: f.difficulty ?? null,
                hours: f.hours ?? null,
                hasMissables: f.hasMissables ?? null,
                hasOnline: f.hasOnline ?? null,
              }
            : null,
        }
      }),
    }
  },
}

export const getRecommendations: Tool = {
  name: 'get_recommendations',
  description:
    "Games PlatJourney recommends from the player's library (its graph of similar games, no model): like the ones they play, quick platinums, and the rest of series they own. Each says which of the player's games led to it.",
  inputSchema: { type: 'object', properties: {} },
  next: `${SAVE_PICK} ${SAVE_LIST}`,
  run: async (user) => {
    const titles = await library(user.psn_account_id)
    const picks = await similarPicks(user, titles, await ownedGames(user.psn_account_id))
    const row = (p: (typeof picks.items)[number]) => ({
      game: gameRow(p.game),
      difficulty: p.difficulty,
      hours: p.hours,
      hasMissables: p.hasMissables,
      because: p.because,
    })
    return {
      likeYourGames: picks.items.slice(0, 15).map(row),
      quickPlatinums: picks.quick.slice(0, 10).map(row),
      inYourSeries: picks.series.slice(0, 10).map(row),
    }
  },
}

export const getTasteProfile: Tool = {
  name: 'get_taste_profile',
  description:
    "The player's taste as PlatJourney keeps it: a summary, the genres and traits they like, what they avoid, and their rules for recommendations (no missables, one playthrough, most hours or difficulty). Read it before recommending games from their taste. The profile is null when none was made yet: build it from get_platinums and get_library, and save it with save_recommendations.",
  inputSchema: { type: 'object', properties: {} },
  next: SAVE_LIST,
  run: async (user) => tasteOf(user),
}
