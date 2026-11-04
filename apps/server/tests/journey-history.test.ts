import { expect, test } from 'bun:test'
import { achievementHistory, earnedTimestamp } from '../../../shared/journey/history.ts'

test('confirmed history sorts absolute timestamps, not input order, names or trophy ids', () => {
  const trophies = [
    { id: 1, groupId: 'default', earned: true, earnedAt: '2024-01-03T12:00:00Z' },
    { id: 9, groupId: 'default', earned: true, earnedAt: '2024-01-02T09:00:00-03:00' },
    { id: 3, groupId: 'default', earned: false, earnedAt: '2024-01-01T12:00:00Z' },
  ]
  const before = structuredClone(trophies)
  expect(achievementHistory(trophies).dated.map((t) => t.id)).toEqual([9, 1])
  expect(earnedTimestamp(trophies[2])).toBeUndefined()
  expect(trophies).toEqual(before)
})

test('missing, invalid and date-only values remain undated; equal timestamps have a stable display tie', () => {
  const trophies = [
    undefined,
    'bad',
    '2024-01-01',
    '2024-01-01T00:00:00Z',
    '2024-01-01T00:00:00',
  ].map((earnedAt, id) => ({ id, groupId: 'default', earned: true, earnedAt }))
  const history = achievementHistory(trophies.toReversed())
  expect(history.undated.map((t) => t.id)).toEqual([0, 1, 2])
  expect(history.dated.map((t) => t.id)).toEqual([3, 4])
  expect(earnedTimestamp(history.dated[0])).toBe(earnedTimestamp(history.dated[1]))
})
