import { expect, test } from 'bun:test'
import { current } from '../../src/fixtures'
import {
  ongoingObjectives,
  personalRoadmap,
  trophyAdvice,
  trophyRoadmap,
} from '../../src/lib/trophy-roadmap'
import type { GuideDetail, Trophy } from '../../src/lib/types'

const trophy = (id: number, name: string, extra: Partial<Trophy> = {}): Trophy => ({
  id,
  name,
  detail: 'Objective',
  groupId: 'default',
  type: 'bronze',
  earned: false,
  ...extra,
})
const guide = (roadmap: GuideDetail['roadmap']): GuideDetail => ({
  ...(current.guide as GuideDetail),
  roadmap,
})

test('each trophy appears once, matches translated names, and earned state never changes order', () => {
  const items = [
    trophy(0, 'Platina', { type: 'platinum' }),
    trophy(1, 'Início', { nameEn: 'Start', earned: true }),
    trophy(2, 'Final'),
    trophy(3, 'Extra', { groupId: '001' }),
  ]
  const result = trophyRoadmap(
    items,
    guide([
      { phase: 'First', goal: '', trophies: ['Start', 'Final'] },
      { phase: 'Cleanup', goal: '', trophies: ['inicio', 'Missing title'] },
    ]),
  )
  expect(result.map((s) => s.kind)).toEqual(['phase', 'platinum', 'dlc'])
  expect(result.flatMap((s) => s.trophies.map((x) => x.id))).toEqual([1, 2, 0, 3])
  expect(items[1].earned).toBe(true)
})

test('missing guide and ambiguous names stay unplaced without dropping trophies or inventing platinum', () => {
  const items = [trophy(1, 'Same'), trophy(2, 'Same'), trophy(3, 'Unknown')]
  expect(trophyRoadmap(items).map((s) => s.kind)).toEqual(['unplaced'])
  const result = trophyRoadmap(items, guide([{ phase: 'A', goal: '', trophies: ['Same'] }]))
  expect(result).toEqual([{ kind: 'unplaced', trophies: items }])
  expect(trophyRoadmap([], null)).toEqual([])
})

test('advice only uses an exact localized match and keeps absent advice absent', () => {
  const g = guide([])
  g.tricks = [{ trophy: 'Start', trick: 'Actual guide tip' }]
  g.missables = [{ trophy: 'Início', how: 'Do this', when: 'Before leaving' }]
  expect(trophyAdvice(trophy(1, 'Início', { nameEn: 'Start' }), g).trick).toBe('Actual guide tip')
  expect(trophyAdvice(trophy(1, 'Início'), g).warning?.how).toBe('Do this')
  expect(trophyAdvice(trophy(1, 'Start again'), g).trick).toBeUndefined()
})

test('ongoing objectives require explicit evidence and preserve unknown progress', () => {
  const items = [
    trophy(1, 'Stealth'),
    trophy(2, 'Collect'),
    trophy(3, 'Count', { progressTarget: 10, progressValue: 0 }),
    trophy(4, 'Ordinary'),
  ]
  const g = guide([
    { phase: 'A', goal: '', trophies: ['Collect'] },
    { phase: 'B', goal: '', trophies: ['Collect'] },
  ])
  g.missables = [
    { trophy: 'Stealth', when: 'Durante a campanha e New Game+.', how: 'Keep the habit.' },
    { trophy: 'Ordinary', when: 'Before chapter 2.', how: 'One event.' },
  ]
  expect(ongoingObjectives(items, g).map((x) => [x.trophy.id, x.basis])).toEqual([
    [1, 'duration'],
    [2, 'repeated'],
    [3, 'counter'],
  ])
  expect(ongoingObjectives(items, g)[0]?.trophy.progressValue).toBeUndefined()
  expect(
    ongoingObjectives(
      items.map((t) => ({ ...t, earned: true })),
      g,
    ),
  ).toEqual([])
  expect(
    ongoingObjectives(
      items.map((t) => ({ ...t, hidden: true })),
      g,
    ),
  ).toEqual([])
  expect(
    ongoingObjectives(
      items.map((t) => ({ ...t, groupId: '001' })),
      g,
    ),
  ).toEqual([])
  expect(ongoingObjectives(items, null).map((x) => x.trophy.id)).toEqual([3])
  expect(items.every((t) => !t.earned)).toBe(true)
})

test('ambiguous matches and incidental campaign text do not create ongoing objectives', () => {
  const g = guide([{ phase: 'A', goal: '', trophies: ['Same', 'Same'] }])
  g.missables = [
    { trophy: 'Same', when: 'Durante a campanha.', how: 'Tip' },
    { trophy: 'Other', when: 'Não é necessário durante a campanha.', how: 'Tip' },
  ]
  expect(ongoingObjectives([trophy(1, 'Same'), trophy(2, 'Same'), trophy(3, 'Other')], g)).toEqual(
    [],
  )
})

test('start guidance links explicit unique trophy names without matching parts of other names', () => {
  const g = {
    ...guide([]),
    earlyTips: [
      'Aceite contratos enquanto explora para adiantar **Contratos em dia**.',
      'Explore every island for Island Explorer.',
      'A generic exploration tip without a trophy name.',
    ],
    missables: [],
  }
  const items = [
    trophy(1, 'Contratos em dia'),
    trophy(2, 'Ilhas', { nameEn: 'Island Explorer' }),
    trophy(3, 'Dia'),
    trophy(4, 'Contratos em dias extras'),
  ]
  const result = ongoingObjectives(items, g)
  expect(result.map((entry) => [entry.trophy.id, entry.basis])).toEqual([
    [1, 'early'],
    [2, 'early'],
  ])
  expect(result[0].early).toBe(g.earlyTips[0])
  expect(ongoingObjectives([items[0], { ...items[0], id: 9 }], g)).toEqual([])
})

test('personal route separates confirmed dates, undated history, pending priorities and DLC', () => {
  const a = trophy(1, 'Later achievement', { earned: true, earnedAt: '2024-01-03T12:00:00Z' })
  const b = trophy(9, 'Earlier achievement', { earned: true, earnedAt: '2024-01-02T12:00:00Z' })
  const unknown = trophy(2, 'Undated', { earned: true })
  const next = trophy(5, 'Next')
  const future = trophy(4, 'Future')
  const extra = trophy(1, 'Extra', {
    earned: true,
    groupId: '001',
    earnedAt: '2024-01-01T12:00:00Z',
  })
  const source = [a, future, unknown, b, next, extra]
  const before = structuredClone(source)
  expect(personalRoadmap(source, [next, future])).toEqual([b, a, unknown, next, future, extra])
  expect(source).toEqual(before)
  const preview = source.map((t) => ({ ...t, earned: false, earnedAt: undefined }))
  expect(personalRoadmap(preview)).toEqual(preview)
})
