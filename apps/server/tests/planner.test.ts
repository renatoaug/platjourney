import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as aiModule from '../src/ai.ts'
import { currentTag } from '../src/costs.ts'
import {
  currentPlan,
  discardPlan,
  type PlanView,
  planReport,
  planSession,
  type SessionPlan,
} from '../src/planner.ts'
import * as users from '../src/repository/user.ts'
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

afterEach(() => mock.restore())

test('a session plan is saved and ticks off what is already earned', async () => {
  let tag: unknown
  const ai = spyOn(aiModule, 'ai').mockImplementation((async () => {
    tag = currentTag()
    const { game, gameName, minutes, createdAt, ...rest } = plan()
    return { ...rest, steps: [{ ...step('A', 30), flexible: undefined }, step('B', 60)] }
  }) as never)
  const update = spyOn(users, 'updateUser').mockResolvedValue(undefined)
  const view = await planSession(user, ctx, 90)
  expect(ai.mock.calls[0][0]).toBe('/plans/session')
  expect(ai.mock.calls[0][1]).toMatchObject({ minutes: 90 })
  expect(tag).toEqual({ user: 'user:u1', action: 'plan' })
  expect(update.mock.calls[0][1].session_plan).toMatchObject({ game: 'game:1', minutes: 90 })
  expect(view.steps.map((s) => [s.done, s.startsAt, s.iconUrl, s.type, s.flexible])).toEqual([
    [true, 0, 'a.png', 'gold', false],
    [false, 30, null, 'bronze', false],
  ])
  expect(view).toMatchObject({ status: 'active', doneCount: 1, nextIndex: 1 })
})

test('there is no plan when none is stored, it is for another game or it is old', async () => {
  const get = spyOn(users, 'getUser')
  get.mockResolvedValueOnce(makeUser())
  expect(await currentPlan(user, ctx)).toBeNull()
  get.mockResolvedValueOnce(makeUser({ session_plan: plan({ game: 'game:2' }) }))
  expect(await currentPlan(user, ctx)).toBeNull()
  get.mockResolvedValueOnce(
    makeUser({ session_plan: plan({ createdAt: minutesAgo(90 + 60 + 20 * 60 + 1) }) }),
  )
  expect(await currentPlan(user, ctx)).toBeNull()
})

test('a plan past its time stays as an expired recap', async () => {
  spyOn(users, 'getUser').mockResolvedValue(
    makeUser({ session_plan: plan({ createdAt: minutesAgo(200) }) }),
  )
  expect(await currentPlan(user, ctx)).toMatchObject({ status: 'expired', nextIndex: -1 })
})

test('a plan with every step earned is done', async () => {
  spyOn(users, 'getUser').mockResolvedValue(
    makeUser({ session_plan: plan({ steps: [step('A', 30)] }) }),
  )
  expect(await currentPlan(user, ctx)).toMatchObject({
    status: 'done',
    doneCount: 1,
    nextIndex: -1,
  })
})

test('without a game context nothing is ticked off', async () => {
  spyOn(users, 'getUser').mockResolvedValue(makeUser({ session_plan: plan() }))
  const view = (await currentPlan(user)) as PlanView
  expect(view.doneCount).toBe(0)
  expect(view.steps[0].iconUrl).toBeNull()
})

test('discarding clears the stored plan', async () => {
  const update = spyOn(users, 'updateUser').mockResolvedValue(undefined)
  await discardPlan(user)
  expect(update).toHaveBeenCalledWith('user:u1', { session_plan: null })
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
      '**Plano de 2h05 — Days Gone**',
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
  spyOn(users, 'getUser').mockResolvedValue(
    makeUser({ session_plan: plan({ createdAt: '2020-01-01T00:00:00Z' }) }),
  )
  const view = await currentPlan(makeUser({ demo: true }), ctx)
  expect(view).toMatchObject({ status: 'active', doneCount: 1, nextIndex: 1 })
  expect(await currentPlan(makeUser(), ctx)).toBeNull()
})
