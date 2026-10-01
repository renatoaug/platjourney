import './env.ts'
import { expect, test } from 'bun:test'
import { shownProgress } from '../src/progress.ts'
import { makeGroups, makeTitle, makeUser } from './fixtures.ts'

const dlc = {
  earned: 1,
  total: 10,
  remaining: 9,
  earnedByType: makeGroups().base.earnedByType,
  definedByType: makeGroups().base.definedByType,
}

test('without groups the PSN numbers are shown as they are', () => {
  expect(shownProgress(makeUser(), makeTitle(), null)).toEqual({
    earned: 10,
    total: 20,
    progress: 50,
    label: '',
  })
})

test('the base game alone is shown by default', () => {
  expect(shownProgress(makeUser(), makeTitle(), makeGroups({ dlc }))).toEqual({
    earned: 5,
    total: 10,
    progress: 50,
    label: ' do jogo base',
  })
})

test('DLC is counted in when the player asked for it', () => {
  const user = makeUser({ include_dlc_progress: true })
  expect(shownProgress(user, makeTitle(), makeGroups({ dlc }))).toEqual({
    earned: 6,
    total: 20,
    progress: 30,
    label: ' com DLC',
  })
})

test('a game without DLC has no label and an empty one has no progress', () => {
  expect(
    shownProgress(makeUser({ include_dlc_progress: true }), makeTitle(), makeGroups()).label,
  ).toBe('')
  const empty = makeGroups()
  empty.base = { ...empty.base, earned: 0, total: 0 }
  expect(shownProgress(makeUser(), makeTitle(), empty).progress).toBe(0)
})
