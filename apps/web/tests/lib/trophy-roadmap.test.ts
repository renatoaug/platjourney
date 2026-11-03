import { expect, test } from 'bun:test'
import { current } from '../../src/fixtures'
import { trophyAdvice, trophyRoadmap } from '../../src/lib/trophy-roadmap'
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
