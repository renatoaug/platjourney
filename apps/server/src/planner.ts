import { ai } from './ai.ts'
import { aiContext } from './ai-context.ts'
import { tagged } from './costs.ts'
import { isDemo } from './demo.ts'
import { DEFAULT_LOCALE, defineMessages, Language, type Locale, translator } from './i18n.ts'
import type { GameContext } from './nexo.ts'
import { aroundModel } from './plugins.ts'
import type { AssistantKey } from './repository/activity.ts'
import { activePlan, activePlans, closePlan, savePlan } from './repository/session-plan.ts'
import { getTitle } from './repository/title.ts'
import type { User } from './repository/user.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    title: '**Plano de {duration}: {game}**',
    trick: 'Macete: {trick}',
    ifTimeLeft: 'Se sobrar tempo: {text}',
  },
  [Language.En]: {
    title: '**{duration} plan: {game}**',
    trick: 'Trick: {trick}',
    ifTimeLeft: 'If you have time left: {text}',
  },
})

export interface PlanStep {
  trophy: string
  minutes: number
  how: string
  why: string
  trick: string | null
  // true when the step can be done at any point of the session (a grind, a
  // purchase); false when it only opens after the steps before it.
  flexible: boolean
  // The trophy's id on the plan's PSN list, to check it later without PSN; absent on old plans.
  trophyId?: number | null
  // Earned by the time the plan ended; false while it is on screen.
  done?: boolean
}

// How a plan left the screen: the player ended the session early, closed it once it was over, made
// a new one, or let its time run out.
export type PlanEnd = 'ended' | 'dismissed' | 'replaced' | 'expired'
export const PLAN_REASONS = ['not_useful', 'too_long', 'other_game', 'no_time'] as const
export type PlanReason = (typeof PLAN_REASONS)[number]

export interface SessionPlan {
  id?: string
  game: string
  gameName: string
  minutes: number
  createdAt: string
  summary: string
  steps: PlanStep[]
  totalMinutes: number
  warnings: string[]
  ifTimeLeft: string | null
  /** A plan an assistant connected through MCP made (save_session_plan): which one. */
  assistant?: AssistantKey
  /** The PSN trophy list the steps' trophy ids belong to. */
  npCommunicationId?: string | null
  status?: 'active' | PlanEnd
  endedAt?: string | null
  reason?: PlanReason | null
}

export type PlanStatus = 'active' | 'done' | 'expired'

export interface PlanView extends Omit<SessionPlan, 'status'> {
  steps: (PlanStep & {
    done: boolean
    startsAt: number
    iconUrl: string | null
    type: string | null
  })[]
  doneCount: number
  status: PlanStatus
  // Index of the step to play now, or -1 when nothing is left.
  nextIndex: number
  expiresAt: string
}

// A plan belongs to one sitting: it stays active for the time asked plus a
// grace period, then remains visible as a recap until the next day.
const GRACE_MINUTES = 60
const RECAP_HOURS = 20
const DEMO_PLAN_AGE = 25 * 60_000

// Builds a route for one play session: which trophies fit in the time available,
// in which order, with the trick for each. Base-game trophies come first; the
// platinum itself is never a step.
export async function planSession(
  user: User,
  ctx: GameContext,
  minutes: number,
): Promise<PlanView> {
  const plan = await aroundModel({ user, action: 'plan' }, () =>
    tagged({ user: user.id, action: 'plan' }, () =>
      ai<Omit<SessionPlan, 'game' | 'gameName' | 'minutes' | 'createdAt'>>('/plans/session', {
        context: aiContext(ctx, user),
        minutes,
      }),
    ),
  )
  const saved = await startPlan(
    user,
    {
      ...plan,
      game: ctx.game.id,
      gameName: ctx.game.name,
      minutes,
      createdAt: new Date().toISOString(),
    },
    ctx,
  )
  return view(saved, ctx)
}

// A new plan, Nexo's or a connected assistant's, takes the place of the one on screen; that one
// keeps the steps done by now. Each step remembers its trophy's id, to be checked without PSN.
export async function startPlan(
  user: User,
  plan: SessionPlan,
  ctx: GameContext,
): Promise<SessionPlan> {
  const current = await activePlan(user.id)
  if (current?.status === 'active' && current.id)
    await closePlan(current.id, 'replaced', await ticked(user, current, ctx))
  const byName = new Map(ctx.trophies.map((t) => [t.name, t.id]))
  return savePlan(user.id, {
    ...plan,
    npCommunicationId: ctx.title.npCommunicationId,
    steps: plan.steps.map((s) => ({ ...s, trophyId: byName.get(s.trophy) ?? null, done: false })),
  })
}

const endsAt = (plan: SessionPlan) =>
  new Date(new Date(plan.createdAt).getTime() + (plan.minutes + GRACE_MINUTES) * 60_000)

