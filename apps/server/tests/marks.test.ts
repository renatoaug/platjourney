import { expect, test } from 'bun:test'
import { markCheer, progressMark } from '../src/marks.ts'
import { makeTrophy, makeUser } from './fixtures.ts'

// Twenty base trophies, the first `earned` of them earned, plus a platinum and a DLC trophy.
const list = (earned: number, platinum = false) => [
  ...Array.from({ length: 20 }, (_, i) =>
    makeTrophy({ id: i + 1, name: `T${i + 1}`, earned: i < earned }),
  ),
  makeTrophy({ id: 100, name: 'Platina', type: 'platinum', earned: platinum }),
  makeTrophy({ id: 200, name: 'DLC', groupId: '001', earned: false }),
]
const just = (trophies: ReturnType<typeof list>, ...ids: number[]) =>
  trophies.filter((t) => ids.includes(t.id))

test('the first trophy of a game is marked', () => {
  const t = list(1)
  expect(progressMark(t, just(t, 1))?.kind).toBe('first')
})

test('crossing half of the base game is marked, once', () => {
  const t = list(10)
  expect(progressMark(t, just(t, 10))).toMatchObject({ kind: 'half', earned: 10, total: 20 })
  const after = list(11)
  expect(progressMark(after, just(after, 11))).toBeUndefined()
})

test('entering the final stretch lists what is left of the base game', () => {
  const t = list(17)
  expect(progressMark(t, just(t, 17))).toMatchObject({
    kind: 'final',
    remaining: ['T18', 'T19', 'T20'],
  })
  const deeper = list(18)
  expect(progressMark(deeper, just(deeper, 18))).toBeUndefined()
})

test('the platinum wins over any other mark, and an unlock with no mark has none', () => {
  const t = list(20, true)
  expect(progressMark(t, just(t, 20, 100))?.kind).toBe('platinum')
  const mid = list(5)
  expect(progressMark(mid, just(mid, 5))).toBeUndefined()
  expect(progressMark(mid, [])).toBeUndefined()
})

test('each mark has a few lines of our own, in the language of the player', () => {
  const pt = makeUser()
  expect(markCheer(pt, 'first', 0)).toStartWith('O primeiro caiu!')
  expect(markCheer(pt, 'platinum', 0.99)).toStartWith('Que platina!')
  expect(markCheer({ ...pt, locale: 'en' }, 'half', 0.5)).toStartWith('Past the halfway mark')
})
