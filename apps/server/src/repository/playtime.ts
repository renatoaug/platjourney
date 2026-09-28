import { plain, q } from '../db.ts'
import { gameRef } from './game.ts'
import { userRef } from './user.ts'

export interface Playtime {
  game: string
  seconds: number
  play_count: number
  first_played_at: string | null
  last_played_at: string | null
}

export async function listPlaytimes(user: string): Promise<Playtime[]> {
  return plain(
    await q<Playtime[]>(
      'SELECT game, seconds, play_count, first_played_at, last_played_at FROM playtime WHERE user = $user',
      { user: userRef(user) },
    ),
  )
}

export async function savePlaytime(user: string, p: Playtime): Promise<void> {
  await q(
    'UPSERT playtime SET user = $user, game = $game, seconds = $seconds, play_count = $count, first_played_at = $first, last_played_at = $last WHERE user = $user AND game = $game',
    {
      user: userRef(user),
      game: gameRef(p.game),
      seconds: p.seconds,
      count: p.play_count,
      first: p.first_played_at ? new Date(p.first_played_at) : undefined,
      last: p.last_played_at ? new Date(p.last_played_at) : undefined,
    },
  )
}
