import { expect, test } from 'bun:test'
import { aiContext } from '../src/ai-context.ts'
import { makeContext, makeUser } from './api-fixtures.ts'

test('missing facts go to the service as null', () => {
  const ctx = makeContext()
  expect(aiContext(ctx, makeUser())).toEqual({
    game: ctx.game,
    title: ctx.title,
    trophies: ctx.trophies,
    guide: null,
    groups: null,
    hoursPlayed: null,
    includeDlcProgress: false,
    owned: true,
  })
})

test('the DLC preference and hours ride along', () => {
  const ctx = makeContext({ hoursPlayed: 12 })
  const out = aiContext(ctx, makeUser({ include_dlc_progress: true }))
  expect(out.hoursPlayed).toBe(12)
  expect(out.includeDlcProgress).toBe(true)
})

test('a game outside the library goes as not owned', () => {
  expect(aiContext({ ...makeContext(), owned: false }, makeUser()).owned).toBe(false)
})
