import { plain, q, rid } from '../db.ts'
import type { Game } from './game.ts'
import { gameRef } from './game.ts'
import { userRef } from './user.ts'

export interface Interest {
  id: string
  game: Game
  year: number
  position: number
  recommended_at?: string | null
  next_pick_at?: string | null
}

export async function listInterests(user: string, year: number): Promise<Interest[]> {
  return plain(
    await q<Interest[]>(
      'SELECT *, game.* AS game FROM interest WHERE user = $user AND year = $year ORDER BY position, created_at',
      { user: userRef(user), year },
    ),
  )
}

export async function addInterest(user: string, game: string, year: number): Promise<void> {
  await q(
    // A game just saved goes to the top of the list. A game Nexo recommended keeps when it last did.
    `LET $min = (SELECT VALUE math::min(position) FROM interest WHERE user = $user GROUP ALL)[0] ?? 0;
     LET $rec = array::max(SELECT VALUE created_at FROM recommendation WHERE user = $user AND game = $game);
     UPSERT interest SET user = $user, game = $game, year = $year, position = $min - 1,
       recommended_at = recommended_at ?? $rec WHERE user = $user AND game = $game;`,
    { user: userRef(user), game: gameRef(game), year },
  )
}

/** Marks the game "Nexo decide" just picked as the player's next platinum, and only that one. */
export async function markNextPick(user: string, game: string): Promise<void> {
  await q(
    `UPDATE interest SET next_pick_at = NONE WHERE user = $user AND next_pick_at != NONE AND game != $game;
     UPDATE interest SET next_pick_at = time::now() WHERE user = $user AND game = $game;`,
    { user: userRef(user), game: gameRef(game) },
  )
}

export async function removeInterest(user: string, id: string): Promise<void> {
  await q('DELETE interest WHERE id = $id AND user = $user', {
    id: rid('interest', id.split(':')[1]),
    user: userRef(user),
  })
}

// Full manual order; interests not listed keep their relative order after the listed ones.
export async function setInterestOrder(user: string, year: number, ids: string[]): Promise<void> {
  const current = await listInterests(user, year)
  const own = new Set(current.map((i) => i.id))
  const listed = ids.filter((id) => own.has(id))
  const order = [...listed, ...current.filter((i) => !listed.includes(i.id)).map((i) => i.id)]
  for (const [i, id] of order.entries()) {
    await q('UPDATE $id SET position = $pos', {
      id: rid('interest', id.split(':')[1]),
      pos: i + 1,
    })
  }
}
