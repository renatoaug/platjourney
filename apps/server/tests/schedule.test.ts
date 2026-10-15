import './env.ts'
import { expect, test } from 'bun:test'
import { brazilWeekday, untilNext } from '../src/schedule.ts'

const HOUR = 3_600_000
// 2026-10-15 09:00 in Brazil is 12:00 UTC.
const nineInBrazil = Date.UTC(2026, 9, 15, 12, 0)

test('the next run is later today when the hour has not come yet in Brazil', () => {
  expect(untilNext(10, 0, nineInBrazil)).toBe(HOUR)
  expect(untilNext(9, 30, nineInBrazil)).toBe(HOUR / 2)
})

test('an hour already gone in Brazil runs tomorrow', () => {
  expect(untilNext(9, 0, nineInBrazil)).toBe(24 * HOUR)
  expect(untilNext(4, 30, nineInBrazil)).toBe(19.5 * HOUR)
})

test('the weekday is Brazil’s, not UTC’s', () => {
  // Saturday 22:00 in Brazil is already Sunday 01:00 in UTC.
  expect(brazilWeekday(Date.UTC(2026, 9, 18, 1, 0))).toBe(6)
  expect(brazilWeekday(Date.UTC(2026, 9, 18, 3, 0))).toBe(0)
})
