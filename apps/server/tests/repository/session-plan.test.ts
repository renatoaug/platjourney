import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import type { SessionPlan } from '../../src/planner.ts'
import {
  activePlan,
  activePlans,
  closePlan,
  savePlan,
  setPlanReason,
} from '../../src/repository/session-plan.ts'

const user = new db.RecordId('user', 'u1')
const plan: SessionPlan = {
  game: 'game:1',
  gameName: 'Days Gone',
  minutes: 90,
  createdAt: '2026-10-27T10:00:00.000Z',
  summary: 'Plano',
  steps: [
    { trophy: 'A', trophyId: 3, minutes: 30, how: 'h', why: 'w', trick: null, flexible: false },
  ],
  totalMinutes: 30,
  warnings: [],
  ifTimeLeft: null,
  npCommunicationId: 'NPWR1',
}

afterEach(() => mock.restore())

test('a new plan is stored in snake_case, without empty optional fields, and read back', async () => {
  const one = spyOn(db, 'one').mockResolvedValue({
    id: 'session_plan:p',
    game_name: 'Days Gone',
    np_communication_id: 'NPWR1',
    steps: [{ trophy: 'A', trophy_id: 3 }],
    status: 'active',
  })
  const saved = await savePlan('user:u1', plan)
  const data = (one.mock.calls[0][1] as { data: Record<string, unknown> }).data
  expect(one.mock.calls[0][0]).toBe('CREATE session_plan CONTENT $data')
  expect(data).toMatchObject({
    user,
    game: new db.RecordId('game', 1),
    game_name: 'Days Gone',
    np_communication_id: 'NPWR1',
    total_minutes: 30,
    created_at: new Date(plan.createdAt),
  })
  expect(data).not.toHaveProperty('if_time_left')
  expect((data.steps as Record<string, unknown>[])[0]).toMatchObject({ trophy_id: 3 })
  expect(saved).toMatchObject({
    id: 'session_plan:p',
    gameName: 'Days Gone',
    npCommunicationId: 'NPWR1',
    steps: [{ trophyId: 3 }],
  })
})

test('the plan on screen is the latest active or expired one', async () => {
  const one = spyOn(db, 'one').mockResolvedValue(undefined)
  expect(await activePlan('user:u1')).toBeUndefined()
  expect(one.mock.calls[0][0]).toContain("status IN ['active', 'expired']")
  expect(one.mock.calls[0][0]).toContain('ORDER BY created_at DESC LIMIT 1')
  expect(one.mock.calls[0][1]).toEqual({ user })
})

test('closing keeps how the plan ended, its steps and when', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  const at = new Date('2026-10-27T12:00:00Z')
  await closePlan('session_plan:p', 'ended', [{ ...plan.steps[0], done: true }], at)
  expect(q.mock.calls[0]).toEqual([
    'UPDATE $id SET status = $status, steps = $steps, ended_at = $at',
    {
      id: new db.RecordId('session_plan', 'p'),
      status: 'ended',
      steps: [
        {
          trophy: 'A',
          trophy_id: 3,
          minutes: 30,
          how: 'h',
          why: 'w',
          trick: null,
          flexible: false,
          done: true,
        },
      ],
      at,
    },
  ])
})

test('a reason sticks only to a closed plan of the player', async () => {
  const q = spyOn(db, 'q').mockResolvedValueOnce([{ id: 'session_plan:p' }])
  expect(await setPlanReason('user:u1', 'session_plan:p', 'too_long')).toBe(true)
  expect(q.mock.calls[0][0]).toContain("WHERE user = $user AND status IN ['ended', 'dismissed']")
  q.mockResolvedValueOnce([])
  expect(await setPlanReason('user:u2', 'session_plan:p', 'too_long')).toBe(false)
})

test('the active plans leave the demo out', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([{ id: 'session_plan:p', user: 'user:u1' }])
  expect(await activePlans()).toEqual([{ id: 'session_plan:p', user: 'user:u1' }] as never)
  expect(q.mock.calls[0][0]).toContain('user.demo != true')
})

test('a plan saved with a doubled game id is read as the game it means', async () => {
  spyOn(db, 'one').mockResolvedValue({
    id: 'session_plan:p',
    game: new db.RecordId('game', 'game:152242'),
    status: 'active',
    steps: [],
  })
  expect((await activePlan('user:u1'))?.game).toBe('game:152242')
})
