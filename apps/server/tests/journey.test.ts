import { expect, test } from 'bun:test'
import { evaluateJourney, type JourneyTrophy } from '../../../shared/journey/model.ts'
import { reviewedJourney } from '../../../shared/journey/registry.ts'
import { requiem } from '../../../shared/journey/requiem.ts'
import { todaysFocus } from '../src/focus.ts'
import { makeContext, makeTrophy } from './fixtures.ts'

// Public trophy metadata, synthetic progress only. No player records in fixtures.
const list = (earned: string[] = []): JourneyTrophy[] =>
  requiem.objectives.map((o, id) => ({
    id,
    groupId: 'default',
    name: o.names[0],
    nameEn: o.names[1],
    type: o.kind === 'platinum' ? 'platinum' : 'bronze',
    earned: earned.includes(o.key),
  }))
const state = (earned: string[]) => evaluateJourney(requiem, list(earned))

test('reviewed Requiem catalogue covers 36 unique objectives, with sources and valid dependencies', () => {
  expect(requiem.objectives).toHaveLength(36)
  expect(new Set(requiem.objectives.map((o) => o.key)).size).toBe(36)
  expect(requiem.objectives.filter((o) => o.kind === 'story')).toHaveLength(17)
  for (const o of requiem.objectives) {
    expect(o.sources.every((s) => s.startsWith('https://'))).toBe(true)
    expect(o.action.pt.length).toBeGreaterThan(20)
    expect(o.action.en.length).toBeGreaterThan(20)
    expect(o.requires?.includes(o.key)).not.toBe(true)
    for (const key of o.requires ?? [])
      expect(requiem.objectives.some((x) => x.key === key)).toBe(true)
  }
  expect(state([]).covered).toBe(36)
})

test('the pilot is scoped to the PSN edition, never just a similar catalog name or id', () => {
  expect(reviewedJourney({ id: 'game:152242' })).toBeUndefined()
  expect(reviewedJourney({ np: 'UNKNOWN' })).toBeUndefined()
  expect(reviewedJourney({ np: 'NPWR22997_00' })).toBe(requiem)
})

test('opening opportunity precedes chapter completion, preparation does not fabricate progress', () => {
  const trophies = list()
  const before = structuredClone(trophies)
  const p = evaluateJourney(requiem, trophies)
  expect(p.confirmedChapter).toBe(0)
  expect(p.next?.objective.key).toBe('perfect-shot')
  expect(p.items.findIndex((x) => x.objective.key === 'perfect-shot')).toBeLessThan(
    p.items.findIndex((x) => x.objective.key === 'chapter-1'),
  )
  expect(p.ongoing.some((x) => x.objective.key === 'explorer')).toBe(true)
  expect(p.ongoing.some((x) => x.objective.key === 'night-guard')).toBe(false)
  expect(p.items.find((x) => x.objective.key === 'platinum')?.state).toBe('later')
  expect(trophies).toEqual(before)
})

test('middle of campaign plans a chapter opportunity before its ending, without inferring location', () => {
  const p = state(['chapter-1', 'chapter-2', 'chapter-3'])
  expect(p.next?.objective.key).toBe('mercy')
  expect(p.confirmedChapter).toBe(3)
  expect(p.items.find((x) => x.objective.key === 'perfect-shot')?.state).toBe('recover')
  expect(p.ongoing.some((x) => x.objective.key === 'night-guard')).toBe(true)
  expect(p).not.toHaveProperty('currentChapter')
})

test('out-of-order unlocks re-evaluate future opportunities without completing missing chapters', () => {
  const p = state(['chapter-8'])
  expect(p.next?.objective.key).toBe('old-protector')
  expect(p.items.find((x) => x.objective.key === 'chapter-2')?.state).toBe('verify')
  expect(p.items.find((x) => x.objective.key === 'chapter-2')?.trophy.earned).toBe(false)
  expect(p.items.find((x) => x.objective.key === 'perfect-throw')?.state).toBe('recover')
  const changed = state(['chapter-8', 'old-protector'])
  expect(changed.next?.objective.key).toBe('chapter-9')
  expect(changed.items.map((x) => x.objective.key)).toEqual(p.items.map((x) => x.objective.key))
})

