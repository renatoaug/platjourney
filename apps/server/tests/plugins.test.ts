import { afterEach, expect, mock, test } from 'bun:test'
import type { Plugin, PluginContext } from '../src/plugins.ts'
import {
  aroundModel,
  emit,
  loadPlugins,
  pluginRoute,
  Refused,
  registerPlugin,
  resetPlugins,
} from '../src/plugins.ts'
import type { User } from '../src/repository/user.ts'

const user = { id: 'user:u1', psn_online_id: 'jogador' } as User
afterEach(() => resetPlugins())

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
  expect(seen?.api).toBe(3)
  expect(seen?.Refused).toBe(Refused)
  expect(typeof seen?.db.q).toBe('function')
  expect(typeof seen?.json).toBe('function')
  expect(typeof seen?.readBody).toBe('function')
})
