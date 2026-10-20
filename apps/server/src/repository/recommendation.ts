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

/** The latest batch, without the games dismissed since. The picks asked for one at a time are not
 * part of any batch. */
export async function listRecommendations(user: string): Promise<RecommendationRow[]> {
  return plain(
    await q<RecommendationRow[]>(
      // Rows from before batches were kept have no batch_at: with no batch since, they are the latest.
      `LET $last = array::max(SELECT VALUE batch_at FROM recommendation
         WHERE user = $user AND batch_at != NONE AND source != 'pick');
       SELECT *, batch_at ?? created_at AS generated_at, game.* AS game FROM recommendation
       WHERE user = $user AND batch_at = $last AND source != 'pick'
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
      data: {
        ...r,
        user: userRef(user),
        game: gameRef(r.game),
        batch_at: batch,
        source: 'discover',
      },
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

/** Where Nexo looks for a pick: the player's interests, or any game. */
export type PickScope = 'interests' | 'any'

export interface PickRow {
  id: string
  game: Game
  why: string
  first_step: string
  mood?: string
  scope: PickScope
  owned_only?: boolean
  fits?: boolean
  created_at: string
}

/** Keeps a pick the player asked for, as one more recommendation of theirs. */
export async function savePick(
  user: string,
  pick: {
    game: string
    why: string
    first_step: string
    mood?: string
    scope: PickScope
    owned_only?: boolean
    fits: boolean
  },
): Promise<PickRow> {
  const [row] = await q<PickRow[]>('CREATE recommendation CONTENT $data RETURN *, game.* AS game', {
    data: {
      ...pick,
      user: userRef(user),
      game: gameRef(pick.game),
      source: 'pick',
      similar_to: [],
    },
  })
  return plain(row)
}

/** The picks the player asked Nexo for, the latest first. */
export async function listPicks(user: string, limit = 30): Promise<PickRow[]> {
  return plain(
    await q<PickRow[]>(
      `SELECT id, game.* AS game, why, first_step, mood, scope, owned_only, fits, created_at
       FROM recommendation WHERE user = $user AND source = 'pick' AND recommender = 'Nexo'
       ORDER BY created_at DESC LIMIT $limit`,
      { user: userRef(user), limit },
    ),
  )
}

/** The games picked in the last `hours` looking in `scope`: asking again leaves them out. */
export async function recentPickGames(
  user: string,
  scope: PickScope,
  hours: number,
): Promise<string[]> {
  const rows = await q<unknown[]>(
    `SELECT VALUE game FROM recommendation WHERE user = $user AND source = 'pick'
       AND recommender = 'Nexo' AND scope = $scope AND created_at > time::now() - <duration> $since`,
    { user: userRef(user), scope, since: `${hours}h` },
  )
  return [...new Set(plain(rows ?? []).map(String))]
}

/** The latest time Nexo recommended `game` to the player, in a batch or as a pick, within `days`.
 * A game an assistant suggested is not Nexo's. */
export async function lastRecommended(
  user: string,
  game: string,
  days: number,
): Promise<{ at: string; source: 'discover' | 'pick'; why: string } | null> {
  const [row] = await q<{ at: string; source?: string; why: string }[]>(
    `SELECT created_at AS at, source, why FROM recommendation
     WHERE user = $user AND game = $game AND created_at > time::now() - <duration> $since
       AND recommender = 'Nexo'
     ORDER BY at DESC LIMIT 1`,
    { user: userRef(user), game: gameRef(game), since: `${days}d` },
  )
  if (!row) return null
  const r = plain(row)
  return { at: String(r.at), source: r.source === 'pick' ? 'pick' : 'discover', why: r.why }
}

// Why a player turns a recommendation down; the model steers the next ones away from it.
const DISMISS_REASONS = ['too_long', 'too_hard', 'genre', 'online', 'played'] as const
export type DismissReason = (typeof DISMISS_REASONS)[number]
export const isDismissReason = (value: unknown): value is DismissReason =>
  (DISMISS_REASONS as readonly unknown[]).includes(value)

export async function dismiss(user: string, game: string, reason?: DismissReason): Promise<void> {
  await q(
    'UPSERT dismissal SET user = $user, game = $game, reason = $reason WHERE user = $user AND game = $game',
    { user: userRef(user), game: gameRef(game), reason: reason ?? null },
  )
}

interface Dismissed {
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

/** How long a game an assistant suggested stays on Discover. */
const ASSISTANT_PICK_DAYS = 30

export interface AssistantPick {
  id: string
  game: Game
  why: string
  assistant: string
  created_at: string
}

/** Keeps a game an assistant suggested, as a pick it made; the same game again replaces it, with
 * the new reason and date. Like Nexo's, it keeps new batches from repeating the game for a while. */
export async function saveAssistantPick(
  user: string,
  game: string,
  why: string,
  assistant: string,
): Promise<void> {
  await q(
    `DELETE recommendation WHERE user = $user AND game = $game AND source = 'pick'
       AND recommender != 'Nexo';
     CREATE recommendation CONTENT { user: $user, game: $game, source: 'pick', why: $why,
       recommender: $assistant, similar_to: [] };`,
    { user: userRef(user), game: gameRef(game), why, assistant },
  )
}

/** The games assistants suggested in the last ASSISTANT_PICK_DAYS, not saved to this year's
 * interests nor dismissed. Newest first. */
export async function assistantPicks(user: string, year: number): Promise<AssistantPick[]> {
  return plain(
    await q<AssistantPick[]>(
      `LET $saved = SELECT VALUE game FROM interest WHERE user = $user AND year = $year;
       LET $dismissed = SELECT VALUE game FROM dismissal WHERE user = $user;
       SELECT id, game.* AS game, why, recommender AS assistant, created_at FROM recommendation
       WHERE user = $user AND source = 'pick' AND recommender != 'Nexo'
         AND created_at > time::now() - ${ASSISTANT_PICK_DAYS}d
         AND game NOTINSIDE $saved AND game NOTINSIDE $dismissed
       ORDER BY created_at DESC;`,
      { user: userRef(user), year },
    ),
  )
}

/** Takes a game an assistant suggested off Discover. */
export async function dropAssistantPick(user: string, game: string): Promise<void> {
  await q(
    "DELETE recommendation WHERE user = $user AND game = $game AND source = 'pick' AND recommender != 'Nexo'",
    { user: userRef(user), game: gameRef(game) },
  )
}
