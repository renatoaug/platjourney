import { ai } from './ai.ts'
import { aiContext } from './ai-context.ts'
import { tagged } from './costs.ts'
import { isDemo } from './demo.ts'
import { DEFAULT_LOCALE, defineMessages, Language, type Locale, translator } from './i18n.ts'
import type { GameContext } from './nexo.ts'
import { aroundModel } from './plugins.ts'
import { getUser, type User, updateUser } from './repository/user.ts'

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
}

export interface SessionPlan {
  game: string
  gameName: string
  minutes: number
  createdAt: string
  summary: string
  steps: PlanStep[]
  totalMinutes: number
  warnings: string[]
  ifTimeLeft: string | null
  /** A plan an assistant connected through MCP made (save_session_plan): its name. */
  assistant?: string
}

export type PlanStatus = 'active' | 'done' | 'expired'

export interface PlanView extends SessionPlan {
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
  const saved: SessionPlan = {
    ...plan,
    game: ctx.game.id,
    gameName: ctx.game.name,
    minutes,
    createdAt: new Date().toISOString(),
  }
  await updateUser(user.id, { session_plan: saved })
  return view(saved, ctx)
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
  const stored = ((await getUser(user.id))?.session_plan ?? null) as SessionPlan | null
  if (!stored || (ctx && stored.game !== ctx.game.id)) return null
  // The demo's stored plan is always the one being played: it never expires.
  const plan = isDemo(user)
    ? { ...stored, createdAt: new Date(Date.now() - DEMO_PLAN_AGE).toISOString() }
    : stored
  const age = Date.now() - new Date(plan.createdAt).getTime()
  if (age > (plan.minutes + GRACE_MINUTES) * 60_000 + RECAP_HOURS * 3_600_000) return null
  return view(plan, ctx)
}

export async function discardPlan(user: User): Promise<void> {
  await updateUser(user.id, { session_plan: null })
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
