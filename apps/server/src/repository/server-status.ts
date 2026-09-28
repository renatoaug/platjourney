import { plain, q } from '../db.ts'
import type { Game } from './game.ts'
import { gameRef } from './game.ts'

export type ServerState = 'active' | 'announced' | 'closed' | 'unknown'
export interface ServerStatus {
  id: string
  game: Game
  status: ServerState
  date: string | null
  note: string | null
  checked_at: string
}

export async function listServerStatuses(games?: string[]): Promise<ServerStatus[]> {
  if (games && games.length === 0) return []
  return plain(
    await q<ServerStatus[]>(
      `SELECT *, shutdown_at AS date, updated_at AS checked_at, game.* AS game FROM server_status ${games ? 'WHERE game IN $games' : ''} ORDER BY game.name`,
      games ? { games: games.map(gameRef) } : undefined,
    ),
  )
}

export async function saveServerStatus(s: {
  game: string
  status: ServerState
  date: string | null
  note: string | null
}): Promise<void> {
  await q(
    'UPSERT server_status SET game = $game, status = $status, shutdown_at = $date, note = $note WHERE game = $game',
    {
      game: gameRef(s.game),
      status: s.status,
      date: s.date ?? undefined,
      note: s.note ?? undefined,
    },
  )
}
