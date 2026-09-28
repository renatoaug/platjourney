import { camelKeys, one, plain, q, snakeKeys } from '../db.ts'
import { gameRef } from './game.ts'

export async function getGuide<T>(game: string): Promise<T | undefined> {
  const row = plain(
    await one<{ guide: T }>('SELECT guide FROM guide WHERE game = $game LIMIT 1', {
      game: gameRef(game),
    }),
  )
  return row?.guide ? camelKeys(row.guide) : undefined
}

export async function saveGuide(game: string, guide: unknown): Promise<void> {
  await q(
    'UPSERT guide SET game = $game, guide = $guide, fetched_at = time::now() WHERE game = $game',
    {
      game: gameRef(game),
      guide: snakeKeys(guide),
    },
  )
}

export interface GuideSummary {
  game: string
  difficulty: number
  hours: number
  playthroughs: number
  hasMissables: boolean
  hasOnline: boolean
  unobtainable: string | null
  deep: boolean
}

// The quick facts of every stored guide, to list and sort games by them.
export async function guideSummaries(): Promise<GuideSummary[]> {
  return plain(
    await q<GuideSummary[]>(
      `SELECT game, guide.difficulty AS difficulty, guide.hours AS hours,
         guide.playthroughs AS playthroughs, guide.has_missables AS has_missables,
         guide.has_online AS has_online, guide.unobtainable AS unobtainable, passages > 0 AS deep
       FROM guide WHERE guide != NONE`,
    ),
  ).map(camelKeys)
}