test('endgame prioritizes skill carryover before upgrades and removes only confirmed achievements', () => {
  const earned = requiem.objectives
    .filter((o) => !['prudence', 'opportunism', 'alchemy', 'platinum'].includes(o.key))
    .map((o) => o.key)
  const p = state(earned)
  expect(p.storyComplete).toBe(true)
  expect(p.next?.objective.key).toBe('prudence')
  expect(state([...earned, 'prudence']).next?.objective.key).toBe('opportunism')
  expect(state([...earned, 'prudence', 'opportunism']).next?.objective.key).toBe('alchemy')
  const ready = state([...earned, 'prudence', 'opportunism', 'alchemy'])
  expect(ready.next).toBeUndefined()
  expect(ready.items.find((x) => x.objective.key === 'platinum')?.state).toBe('verify')
  expect(
    state(requiem.objectives.map((o) => o.key)).items.every((x) => x.state === 'complete'),
  ).toBe(true)
})

test('ambiguous names and partial lists fail closed; foreign and DLC objectives stay unmatched', () => {
  const trophies = list()
  trophies[1].name = 'Unknown'
  trophies[1].nameEn = 'Unknown'
  trophies.push({ ...trophies[2], id: 99 }, { ...trophies[3], id: 100, groupId: '001' })
  const p = evaluateJourney(requiem, trophies)
  expect(p.covered).toBe(34)
  expect(p.unmatched.map((x) => x.id)).toEqual([1, 2, 99])
})

test('server focus consumes the same reviewed recommendation rather than the legacy phase ordering', () => {
  const ctx = makeContext({
    trophies: list(['chapter-8']).map((t) => makeTrophy(t as Parameters<typeof makeTrophy>[0])),
  })
  ctx.game.np_communication_ids = ['NPWR22997_00']
  expect(todaysFocus(ctx).trophy?.name).toBe('Antiga protetora')
  ctx.game.np_communication_ids = ['OTHER']
  expect(todaysFocus(ctx).trophy?.name).not.toBe('Antiga protetora')
})

test('an incomplete reviewed edition does not fall back to an unreviewed focus', () => {
  const ctx = makeContext({
    trophies: [makeTrophy({ name: 'Mira perfeita', nameEn: 'Perfect shot' })],
  })
  ctx.game.np_communication_ids = ['NPWR22997_00']
  expect(todaysFocus(ctx)).toEqual({ phases: [] })
})

test('an unobtainable guide suppresses the reviewed server recommendation', () => {
  const ctx = makeContext({
    trophies: list().map((t) => makeTrophy(t as Parameters<typeof makeTrophy>[0])),
    guide: {
      difficulty: 3,
      hours: 30,
      playthroughs: 2,
      hasMissables: false,
      hasOnline: false,
      overview: '',
      glossary: [],
      missables: [],
      roadmap: [],
      earlyTips: [],
      onlineTrophies: [],
      easiest: null,
      hardest: null,
      mostTedious: null,
      tricks: [],
      buggy: [],
      collectibles: null,
      pointOfNoReturn: null,
      autopop: null,
      sources: [],
      unobtainable: 'Unavailable',
    },
  })
  ctx.game.np_communication_ids = ['NPWR22997_00']
  expect(todaysFocus(ctx)).toEqual({ phases: [] })
})

test('English lists bind uniquely and a full counter never completes an objective', () => {
  const trophies = list().map((t) => ({
    ...t,
    name: t.nameEn ?? t.name,
    nameEn: undefined,
    progressValue: 100,
    progressTarget: 100,
  }))
  const p = evaluateJourney(requiem, trophies)
  expect(p.covered).toBe(36)
  expect(p.items.every((x) => x.state !== 'complete')).toBe(true)
  expect(p.next?.objective.key).toBe('perfect-shot')
})
