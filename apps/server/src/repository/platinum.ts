import { plain, q } from '../db.ts'
import type { Game } from './game.ts'
import { gameRef } from './game.ts'
import { userRef } from './user.ts'

interface PlatinumRow {
  id: string
  game: Game
  np_communication_id: string
  trophy_name: string
  earned_at: string
  rarity_rate: number
}

export async function listPlatinums(user: string): Promise<PlatinumRow[]> {
  return plain(
    await q<PlatinumRow[]>(
      'SELECT *, game.* AS game FROM platinum WHERE user = $user ORDER BY earned_at DESC',
      { user: userRef(user) },
    ),
  )
}

export async function savePlatinum(
  user: string,
  row: {
    game: string
    np_communication_id: string
    trophy_name: string
    earned_at: string
    rarity_rate: number
  },
): Promise<void> {
  await q(
    'UPSERT platinum SET user = $user, game = $game, np_communication_id = $np, trophy_name = $trophy, earned_at = $at, rarity_rate = $rate WHERE user = $user AND np_communication_id = $np',
    {
      user: userRef(user),
      game: gameRef(row.game),
      np: row.np_communication_id,
      trophy: row.trophy_name,
      at: new Date(row.earned_at),
      rate: row.rarity_rate,
    },
  )
}