// The steps with whether each was earned: from the trophies just read when they are this game's,
// otherwise from the earned trophies the last sync stored.
async function ticked(user: User, plan: SessionPlan, ctx?: GameContext): Promise<PlanStep[]> {
  const strip = ({ trophy, trophyId, minutes, how, why, trick, flexible }: PlanStep) => ({
    trophy,
    trophyId: trophyId ?? null,
    minutes,
    how,
    why,
    trick,
    flexible,
  })
  if (ctx?.game.id === plan.game)
    return view(plan, ctx).steps.map((s) => ({ ...strip(s), done: s.done }))
  return doneFromLibrary(user.id, plan).then((steps) =>
    steps.map((s) => ({ ...strip(s), done: s.done })),
  )
}

async function doneFromLibrary(user: string, plan: SessionPlan): Promise<PlanStep[]> {
  const title = plan.npCommunicationId ? await getTitle(user, plan.npCommunicationId) : undefined
  const earned = new Set(title?.earned_ids ?? [])
  return plan.steps.map((s) => ({ ...s, done: s.trophyId != null && earned.has(s.trophyId) }))
}

// Plans whose time ran out with no action, closed by the hourly check: their end is when the time
// ran out, and the steps are checked against the trophies the last sync stored.
export async function expirePlans(now = Date.now()): Promise<number> {
  let n = 0
  for (const plan of await activePlans()) {
    const end = endsAt(plan)
    if (now < end.getTime() || !plan.id) continue
    await closePlan(plan.id, 'expired', await doneFromLibrary(String(plan.user), plan), end)
    n++
  }
  return n
}

// Steps tick themselves off as PSN reports the trophies earned.
function view(plan: SessionPlan, ctx?: GameContext): PlanView {
  const earned = new Set(
    (ctx?.game.id === plan.game ? ctx.trophies : []).filter((t) => t.earned).map((t) => t.name),
  )
  const byName = new Map((ctx?.game.id === plan.game ? ctx.trophies : []).map((t) => [t.name, t]))
  let clock = 0
  const steps = plan.steps.map((s) => {
    const trophy = byName.get(s.trophy)
    const step = {
      ...s,
      flexible: s.flexible ?? false,
      done: earned.has(s.trophy),
      startsAt: clock,
      iconUrl: trophy?.iconUrl ?? null,
      type: trophy?.type ?? null,
    }
    clock += s.minutes
    return step
  })
  const doneCount = steps.filter((s) => s.done).length
  const expiresAt = new Date(
    new Date(plan.createdAt).getTime() + (plan.minutes + GRACE_MINUTES) * 60_000,
  ).toISOString()
  const status: PlanStatus =
    steps.length > 0 && doneCount === steps.length
      ? 'done'
      : Date.now() > new Date(expiresAt).getTime()
        ? 'expired'
        : 'active'
  return {
    ...plan,
    steps,
    doneCount,
    status,
    nextIndex: status === 'active' ? steps.findIndex((s) => !s.done) : -1,
    expiresAt,
  }
}

export async function currentPlan(user: User, ctx?: GameContext): Promise<PlanView | null> {
  const stored = (await activePlan(user.id)) ?? null
  if (!stored || (ctx && stored.game !== ctx.game.id)) return null
  // The demo's stored plan is always the one being played: it never expires.
  const plan = isDemo(user)
    ? { ...stored, createdAt: new Date(Date.now() - DEMO_PLAN_AGE).toISOString() }
    : stored
  const age = Date.now() - new Date(plan.createdAt).getTime()
  if (age > (plan.minutes + GRACE_MINUTES) * 60_000 + RECAP_HOURS * 3_600_000) return null
  return view(plan, ctx)
}

// The player takes the plan off the screen: ending the session while it runs, or dismissing it once
// it is over. A plan closed with no step done may get a reason, asked for afterwards.
export async function discardPlan(
  user: User,
  ctx?: GameContext,
): Promise<{ id: string; askReason: boolean } | null> {
  const current = await activePlan(user.id)
  if (!current?.id) return null
  const steps = await ticked(user, current, ctx)
  const over = Date.now() > endsAt(current).getTime()
  const done = steps.length > 0 && steps.every((s) => s.done)
  await closePlan(
    current.id,
    over || done ? 'dismissed' : 'ended',
    steps,
    over ? endsAt(current) : new Date(),
  )
  return { id: current.id, askReason: !steps.some((s) => s.done) }
}

// Labels in the player's language; the steps are the plan as the model wrote it.
export function planReport(p: PlanView, locale: Locale = DEFAULT_LOCALE): string {
  const t = translator(messages, locale)
  const h = (m: number) =>
    m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m}min`
  return [
    t('title', { duration: h(p.minutes), game: p.gameName }),
    p.summary,
    '',
    ...p.steps.map(
      (s, i) =>
        `${i + 1}. ${s.done ? '✅ ' : ''}**${s.trophy}** (~${h(s.minutes)})\n   ${s.how}${s.trick ? `\n   ${t('trick', { trick: s.trick })}` : ''}`,
    ),
    ...(p.warnings.length ? ['', ...p.warnings.map((w) => `⚠️ ${w}`)] : []),
    ...(p.ifTimeLeft ? ['', t('ifTimeLeft', { text: p.ifTimeLeft })] : []),
  ].join('\n')
}
