import { expect, test } from 'bun:test'
import { evaluateJourney, type JourneyTrophy } from '../../../shared/journey/model.ts'
import { odyssey } from '../../../shared/journey/odyssey.ts'
import { reviewedJourney } from '../../../shared/journey/registry.ts'
import { todaysFocus } from '../src/focus.ts'
import { makeContext, makeTrophy } from './fixtures.ts'

const list = (earned: string[] = []): JourneyTrophy[] =>
  odyssey.objectives.map((o) => ({
    id: o.trophyId,
    groupId: 'default',
    name: o.names[0],
    nameEn: o.names[1],
    type: o.kind === 'platinum' ? 'platinum' : 'bronze',
    earned: earned.includes(o.key),
  }))
const plan = (earned: string[] = []) => evaluateJourney(odyssey, list(earned))

test('Odyssey has 51 reviewed base objectives with valid references, not DLC prerequisites', () => {
  expect(odyssey.objectives).toHaveLength(51)
  expect(new Set(odyssey.objectives.map((o) => o.key)).size).toBe(51)
  expect(plan().covered).toBe(51)
  expect(plan().ongoing).toHaveLength(11)
  for (const o of odyssey.objectives) {
    expect(o.action.pt.length).toBeGreaterThan(20)
    expect(o.action.en.length).toBeGreaterThan(20)
    expect(o.sources.length).toBeGreaterThan(0)
    expect(o.chapter).toBeUndefined()
    for (const key of [...(o.requires ?? []), ...(o.evidenceAny ?? [])])
      expect(odyssey.objectives.some((x) => x.key === key)).toBe(true)
  }
  expect(odyssey.objectives.find((o) => o.kind === 'platinum')?.requires).toHaveLength(50)
})

test('explicit edition wins and ambiguous catalog identities do not activate a model', () => {
  expect(reviewedJourney({ np: 'NPWR13822_00' })).toBe(odyssey)
  expect(reviewedJourney({ np: 'OTHER', np_communication_ids: ['NPWR13822_00'] })).toBeUndefined()
  expect(
    reviewedJourney({ np_communication_ids: ['NPWR13822_00', 'NPWR22997_00'] }),
  ).toBeUndefined()
})

test('a new route shows parallel preparation without inventing location, level or quest availability', () => {
  const p = plan()
  expect(p.next?.objective.key).toBe('prologue')
  expect(p.items.find((x) => x.objective.key === 'doctor')?.state).toBe('check')
  expect(p.items.find((x) => x.objective.key === 'romance')?.state).toBe('prepare')
  expect(p).not.toHaveProperty('currentChapter')
  expect(p).not.toHaveProperty('region')
  expect(p).not.toHaveProperty('level')
  expect(p.items.some((x) => x.state === 'recover')).toBe(false)
})

test('story milestones never gate unrelated open-world opportunities or infer lost romance', () => {
  const start = plan()
  const middle = plan(['episode-6'])
  const end = plan(['episode-9'])
  expect(middle.next?.objective.key).toBe('episode-7')
  expect(middle.items.find((x) => x.objective.key === 'episode-1')?.state).toBe('verify')
  for (const p of [middle, end]) {
    expect(p.ongoing.map((x) => x.objective.key)).toEqual(start.ongoing.map((x) => x.objective.key))
    expect(p.items.find((x) => x.objective.key === 'doctor')?.state).toBe('check')
    expect(p.items.find((x) => x.objective.key === 'romance')?.state).toBe('prepare')
    expect(p.items.some((x) => x.state === 'recover')).toBe(false)
  }
  expect(end.storyComplete).toBe(true)
})

test('out-of-order optional unlocks update only evidenced opportunities and leave path order stable', () => {
  const before = list()
  const snapshot = structuredClone(before)
  const initial = evaluateJourney(odyssey, before)
  const updated = plan(['hunt', 'contracts', 'poseidon', 'episode-2'])
  expect(updated.items.find((x) => x.objective.key === 'armor-set')?.state).toBe('available')
  expect(updated.items.find((x) => x.objective.key === 'shiny')?.state).toBe('available')
  expect(updated.items.find((x) => x.objective.key === 'doctor')?.state).toBe('check')
  expect(updated.ongoing.some((x) => ['contracts', 'poseidon'].includes(x.objective.key))).toBe(
    false,
  )
  expect(updated.ongoing.some((x) => x.objective.key === 'hermes')).toBe(true)
  expect(updated.items.map((x) => x.objective.key)).toEqual(
    initial.items.map((x) => x.objective.key),
  )
  expect(before).toEqual(snapshot)
})

