import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import type { JourneyModel } from '../../../shared/journey/model.ts'
import { odyssey } from '../../../shared/journey/odyssey.ts'
import { requiem } from '../../../shared/journey/requiem.ts'
import { selectJourneySession } from '../../../shared/journey/session.ts'
import * as aiModule from '../src/ai.ts'
import { DemoReadOnly } from '../src/demo.ts'
import { JourneySessionUnavailable, journeySession } from '../src/journey-session.ts'
import {
  currentPlan,
  discardPlan,
  planReport,
  planSession,
  type SessionPlan,
} from '../src/planner.ts'
import * as plans from '../src/repository/session-plan.ts'
import { makeContext, makeTrophy, makeUser } from './fixtures.ts'

const editions = new Map([
  [requiem, 'NPWR22997_00'],
  [odyssey, 'NPWR13822_00'],
])
function context(model: JourneyModel, earned: string[] = [], hidden: string[] = []) {
  const ctx = makeContext({
    trophies: model.objectives.map((o) =>
      makeTrophy({
        id: o.trophyId,
        name: o.names[0],
        nameEn: o.names[1],
        groupId: 'default',
        earned: earned.includes(o.key),
        hidden: hidden.includes(o.key),
        type: o.kind === 'platinum' ? 'platinum' : 'bronze',
      }),
    ),
  })
  ctx.title.npCommunicationId = editions.get(model) ?? ''
  ctx.game.np_communication_ids = [ctx.title.npCommunicationId]
  return ctx
}
const user = makeUser()
function storage() {
  let saved: SessionPlan | undefined
  const active = spyOn(plans, 'activePlan').mockImplementation(async () => saved)
  const save = spyOn(plans, 'savePlan').mockImplementation(async (_u, plan) => {
    saved = { ...plan, id: 'session_plan:reviewed', status: 'active' }
    return saved
  })
  const close = spyOn(plans, 'closePlan').mockResolvedValue()
  return { active, save, close }
}
afterEach(() => mock.restore())

