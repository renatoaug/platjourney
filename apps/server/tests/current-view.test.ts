import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import * as deepguide from '../src/deepguide.ts'
import { registerPlugin, resetPlugins } from '../src/plugins.ts'
import { currentView } from '../src/routes/api.ts'
import * as tint from '../src/tint.ts'
import { makeContext, makeTrophy, makeUser } from './fixtures.ts'

const user = makeUser()
const ctx = makeContext({
  trophies: [makeTrophy({ id: 1, name: 'Primeiro', earned: true }), makeTrophy({ id: 2 })],
})

beforeEach(() => {
  spyOn(deepguide, 'deepGuideStats').mockResolvedValue(null)
  spyOn(tint, 'withTints').mockImplementation(async (games) => games)
})

afterEach(() => {
  resetPlugins()
  mock.restore()
})

test('the current game view is the context itself without a plugin', async () => {
  const view = await currentView(user, ctx)
  expect(view?.game).toEqual(ctx.game)
  expect(view?.trophies).toBe(ctx.trophies)
  expect(view?.owned).toBe(true)
  expect(await currentView(user, undefined)).toBeUndefined()
})

test('a plugin reshapes the current game view per player, never the cached context', async () => {
  const seen: unknown[] = []
  await registerPlugin({
    name: 'views',
    register(c) {
      c.projectGame(async ({ surface, game, value }) => {
        seen.push({ surface, game })
        const view = value as { trophies: unknown[]; focus: unknown }
        view.trophies.length = 0
        view.focus = null
        return view
      })
    },
  })
  const view = await currentView(user, ctx)
  expect(seen).toEqual([{ surface: 'current', game: ctx.game.id }])
  expect(view?.trophies).toEqual([])
  expect(view?.focus).toBeNull()
  expect(ctx.trophies).toHaveLength(2)
})
