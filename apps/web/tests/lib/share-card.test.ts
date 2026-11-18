import { expect, test } from 'bun:test'
import { daysToPlatinum, rarityKey } from '../../src/lib/share-card'
import { columnsFor } from '../../src/lib/share-collection'

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

test('a collection gets fewer, bigger covers across when it is small', () => {
  expect(columnsFor(1)).toBe(3)
  expect(columnsFor(3)).toBe(3)
  expect(columnsFor(5)).toBe(4)
  expect(columnsFor(12)).toBe(6)
  expect(columnsFor(38)).toBe(8)
  expect(columnsFor(120)).toBe(10)
})
