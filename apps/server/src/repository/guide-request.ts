import { q } from '../db.ts'
import { gameRef } from './game.ts'
import { userRef } from './user.ts'

// A request is a player who opened the game while it had no guide: opening it again, or
// reloading the page, is the same request.
export async function requestGuide(game: string, user: string): Promise<void> {
  await q(
    `IF (SELECT id FROM guide_request WHERE game = $game) {
       UPDATE guide_request SET users = array::union(users, [$user]), requests = array::len(array::union(users, [$user])) WHERE game = $game
     } ELSE {
       CREATE guide_request SET game = $game, users = [$user], requests = 1
     }`,
    { game: gameRef(game), user: userRef(user) },
  )
}
