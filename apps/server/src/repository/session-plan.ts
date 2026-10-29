import { camelKeys, gameId, one, plain, q, rid, snakeKeys } from '../db.ts'
import type { PlanEnd, PlanReason, PlanStep, SessionPlan } from '../planner.ts'
import { userRef } from './user.ts'

const planRef = (id: string) => rid('session_plan', id.replace(/^session_plan:/, ''))

// Rows are stored with snake_case keys (AGENTS.md, Database) and used with camelCase ones.
const fromRow = (row: unknown): SessionPlan | undefined =>
  row ? (camelKeys(plain(row)) as SessionPlan) : undefined

/** The plan on screen: the player's latest one still active, or expired and shown as a recap. */
export async function activePlan(user: string): Promise<SessionPlan | undefined> {
  return fromRow(
    await one(
      `SELECT * FROM session_plan WHERE user = $user AND status IN ['active', 'expired']
       ORDER BY created_at DESC LIMIT 1`,
      { user: userRef(user) },
    ),
  )
}

/** Stores a new plan as active and returns it with its id. */
export async function savePlan(user: string, plan: SessionPlan): Promise<SessionPlan> {
  const { id: _id, status: _s, endedAt: _e, reason: _r, game, createdAt, ...rest } = plan
  // option<...> fields reject NULL: a missing value goes as NONE (left out).
  const fields = Object.fromEntries(Object.entries(snakeKeys(rest)).filter(([, v]) => v != null))
  const row = await one('CREATE session_plan CONTENT $data', {
    data: {
      ...fields,
      user: userRef(user),
      game: gameId(game),
      created_at: new Date(createdAt),
    },
  })
  return fromRow(row) as SessionPlan
}

/** Closes a plan with how it ended and which steps were done by then. */
export async function closePlan(
  id: string,
  status: PlanEnd,
  steps: PlanStep[],
  endedAt: Date = new Date(),
): Promise<void> {
  await q('UPDATE $id SET status = $status, steps = $steps, ended_at = $at', {
    id: planRef(id),
    status,
    steps: snakeKeys(steps),
    at: endedAt,
  })
}

/** Why the player closed one of their plans; a plan of someone else, or still on screen, is left alone. */
export async function setPlanReason(
  user: string,
  id: string,
  reason: PlanReason,
): Promise<boolean> {
  const rows = await q<unknown[]>(
    `UPDATE $id SET reason = $reason WHERE user = $user AND status IN ['ended', 'dismissed']`,
    { id: planRef(id), user: userRef(user), reason },
  )
  return Array.isArray(rows) && rows.length > 0
}

/** Plans that expired since a moment, to tick off the trophies that came in after their time. */
export async function expiredSince(since: Date): Promise<(SessionPlan & { user: string })[]> {
  const rows = await q<unknown[]>(
    "SELECT * FROM session_plan WHERE status = 'expired' AND ended_at >= $since AND user.demo != true",
    { since },
  )
  return (rows ?? []).map((r) => fromRow(r) as SessionPlan & { user: string })
}

/** The steps of a closed plan, with what is done now; its status and end stay. */
export async function setPlanSteps(id: string, steps: PlanStep[]): Promise<void> {
  await q('UPDATE $id SET steps = $steps', { id: planRef(id), steps: snakeKeys(steps) })
}

/** Every active plan but the demo's, whose plan is always the one being played. */
export async function activePlans(): Promise<(SessionPlan & { user: string })[]> {
  const rows = await q<unknown[]>(
    "SELECT * FROM session_plan WHERE status = 'active' AND user.demo != true",
  )
  return (rows ?? []).map((r) => fromRow(r) as SessionPlan & { user: string })
}
