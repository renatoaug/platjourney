import './env.ts'
import { afterEach, expect, test } from 'bun:test'
import type { Guide } from '../src/guide.ts'
import { forgetHooks, hookFor, pickHook } from '../src/hooks.ts'
import { makeContext, makeTrophy } from './fixtures.ts'

afterEach(() => forgetHooks())

// Twenty base trophies and a platinum, `earned` of them done.
const list = (earned: number, over: Parameters<typeof makeTrophy>[0][] = []) => [
  ...Array.from({ length: 20 }, (_, i) =>
    makeTrophy({ id: i + 1, name: `T${i + 1}`, earned: i < earned, ...over[i] }),
  ),
  makeTrophy({ id: 99, name: 'Platina', type: 'platinum' }),
]
const guide = (missables: Guide['missables']) => ({ missables }) as Guide

test('a missable still open comes first, with when it happens', () => {
  const ctx = makeContext({
    trophies: list(1),
    guide: guide([
      { trophy: 'T1', when: 'capítulo 1', how: '' },
      { trophy: 't5', when: 'capítulo 7', how: '' },
    ]),
  })
  expect(pickHook(ctx)).toStartWith('ainda falta o perdível t5 (capítulo 7)')
})

test('a progress mark a trophy or two away is the next reason', () => {
  expect(pickHook(makeContext({ trophies: list(9) }))).toStartWith(
    'falta 1 troféu pra 50% da platina',
  )
  expect(pickHook(makeContext({ trophies: list(13) }))).toStartWith('faltam 2 troféus pra 75%')
  expect(pickHook(makeContext({ trophies: list(6) }))).toBeNull()
})

test('else the rarest trophy missing, never a hidden one', () => {
  const trophies = list(6, [
    ...Array.from({ length: 10 }, () => ({})),
    { earnedRate: 3.2 },
    { earnedRate: 1.1, hidden: true },
    { earnedRate: 4 },
  ])
  expect(pickHook(makeContext({ trophies }))).toStartWith(
    'o troféu mais raro que falta é T11 (3.2%',
  )
})

test('nothing for a platinum earned, a game not owned or nothing to say', () => {
  const done = list(20).map((t) => ({ ...t, earned: true }))
  expect(pickHook(makeContext({ trophies: done }))).toBeNull()
  expect(pickHook(makeContext({ trophies: list(9), owned: false }))).toBeNull()
  expect(pickHook(makeContext({ trophies: list(6) }))).toBeNull()
})

test('one hook a day per player and game', () => {
  const ctx = makeContext({ trophies: list(9) })
  const day = new Date('2026-11-06T10:00:00Z')
  expect(hookFor('user:a', ctx, day)).not.toBeNull()
  expect(hookFor('user:a', ctx, day)).toBeNull()
  expect(hookFor('user:b', ctx, day)).not.toBeNull()
  expect(hookFor('user:a', ctx, new Date('2026-11-07T10:00:00Z'))).not.toBeNull()
})
