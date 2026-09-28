import { q } from '../db.ts'
import { gameRef } from './game.ts'

export async function requestGuide(game: string): Promise<void> {
  await q(
    `IF (SELECT id FROM guide_request WHERE game = $game) {
       UPDATE guide_request SET requests += 1 WHERE game = $game
     } ELSE {
       CREATE guide_request SET game = $game, requests = 1
     }`,
    { game: gameRef(game) },
  )
}
