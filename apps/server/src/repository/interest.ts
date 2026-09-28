import { plain, q, rid } from '../db.ts'
import type { Game } from './game.ts'
import { gameRef } from './game.ts'
import { userRef } from './user.ts'

export interface Interest {
  id: string
  game: Game
  year: number
  position: number
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
    // A game just saved goes to the top of the list.
    `LET $min = (SELECT VALUE math::min(position) FROM interest WHERE user = $user GROUP ALL)[0] ?? 0;
     UPSERT interest SET user = $user, game = $game, year = $year, position = $min - 1 WHERE user = $user AND game = $game;`,
    { user: userRef(user), game: gameRef(game), year },
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
