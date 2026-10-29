import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as aiModule from '../src/ai.ts'
import { currentTag } from '../src/costs.ts'
import {
  currentPlan,
  discardPlan,
  expirePlans,
  type PlanView,
  planReport,
  planSession,
  type SessionPlan,
  startPlan,
} from '../src/planner.ts'
import * as plans from '../src/repository/session-plan.ts'
import * as titles from '../src/repository/title.ts'
import { makeContext, makeTrophy, makeUser } from './fixtures.ts'

const user = makeUser()
const ctx = makeContext({
  trophies: [
    makeTrophy({ id: 1, name: 'A', earned: true, iconUrl: 'a.png', type: 'gold' }),
    makeTrophy({ id: 2, name: 'B' }),
  ],
})
const step = (trophy: string, minutes: number) => ({
  trophy,
  minutes,
  how: `faça ${trophy}`,
  why: 'rápido',
  trick: null,
  flexible: false,
})
const plan = (over: Partial<SessionPlan> = {}): SessionPlan => ({
  game: 'game:1',
  gameName: 'Days Gone',
  minutes: 90,
  createdAt: new Date().toISOString(),
  summary: 'Plano',
  steps: [step('A', 30), step('B', 60)],
  totalMinutes: 90,
  warnings: [],
  ifTimeLeft: null,
  ...over,
})
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
// The game context with the player's last trophy of the game this many minutes ago: they played.
const playedAgo = (m: number) => ({ ...ctx, title: { ...ctx.title, lastUpdated: minutesAgo(m) } })

afterEach(() => mock.restore())

test('a session plan is saved and ticks off what is already earned', async () => {
  let tag: unknown
  const ai = spyOn(aiModule, 'ai').mockImplementation((async () => {
    tag = currentTag()
    const { game, gameName, minutes, createdAt, ...rest } = plan()
    return { ...rest, steps: [{ ...step('A', 30), flexible: undefined }, step('B', 60)] }
  }) as never)
  spyOn(plans, 'activePlan').mockResolvedValue(undefined)
  const save = spyOn(plans, 'savePlan').mockImplementation(async (_u, p) => ({
    ...p,
    id: 'session_plan:n',
  }))
  const view = await planSession(user, ctx, 90)
  expect(ai.mock.calls[0][0]).toBe('/plans/session')
  expect(ai.mock.calls[0][1]).toMatchObject({ minutes: 90 })
  expect(tag).toEqual({ user: 'user:u1', action: 'plan' })
  expect(save.mock.calls[0][1]).toMatchObject({ game: 'game:1', minutes: 90 })
  // Each step keeps its trophy's id on the plan's list, to be checked later without PSN.
  expect(save.mock.calls[0][1].steps.map((s) => [s.trophyId, s.done])).toEqual([
    [1, false],
    [2, false],
  ])
  expect(view.id).toBe('session_plan:n')
  expect(view.steps.map((s) => [s.done, s.startsAt, s.iconUrl, s.type, s.flexible])).toEqual([
    [true, 0, 'a.png', 'gold', false],
    [false, 30, null, 'bronze', false],
  ])
  expect(view).toMatchObject({ status: 'active', doneCount: 1, nextIndex: 1 })
})

test('there is no plan when none is stored, it is for another game or it is old', async () => {
  const get = spyOn(plans, 'activePlan')
  get.mockResolvedValueOnce(undefined)
  expect(await currentPlan(user, ctx)).toBeNull()
  get.mockResolvedValueOnce(plan({ game: 'game:2' }))
  expect(await currentPlan(user, ctx)).toBeNull()
  const old = 90 + 60 + 20 * 60 + 2
  get.mockResolvedValueOnce(plan({ createdAt: minutesAgo(old) }))
  expect(await currentPlan(user, playedAgo(old - 1))).toBeNull()
})

test('a plan past its time stays as an expired recap', async () => {
  spyOn(plans, 'activePlan').mockResolvedValue(plan({ createdAt: minutesAgo(200) }))
  expect(await currentPlan(user, playedAgo(199))).toMatchObject({
    status: 'expired',
    nextIndex: -1,
  })
})

