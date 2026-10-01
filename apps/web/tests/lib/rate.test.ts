import { afterEach, expect, test } from 'bun:test'
import { setLocale } from '../../src/i18n/locale'
import { fmtRate } from '../../src/lib/format'

afterEach(() => setLocale('pt-BR', { persist: false }))

test('a trophy rate shows at most one decimal, in the active locale', () => {
  expect(fmtRate(11.700000000000001)).toBe('11,7')
  expect(fmtRate(3)).toBe('3')
  setLocale('en', { persist: false })
  expect(fmtRate(11.700000000000001)).toBe('11.7')
})

test('a missing rate shows nothing', () => {
  expect(fmtRate(undefined)).toBe('')
  expect(fmtRate(null)).toBe('')
})
