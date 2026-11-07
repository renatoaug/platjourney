import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import { noticeWritten } from '../src/notice-scope.ts'
import * as notify from '../src/notify.ts'
import type { Plugin, PluginContext } from '../src/plugins.ts'
import {
  aroundModel,
  aroundNotice,
  emit,
  loadPlugins,
  pluginRoute,
  projectGame,
  Refused,
  registerPlugin,
  resetPlugins,
  setHookTimeout,
} from '../src/plugins.ts'
import * as activity from '../src/repository/activity.ts'
import type { User } from '../src/repository/user.ts'
import * as users from '../src/repository/user.ts'
import { makeUser } from './fixtures.ts'

const user = { id: 'user:u1', psn_online_id: 'jogador' } as User
afterEach(() => {
  resetPlugins()
  mock.restore()
})

test('without plugins, model work just runs and nothing answers /api/ext/', async () => {
  expect(await aroundModel({ user, action: 'chat' }, async () => 'ok')).toBe('ok')
  expect(pluginRoute('/api/ext/anything')).toBeUndefined()
})

test('a plugin loaded from PLUGINS answers its route', async () => {
  await loadPlugins(` ${import.meta.dir}/fixtures/plugin.ts , `)
  const route = pluginRoute('/api/ext/fixture/ping')
  expect(route?.public).toBe(false)
  expect(pluginRoute('/api/fixture/ping')).toBeUndefined()
})

test('two plugins cannot take the same route', async () => {
  const taken = { name: 'a', register: (ctx: PluginContext) => ctx.route('x', async () => {}) }
  await registerPlugin(taken)
  expect(registerPlugin({ ...taken, name: 'b' })).rejects.toThrow('route x is taken')
})

test('beforeModel can refuse the work, and modelFailed hears when it throws', async () => {
  const failed = mock(async () => {})
  await registerPlugin({
    name: 'gate',
    register(ctx) {
      ctx.beforeModel(async ({ action }) => {
        if (action === 'plan') throw new Refused('no_plan', 'Sem plano', 402)
      })
      ctx.modelFailed(failed)
    },
  })
  const run = mock(async () => 'ok')
  expect(aroundModel({ user, action: 'plan' }, run)).rejects.toBeInstanceOf(Refused)
  expect(run).not.toHaveBeenCalled()
  expect(
    aroundModel({ user, action: 'chat' }, async () => Promise.reject(new Error('down'))),
  ).rejects.toThrow('down')
  await Bun.sleep(0)
  expect(failed).toHaveBeenCalledWith({ user, action: 'chat' })
})

test('events reach their listeners', async () => {
  const deleted = mock(async () => {})
  await registerPlugin({ name: 'listen', register: (ctx) => ctx.on('user:deleted', deleted) })
  await emit('user:deleted', user)
  expect(deleted).toHaveBeenCalledWith(user)
})

test("a plugin gets the app's helpers through its context, so it imports nothing at runtime", async () => {
  let seen: Parameters<Plugin['register']>[0] | undefined
  await registerPlugin({
    name: 'helpers',
    register(ctx) {
      seen = ctx
    },
  })
  expect(seen?.api).toBe(5)
  expect(seen?.Refused).toBe(Refused)
  expect(typeof seen?.db.q).toBe('function')
  expect(typeof seen?.json).toBe('function')
  expect(typeof seen?.readBody).toBe('function')
})