test('a plan the player has not played yet waits for the sitting, up to a day', async () => {
  const get = spyOn(plans, 'activePlan')
  // Made 200 minutes ago, no trophy of the game since: still on, until a day after it was made.
  get.mockResolvedValueOnce(plan({ createdAt: minutesAgo(200) }))
  const waiting = await currentPlan(user, ctx)
  expect(waiting).toMatchObject({ status: 'active', nextIndex: 1 })
  expect(new Date(waiting?.expiresAt ?? 0).getTime()).toBeGreaterThan(Date.now() + 20 * 3_600_000)
  // Played ten minutes ago: the time counts from that play, with its grace.
  get.mockResolvedValueOnce(plan({ createdAt: minutesAgo(200) }))
  expect(await currentPlan(user, playedAgo(10))).toMatchObject({ status: 'active' })
})

test('a plan with every step earned is done', async () => {
  spyOn(plans, 'activePlan').mockResolvedValue(plan({ steps: [step('A', 30)] }))
  expect(await currentPlan(user, ctx)).toMatchObject({
    status: 'done',
    doneCount: 1,
    nextIndex: -1,
  })
})

test('without a game context nothing is ticked off', async () => {
  spyOn(plans, 'activePlan').mockResolvedValue(plan())
  const view = (await currentPlan(user)) as PlanView
  expect(view.doneCount).toBe(0)
  expect(view.steps[0].iconUrl).toBeNull()
})

test('ending a running session keeps the plan as ended, with the steps done by then', async () => {
  spyOn(plans, 'activePlan').mockResolvedValue(plan({ id: 'session_plan:p' }))
  const close = spyOn(plans, 'closePlan').mockResolvedValue()
  expect(await discardPlan(user, ctx)).toEqual({ id: 'session_plan:p', askReason: false })
  expect(close.mock.calls[0][1]).toBe('ended')
  expect(close.mock.calls[0][2].map((s) => [s.trophy, s.done])).toEqual([
    ['A', true],
    ['B', false],
  ])
})

test('dismissing a plan that is over dates it to when its time ran out', async () => {
  const createdAt = minutesAgo(500)
  spyOn(plans, 'activePlan').mockResolvedValue(
    plan({ id: 'session_plan:p', createdAt, status: 'expired' }),
  )
  const close = spyOn(plans, 'closePlan').mockResolvedValue()
  await discardPlan(user, playedAgo(499))
  expect(close.mock.calls[0][1]).toBe('dismissed')
  expect(close.mock.calls[0][3]).toEqual(new Date(new Date(createdAt).getTime() + 150 * 60_000))
})

test('a plan closed with no step done asks why, and nothing on screen closes nothing', async () => {
  const get = spyOn(plans, 'activePlan')
  spyOn(plans, 'closePlan').mockResolvedValue()
  get.mockResolvedValueOnce(plan({ id: 'session_plan:p', steps: [step('B', 60)] }))
  expect(await discardPlan(user, ctx)).toEqual({ id: 'session_plan:p', askReason: true })
  get.mockResolvedValueOnce(undefined)
  expect(await discardPlan(user, ctx)).toBeNull()
})

test('a new plan replaces the active one, which keeps its steps done', async () => {
  spyOn(plans, 'activePlan').mockResolvedValue(plan({ id: 'session_plan:old', status: 'active' }))
  const close = spyOn(plans, 'closePlan').mockResolvedValue()
  spyOn(plans, 'savePlan').mockImplementation(async (_u, p) => ({ ...p, id: 'session_plan:new' }))
  const saved = await startPlan(user, plan(), ctx)
  expect(close.mock.calls[0].slice(0, 2)).toEqual(['session_plan:old', 'replaced'])
  expect(saved.id).toBe('session_plan:new')
})

test('an expired recap is not touched by a new plan', async () => {
  spyOn(plans, 'activePlan').mockResolvedValue(plan({ id: 'session_plan:old', status: 'expired' }))
  const close = spyOn(plans, 'closePlan').mockResolvedValue()
  spyOn(plans, 'savePlan').mockImplementation(async (_u, p) => p)
  await startPlan(user, plan(), ctx)
  expect(close).not.toHaveBeenCalled()
})

