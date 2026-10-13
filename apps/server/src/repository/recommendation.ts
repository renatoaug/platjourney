import { plain, q } from '../db.ts'
import type { Game } from './game.ts'
import { gameRef } from './game.ts'
import { userRef } from './user.ts'

export interface RecommendationRow {
  id: string
  game: Game
  platform: string
  difficulty: number
  hours: number
  playthroughs?: number
  has_difficulty_trophy?: boolean
  has_missables: boolean
  why: string
  similar_to: string[]
  generated_at: string
}

/** The latest batch, without the games dismissed since. */
export async function listRecommendations(user: string): Promise<RecommendationRow[]> {
  return plain(
    await q<RecommendationRow[]>(
      // Rows from before batches were kept have no batch_at: with no batch since, they are the latest.
      `LET $last = array::max(SELECT VALUE batch_at FROM recommendation WHERE user = $user AND batch_at != NONE);
       SELECT *, batch_at ?? created_at AS generated_at, game.* AS game FROM recommendation
       WHERE user = $user AND batch_at = $last
         AND game NOT IN (SELECT VALUE game FROM dismissal WHERE user = $user)
       ORDER BY created_at DESC`,
      { user: userRef(user) },
    ),
  )
}

/** Adds a batch; the ones before stay, so the next batches bring other games for a while. */
export async function saveRecommendations(
  user: string,
  rows: {
    game: string
    platform: string
    difficulty: number
    hours: number
    playthroughs?: number
    has_difficulty_trophy?: boolean
    has_missables: boolean
    why: string
    similar_to: string[]
  }[],
): Promise<void> {
  const batch = new Date()
  for (const r of rows) {
    await q('CREATE recommendation CONTENT $data', {
      data: { ...r, user: userRef(user), game: gameRef(r.game), batch_at: batch },
    })
  }
}

/** Every game recommended to the player, the one shown longest ago first, the latest batch
 * included. Batches older than `keepDays` are dropped on the way. */
export async function seenGames(user: string, keepDays: number): Promise<string[]> {
  await q(
    'DELETE recommendation WHERE user = $user AND created_at < time::now() - <duration> $ttl',
    { user: userRef(user), ttl: `${keepDays}d` },
  )
  const rows = await q<{ game: unknown; at: string }[]>(
    'SELECT game, created_at AS at FROM recommendation WHERE user = $user',
    { user: userRef(user) },
  )
  const last = new Map<string, string>()
  for (const r of plain(rows ?? [])) {
    const id = String(r.game)
    const at = String(r.at)
    if (!last.has(id) || at > (last.get(id) ?? '')) last.set(id, at)
  }
  return [...last].sort((a, b) => a[1].localeCompare(b[1])).map(([id]) => id)
}

// Why a player turns a recommendation down; the model steers the next ones away from it.
export const DISMISS_REASONS = ['too_long', 'too_hard', 'genre', 'online', 'played'] as const
export type DismissReason = (typeof DISMISS_REASONS)[number]
export const isDismissReason = (value: unknown): value is DismissReason =>
  (DISMISS_REASONS as readonly unknown[]).includes(value)

export async function dismiss(user: string, game: string, reason?: DismissReason): Promise<void> {
  await q(
    'UPSERT dismissal SET user = $user, game = $game, reason = $reason WHERE user = $user AND game = $game',
    { user: userRef(user), game: gameRef(game), reason: reason ?? null },
  )
}

export interface Dismissed {
  game: Game
  reason?: DismissReason
}

export async function listDismissed(user: string): Promise<Dismissed[]> {
  return plain(
    await q<Dismissed[]>('SELECT game.* AS game, reason FROM dismissal WHERE user = $user', {
      user: userRef(user),
    }),
  )
}