for (const model of [requiem, odyssey]) {
  test(`${model.name}: budgets bound selection without estimating completion or including hidden/DLC`, () => {
    const ctx = context(model, [], [model.objectives[0].key])
    ctx.trophies.push(...ctx.trophies.map((t) => ({ ...t, groupId: 'dlc', earned: true })))
    for (const minutes of [15, 15.5, 60, 120, 180, 600]) {
      const selected = selectJourneySession(model, ctx.trophies, minutes, false)
      expect(selected.reason).toBeNull()
      expect(selected.steps.length).toBeLessThanOrEqual(Math.min(3, Math.ceil(minutes / 60)))
      expect(selected.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(minutes)
      expect(
        selected.steps.every(
          (s) =>
            !s.trophy.hidden &&
            !s.trophy.earned &&
            s.trophy.groupId === 'default' &&
            s.trophy.type !== 'platinum',
        ),
      ).toBe(true)
    }
    expect(selectJourneySession(model, ctx.trophies, 0, false).reason).toBe('invalid-time')
    const allHidden = ctx.trophies.map((t) => ({ ...t, hidden: true }))
    expect(selectJourneySession(model, allHidden, 60, false).reason).toBe('no-visible-actions')
    expect(selectJourneySession(model, allHidden, 60, true).steps.length).toBeGreaterThan(0)
  })

  test(`${model.name}: mounted planner stores reviewed keys and timeboxes, never calls the model`, async () => {
    const ctx = context(model)
    const { save } = storage()
    const ai = spyOn(aiModule, 'ai')
    const view = await planSession(user, ctx, 120)
    expect(ai).not.toHaveBeenCalled()
    expect(view.timing).toBe('budget')
    expect(view.totalMinutes).toBe(120)
    expect(
      save.mock.calls[0][1].steps.every(
        (s) => s.journey?.version === model.version && s.earns === false,
      ),
    ).toBe(true)
    expect(view.steps.every((s) => s.how.includes('Antes de começar'))).toBe(true)
    expect(planReport(view)).toContain('tempo reservado:')
    expect(planReport(view)).not.toContain('(~')
  })
}

test('partial knowledge and unobtainable guides preserve the old plan rather than falling back to invented suggestions', async () => {
  const ctx = context(odyssey)
  const { save, close } = storage()
  const ai = spyOn(aiModule, 'ai')
  ctx.trophies.pop()
  await expect(planSession(user, ctx, 60)).rejects.toBeInstanceOf(JourneySessionUnavailable)
  expect(save).not.toHaveBeenCalled()
  expect(close).not.toHaveBeenCalled()
  expect(ai).not.toHaveBeenCalled()
  const full = context(odyssey)
  full.guide = { ...full.guide, unobtainable: 'Online service unavailable' } as typeof full.guide
  expect(() => journeySession(user, full, 60, [])).toThrow(JourneySessionUnavailable)
})

test('replacing a reviewed plan avoids previous visible candidates and retains objective identity on close', async () => {
  const ctx = context(odyssey)
  const { close } = storage()
  const first = await planSession(user, ctx, 60)
  const second = await planSession(user, ctx, 60)
  expect(second.steps[0].trophyId).not.toBe(first.steps[0].trophyId)
  expect(close.mock.calls[0][2][0].journey).toEqual(first.steps[0].journey)
  expect(second.steps[0].earns).toBe(false)
})

test('out-of-order unlocks re-evaluate the active selection without silently rewriting or adding steps', async () => {
  const ctx = context(odyssey)
  const { save } = storage()
  const first = await planSession(user, ctx, 120)
  const names = first.steps.map((s) => s.trophy)
  const last = odyssey.objectives.findIndex((o) => o.key === 'episode-9')
  ctx.trophies[last].earned = true
  const updated = await currentPlan(user, ctx)
  expect(updated?.steps.map((s) => s.trophy)).toEqual(names)
  expect(updated?.steps[0].blocked).toBe(true)
  expect(updated?.steps[0].done).toBe(false)
  expect(updated?.nextIndex).toBe(1)
  const earnedStep = ctx.trophies.find((t) => t.id === first.steps[1].trophyId)
  if (!earnedStep) throw new Error('missing selected trophy')
  earnedStep.earned = true
  const later = await currentPlan(user, ctx)
  expect(later?.doneCount).toBe(1)
  expect(later?.nextIndex).toBe(-1)
  expect(save).toHaveBeenCalledTimes(1)
})

test('Requiem late chapters do not complete an earlier optional objective; its recovery stays visible', async () => {
  const ctx = context(requiem)
  storage()
  const first = await planSession(user, ctx, 60)
  expect(first.steps[0].journey?.objective).toBe('perfect-shot')
  ctx.trophies[requiem.objectives.findIndex((o) => o.key === 'chapter-17')].earned = true
  const updated = await currentPlan(user, ctx)
  expect(updated?.steps[0].done).toBe(false)
  expect(updated?.steps[0].how).toContain('recuperação')
  expect(updated?.steps[0].how).toContain('seleção de capítulos')
})

test('revoking reveal protects a saved step again, and hidden/unknown steps cannot become next', async () => {
  const ctx = context(odyssey, [], ['prologue'])
  const revealed = { ...user, revealed_trophy_games: [ctx.game.id] }
  const { close } = storage()
  const first = await planSession(revealed, ctx, 60)
  expect(first.steps[0].trophy).toBe(odyssey.objectives[0].names[0])
  const masked = await currentPlan(user, ctx)
  expect(masked?.steps[0]).toMatchObject({
    trophy: 'Troféu oculto',
    iconUrl: null,
    detail: null,
    blocked: true,
  })
  expect(masked?.steps[0].journey).toBeUndefined()
  expect(masked?.nextIndex).toBe(-1)
  expect(JSON.stringify(masked)).not.toContain(odyssey.objectives[0].names[0])
  await discardPlan(user, ctx)
  expect(close.mock.calls[0][2][0].trophy).toBe(first.steps[0].trophy)
})

test('English plans use reviewed English advice and demo remains read-only', async () => {
  const ctx = context(odyssey)
  const selected = journeySession({ ...user, locale: 'en' }, ctx, 60, [])
  expect(selected?.steps[0].how).toContain('Before starting')
  const active = spyOn(plans, 'activePlan')
  await expect(planSession({ ...user, demo: true }, ctx, 60)).rejects.toBeInstanceOf(DemoReadOnly)
  expect(active).not.toHaveBeenCalled()
})

for (const model of [requiem, odyssey])
  test(`${model.name} source relations are complete and acyclic in displayed order`, () => {
    expect(new Set(model.objectives.map((o) => `${o.groupId}/${o.trophyId}`)).size).toBe(
      model.objectives.length,
    )
    for (const o of model.objectives) {
      expect(Number.isInteger(o.trophyId)).toBe(true)
      expect(o.placement.evidence.pt.length).toBeGreaterThan(20)
      expect(o.placement.sources.length).toBeGreaterThan(0)
      if (o.placement.after)
        expect(model.objectives.find((x) => x.key === o.placement.after)?.order).toBeLessThan(
          o.order,
        )
      if (o.placement.before)
        expect(model.objectives.find((x) => x.key === o.placement.before)?.order).toBeGreaterThan(
          o.order,
        )
    }
    const ctx = context(model, ['chapter-13', 'episode-2'])
    const result = selectJourneySession(model, ctx.trophies, 60, true)
    expect(result.steps.every((x) => x.objective.groupId === 'default')).toBe(true)
    expect(result.steps.every((x) => !x.trophy.earned)).toBe(true)
  })

for (const model of [requiem, odyssey])
  test(`${model.name} sync rebases pending route and session on the same next action`, () => {
    const before = context(model)
    const earned = model === requiem ? ['chapter-8'] : ['episode-6', 'contracts']
    const after = context(model, earned)
    const initial = selectJourneySession(model, before.trophies, 60, true)
    const next = selectJourneySession(model, after.trophies, 60, true)
    expect(next.journey.remaining[0]).toBe(next.journey.next)
    expect(next.steps[0].objective.key).toBe(next.journey.remaining[0].objective.key)
    expect(next.journey.remaining[0].objective.key).not.toBe(
      initial.journey.remaining[0].objective.key,
    )
    expect(next.journey.remaining.every((x) => !x.trophy.earned)).toBe(true)
    expect(next.journey.remaining.at(-1)?.objective.kind).toBe('platinum')
    const firstVerify = next.journey.remaining.findIndex((x) => x.state === 'verify')
    expect(firstVerify).toBeGreaterThan(0)
    expect(
      next.journey.remaining
        .slice(firstVerify)
        .every((x) => x.state === 'verify' || x.objective.kind === 'platinum'),
    ).toBe(true)
  })