test('the hourly check expires plans past their time, ticking steps from the stored trophies', async () => {
  const late = plan({
    id: 'session_plan:late',
    createdAt: minutesAgo(151),
    npCommunicationId: 'NPWR1',
    steps: [
      { ...step('A', 30), trophyId: 1 },
      { ...step('B', 60), trophyId: 2 },
    ],
  })
  spyOn(plans, 'activePlans').mockResolvedValue([
    { ...late, user: 'user:u1' },
    { ...plan({ id: 'session_plan:now' }), user: 'user:u2' },
  ])
  spyOn(titles, 'getTitle').mockResolvedValue({
    earned_ids: [2],
    last_updated_at: minutesAgo(150),
  } as never)
  spyOn(plans, 'expiredSince').mockResolvedValue([])
  const close = spyOn(plans, 'closePlan').mockResolvedValue()
  expect(await expirePlans()).toBe(1)
  expect(close.mock.calls[0][0]).toBe('session_plan:late')
  expect(close.mock.calls[0][1]).toBe('expired')
  expect(close.mock.calls[0][2].map((s) => s.done)).toEqual([false, true])
})

test('the report shows durations, done steps, tricks, warnings and spare time', () => {
  const view: PlanView = {
    ...plan({ minutes: 125, warnings: ['Salve antes'], ifTimeLeft: 'Colete penas' }),
    steps: [
      { ...step('A', 45), trick: 'pule', done: true, startsAt: 0, iconUrl: null, type: null },
      { ...step('B', 60), done: false, startsAt: 45, iconUrl: null, type: null },
    ],
    doneCount: 1,
    status: 'active',
    nextIndex: 1,
    expiresAt: '',
  }
  expect(planReport(view)).toBe(
    [
      '**Plano de 2h05: Days Gone**',
      'Plano',
      '',
      '1. ✅ **A** (~45min)\n   faça A\n   Macete: pule',
      '2. **B** (~1h)\n   faça B',
      '',
      '⚠️ Salve antes',
      '',
      'Se sobrar tempo: Colete penas',
    ].join('\n'),
  )
})

test('the demo plan never expires and is always the one being played', async () => {
  spyOn(plans, 'activePlan').mockResolvedValue(plan({ createdAt: '2020-01-01T00:00:00Z' }))
  const view = await currentPlan(makeUser({ demo: true }), ctx)
  expect(view).toMatchObject({ status: 'active', doneCount: 1, nextIndex: 1 })
  expect(await currentPlan(makeUser(), ctx)).toBeNull()
})

test('a plan not played yet is not expired by the hourly check before a day', async () => {
  spyOn(plans, 'activePlans').mockResolvedValue([
    {
      ...plan({ id: 'session_plan:w', createdAt: minutesAgo(300), npCommunicationId: 'NPWR1' }),
      user: 'user:u1',
    },
  ])
  spyOn(titles, 'getTitle').mockResolvedValue({
    earned_ids: [],
    last_updated_at: minutesAgo(400),
  } as never)
  spyOn(plans, 'expiredSince').mockResolvedValue([])
  const close = spyOn(plans, 'closePlan').mockResolvedValue()
  expect(await expirePlans()).toBe(0)
  expect(close).not.toHaveBeenCalled()
})

test('a trophy that lands after a plan expired still ticks its step off', async () => {
  spyOn(plans, 'activePlans').mockResolvedValue([])
  spyOn(plans, 'expiredSince').mockResolvedValue([
    {
      ...plan({
        id: 'session_plan:e',
        status: 'expired',
        npCommunicationId: 'NPWR1',
        steps: [
          { ...step('A', 30), trophyId: 1, done: false },
          { ...step('B', 60), trophyId: 2, done: false },
        ],
      }),
      user: 'user:u1',
    },
  ])
  spyOn(titles, 'getTitle').mockResolvedValue({ earned_ids: [1] } as never)
  const set = spyOn(plans, 'setPlanSteps').mockResolvedValue()
  await expirePlans()
  expect(set.mock.calls[0][0]).toBe('session_plan:e')
  expect(set.mock.calls[0][1].map((s) => s.done)).toEqual([true, false])
})