test('DLC with the same names or ids cannot change base completion, candidates or coverage', () => {
  const base = list(['episode-1'])
  const dlc = base.map((t) => ({ ...t, groupId: '001', earned: true }))
  const p = evaluateJourney(odyssey, [...base, ...dlc])
  expect(p.covered).toBe(51)
  expect(p.unmatched).toHaveLength(0)
  expect(p.candidates.map((x) => x.objective.key)).toEqual(
    plan(['episode-1']).candidates.map((x) => x.objective.key),
  )
  expect(p.storyComplete).toBe(false)
  expect(p.items.every((x) => x.trophy.groupId === 'default')).toBe(true)
})

test('counters and base completion never fabricate earned state or a platinum unlock', () => {
  const counters = evaluateJourney(
    odyssey,
    list().map((t) => ({ ...t, progressValue: 100, progressTarget: 100 })),
  )
  expect(counters.items.some((x) => x.state === 'complete')).toBe(false)
  const p = plan(odyssey.objectives.filter((o) => o.kind !== 'platinum').map((o) => o.key))
  expect(p.next).toBeUndefined()
  expect(p.candidates).toHaveLength(0)
  expect(p.items.find((x) => x.objective.kind === 'platinum')?.state).toBe('verify')
})

test('server and UI share focus; missing or ambiguous lists withhold personalized recommendations', () => {
  const ctx = makeContext({ trophies: list(['episode-6']).map((t) => makeTrophy(t)) })
  ctx.game.np_communication_ids = ['NPWR13822_00']
  ctx.title.npCommunicationId = 'NPWR13822_00'
  expect(todaysFocus(ctx).trophy?.name).toBe(plan(['episode-6']).next?.trophy.name)
  ctx.trophies.push({ ...ctx.trophies[0], id: 999 })
  expect(todaysFocus(ctx)).toEqual({ phases: [] })
  ctx.trophies = []
  expect(todaysFocus(ctx)).toEqual({ phases: [] })
})

test('source-backed windows sit inside the campaign without becoming unlock requirements', () => {
  const p = plan()
  const keys = p.items.map((x) => x.objective.key)
  for (const [key, after, before] of [
    ['first-upgrade', 'episode-1', 'episode-2'],
    ['shiny', 'episode-2', 'episode-3'],
    ['romance', 'episode-2', 'episode-3'],
    ['birthright', 'episode-6', 'episode-7'],
    ['olympics', 'episode-6', 'episode-7'],
  ]) {
    expect(keys.indexOf(key)).toBeGreaterThan(keys.indexOf(after))
    expect(keys.indexOf(key)).toBeLessThan(keys.indexOf(before))
    expect(p.items.find((x) => x.objective.key === key)?.objective.requires).toBeUndefined()
  }
  expect(plan(['olympics']).items.find((x) => x.objective.key === 'olympics')?.state).toBe(
    'complete',
  )
  expect(plan(['olympics']).items.find((x) => x.objective.key === 'episode-7')?.trophy.earned).toBe(
    false,
  )
  expect(plan(['episode-7']).items.find((x) => x.objective.key === 'olympics')?.state).toBe('check')
  expect(plan(['episode-2']).items.find((x) => x.objective.key === 'shiny')?.state).toBe(
    'available',
  )
  expect(p.items.find((x) => x.objective.key === 'contracts')?.objective.placement.kind).toBe(
    'parallel',
  )
})

for (const model of [odyssey])
  test('canonical IDs remain independent of display order or localization', () => {
    expect(model.objectives.find((x) => x.key === 'shiny')?.trophyId).toBe(14)
    expect(model.objectives.find((x) => x.key === 'olympics')?.trophyId).toBe(34)
    expect(model.objectives.find((x) => x.key === 'contracts')?.trophyId).toBe(45)
    const renamed = list().map((t) => ({ ...t, name: 'Same translated label', nameEn: undefined }))
    expect(evaluateJourney(model, renamed).covered).toBe(51)
    renamed[0].id = 999
    expect(evaluateJourney(model, renamed).covered).toBe(50)
    expect(evaluateJourney(model, [...list(), { ...list()[0] }]).covered).toBe(50)
    expect(
      evaluateJourney(
        model,
        list().map((t) => ({ ...t, groupId: '001' })),
      ).covered,
    ).toBe(0)
  })
