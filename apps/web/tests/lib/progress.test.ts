import { expect, test } from 'bun:test'
import { shownProgress } from '../../src/lib/progress'

const base = { earned: 12, total: 46 }
const dlc = { earned: 0, total: 15 }

test('counts the base game only by default', () => {
  expect(shownProgress(base, dlc, false)).toEqual({
    earned: 12,
    total: 46,
    progress: 26,
    withDlc: false,
  })
})

test('adds the DLC when the player asked for it', () => {
  expect(shownProgress(base, dlc, true)).toEqual({
    earned: 12,
    total: 61,
    progress: 20,
    withDlc: true,
  })
})

test('a game without DLC stays on the base game', () => {
  expect(shownProgress(base, null, true).withDlc).toBe(false)
  expect(shownProgress(base, undefined, true).total).toBe(46)
})

test('an empty list is 0%, not NaN', () => {
  expect(shownProgress({ earned: 0, total: 0 }, null, false).progress).toBe(0)
})
