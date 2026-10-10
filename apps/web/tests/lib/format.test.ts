import { describe, expect, test } from 'bun:test'
import {
  compact,
  fmtClock,
  fmtDate,
  fmtDay,
  fmtHours,
  fmtLong,
  fmtMinutes,
  fmtReset,
  fmtTime,
  fmtWhen,
  number,
  pct,
} from '../../src/lib/format'

// Noon UTC: the same calendar day in every zone the tests might run in.
const NOON = '2026-03-05T12:00:00Z'

describe('fmtHours', () => {
  test('rounds ten hours and up', () => {
    expect(fmtHours(64.5)).toBe('65h')
    expect(fmtHours(10)).toBe('10h')
  })

  test('keeps the decimal below ten, with a comma', () => {
    expect(fmtHours(7.5)).toBe('7,5h')
    expect(fmtHours(3)).toBe('3h')
  })

  test('is empty without a number', () => {
    expect(fmtHours(null)).toBe('')
    expect(fmtHours(undefined)).toBe('')
  })
})

test('fmtDate shows the day in pt-BR, or nothing', () => {
  expect(fmtDate(NOON)).toBe('05/03/2026')
  expect(fmtDate(null)).toBe('')
})

describe('fmtWhen', () => {
  test('shows the short date and time', () => {
    expect(fmtWhen(NOON)).toMatch(/^05\/03\/2026, \d\d:\d\d$/)
  })

  test('reads a timestamp without a zone as UTC', () => {
    expect(fmtWhen('2026-03-05T12:00:00')).toBe(fmtWhen(NOON))
    expect(fmtWhen('2026-03-05T09:00:00-03:00')).toBe(fmtWhen(NOON))
  })

  test('is empty without a timestamp', () => {
    expect(fmtWhen('')).toBe('')
    expect(fmtWhen(undefined)).toBe('')
  })
})

test('pct clamps to 0..100 and treats junk as 0', () => {
  expect(pct(42)).toBe(42)
  expect(pct('70')).toBe(70)
  expect(pct(140)).toBe(100)
  expect(pct(-3)).toBe(0)
  expect(pct('abc')).toBe(0)
  expect(pct(undefined)).toBe(0)
})

test('number groups thousands the Brazilian way', () => {
  expect(number(1234567)).toBe('1.234.567')
  expect(number(null)).toBe('0')
})

test('compact shortens thousands to one decimal and a k', () => {
  expect(compact(1895)).toBe('1,9k')
  expect(compact(2408)).toBe('2,4k')
  expect(compact(12000)).toBe('12k')
  expect(compact(35)).toBe('35')
})

describe('fmtMinutes', () => {
  test('under an hour is minutes', () => {
    expect(fmtMinutes(45)).toBe('45 min')
    expect(fmtMinutes(29.6)).toBe('30 min')
  })

  test('an hour and up is hours, with padded minutes when there are any', () => {
    expect(fmtMinutes(60)).toBe('1h')
    expect(fmtMinutes(125)).toBe('2h05')
    expect(fmtMinutes(90)).toBe('1h30')
  })
})

test('clock and time show hours and minutes', () => {
  expect(fmtClock(NOON)).toMatch(/^\d\d:\d\d$/)
  expect(fmtTime(NOON)).toMatch(/^\d\d:\d\d$/)
})

test('fmtLong spells the month', () => {
  expect(fmtLong(NOON)).toBe('05 de mar. de 2026')
})

test('fmtReset shows the UTC calendar day of the reset', () => {
  expect(fmtReset('2026-10-01T00:00:00Z')).toBe('1 de outubro')
})

describe('fmtDay', () => {
  test('today and yesterday by name', () => {
    expect(fmtDay(new Date().toISOString())).toBe('Hoje')
    expect(fmtDay(new Date(Date.now() - 86_400_000).toISOString())).toBe('Ontem')
  })

  test('older days with the weekday, capitalized', () => {
    expect(fmtDay(NOON)).toBe('Quinta-feira, 5 de março')
  })
})
