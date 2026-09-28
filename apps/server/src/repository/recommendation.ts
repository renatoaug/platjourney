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

export async function listRecommendations(user: string): Promise<RecommendationRow[]> {
  return plain(
    await q<RecommendationRow[]>(
      `SELECT *, created_at AS generated_at, game.* AS game FROM recommendation
       WHERE user = $user AND game NOT IN (SELECT VALUE game FROM dismissal WHERE user = $user)
       ORDER BY created_at DESC`,
      { user: userRef(user) },
    ),
  )
}

export async function replaceRecommendations(
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
  await q('DELETE recommendation WHERE user = $user', { user: userRef(user) })
  for (const r of rows) {
    await q('CREATE recommendation CONTENT $data', {
      data: { ...r, user: userRef(user), game: gameRef(r.game) },
    })
  }
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