test('a plugin can notify a player like the app does, never the demo or a gone account', async () => {
  let ctx: Parameters<Plugin['register']>[0] | undefined
  await registerPlugin({
    name: 'notifier',
    register(c) {
      ctx = c
    },
  })
  const player = makeUser({ id: 'user:n1' })
  const get = spyOn(users, 'getUser').mockImplementation(async (id) =>
    id === 'user:n1' ? player : id === 'user:demo' ? makeUser({ id, demo: true }) : undefined,
  )
  const log = spyOn(activity, 'logTip').mockResolvedValue(undefined)
  const send = spyOn(notify, 'deliver').mockResolvedValue(undefined)
  await ctx?.notify('user:n1', '🎁 Você ganhou **30 créditos**')
  expect(log).toHaveBeenCalledWith('user:n1', 'server', '🎁 Você ganhou **30 créditos**')
  expect(send).toHaveBeenCalledWith(player, '🎁 Você ganhou **30 créditos**')
  await ctx?.notify('user:demo', 'oi')
  await ctx?.notify('user:gone', 'oi')
  expect(log).toHaveBeenCalledTimes(1)
  expect(get).toHaveBeenCalledTimes(3)
})

test('game views keep source identity without a projector', async () => {
  const source = { guide: { tips: ['one'] }, trophies: [{ earned: true }] }
  expect(await projectGame({ user, game: 'game:one', surface: 'title' }, source)).toBe(source)
})

test('game projectors compose on a deep copy separately for each player', async () => {
  const source = { guide: { tips: ['one'] }, trophies: [{ earned: true }] }
  await registerPlugin({
    name: 'first',
    register(ctx) {
      ctx.projectGame(async ({ user: player, value }) => {
        const view = value as typeof source
        if (player.id === user.id) view.guide.tips.length = 0
        return view
      })
    },
  })
  await registerPlugin({
    name: 'second',
    register(ctx) {
      ctx.projectGame(async ({ value }) => ({ ...(value as object), viewed: true }))
    },
  })
  const projected = await projectGame({ user, game: 'game:one', surface: 'title' }, source)
  expect(projected.guide.tips).toEqual([])
  expect(projected.trophies).toEqual(source.trophies)
  expect(source.guide.tips).toEqual(['one'])
  const other = await projectGame(
    { user: { ...user, id: 'user:other' }, game: 'game:one', surface: 'title' },
    source,
  )
  expect(other.guide.tips).toEqual(['one'])
  expect(other).toHaveProperty('viewed', true)
})

test('a failed or stalled projector never falls back to the source', async () => {
  await registerPlugin({
    name: 'broken',
    register(ctx) {
      ctx.projectGame(async () => {
        throw new Error('view failed')
      })
    },
  })
  await expect(
    projectGame({ user, game: 'game:one', surface: 'current' }, { guide: 'source' }),
  ).rejects.toThrow('view failed')
  resetPlugins()
  setHookTimeout(5)
  await registerPlugin({
    name: 'stalled',
    register(ctx) {
      ctx.projectGame(async () => new Promise(() => {}))
    },
  })
  await expect(
    projectGame({ user, game: 'game:one', surface: 'current' }, { guide: 'source' }),
  ).rejects.toBeInstanceOf(Refused)
})

test('a notice settles with whether anything in it was written, also when it throws', async () => {
  const outcomes: boolean[] = []
  const notice = { kind: 'unlock', key: 'unlock:game:one:NP:2' }
  // Without a listener the notice just runs.
  let ran = false
  await aroundNotice(user, 'game:one', notice, async () => {
    ran = true
  })
  expect(ran).toBe(true)
  await registerPlugin({
    name: 'ledger',
    register(ctx) {
      ctx.noticeSettled(async (outcome) => {
        expect(outcome).toMatchObject({ ...notice, user, game: 'game:one' })
        outcomes.push(outcome.written)
      })
    },
  })
  await aroundNotice(user, 'game:one', notice, async () => {
    await Promise.resolve()
    noticeWritten()
  })
  await aroundNotice(user, 'game:one', notice, async () => {})
  await expect(
    aroundNotice(user, 'game:one', notice, async () => {
      noticeWritten()
      throw new Error('send failed')
    }),
  ).rejects.toThrow('send failed')
  // Written outside a notice: nothing to settle.
  noticeWritten()
  expect(outcomes).toEqual([true, false, true])
})
