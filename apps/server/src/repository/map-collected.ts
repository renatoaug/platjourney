import { plain, q, rid } from '../db.ts'
import { gameRef } from './game.ts'
import { userRef } from './user.ts'

// One row per player and game, its id built from both, so marking a spot never makes a second row.
const rowId = (user: string, game: string) =>
  rid('map_collected', `${user.replace(/^user:/, '')}_${game.replace(/^game:/, '')}`)

/** The spots of a game's map the player marked as collected. */
export async function collectedSpots(user: string, game: string): Promise<string[]> {
  const rows = plain(
    await q<{ spots: string[] }[]>('SELECT spots FROM $id', { id: rowId(user, game) }),
  )
  return rows[0]?.spots ?? []
}

/** Marks one spot as collected or not, keeping the others, and returns them all. */
export async function setCollected(
  user: string,
  game: string,
  spot: string,
  collected: boolean,
): Promise<string[]> {
  const operation = collected ? 'union' : 'complement'
  const rows = plain(
    await q<{ spots: string[] }[]>(
      `UPSERT $id SET user = $user, game = $game, spots = array::${operation}(spots ?? [], [$spot]) RETURN spots`,
      { id: rowId(user, game), user: userRef(user), game: gameRef(game), spot },
    ),
  )
  return rows[0]?.spots ?? []
}
