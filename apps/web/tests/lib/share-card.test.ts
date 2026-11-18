import { expect, test } from 'bun:test'
import { daysToPlatinum, rarityKey } from '../../src/lib/share-card'

test("the rarity's name follows PSN's bands", () => {
  expect(rarityKey(0.4)).toBe('ultraRare')
  expect(rarityKey(5)).toBe('ultraRare')
  expect(rarityKey(12)).toBe('veryRare')
  expect(rarityKey(33)).toBe('rare')
  expect(rarityKey(80)).toBe('common')
})

test('days to the platinum count calendar days from the first trophy', () => {
  expect(daysToPlatinum('2026-10-21T21:43:16Z', '2026-11-05T14:02:57Z')).toBe(15)
  expect(daysToPlatinum('2026-11-05T09:00:00Z', '2026-11-05T22:00:00Z')).toBe(0)
  expect(daysToPlatinum(null, '2026-11-05T14:02:57Z')).toBeNull()
})
