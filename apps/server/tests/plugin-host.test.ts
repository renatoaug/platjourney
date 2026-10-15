// How the host keeps a plugin in its lane: what it may add to the page's policy, how long its hooks
// may take, and the demo's read-only rule in front of its interceptors.
import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import * as auth from '../src/auth.ts'
import { type PageDirective, pageSourceProblem } from '../src/http.ts'
import {
  aroundModel,
  emit,
  pluginPagePolicy,
  Refused,
  registerPlugin,
  resetPlugins,
  setHookTimeout,
} from '../src/plugins.ts'
import { resetRateLimits } from '../src/rate-limit.ts'
import type { User } from '../src/repository/user.ts'
import { handle } from '../src/web.ts'
import { makeUser } from './api-fixtures.ts'

const user = { id: 'user:u1', psn_online_id: 'jogador' } as User
const hang = () => new Promise<void>(() => {})

beforeEach(() => {
  resetRateLimits()
  spyOn(console, 'error').mockImplementation(() => {})
  spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  resetPlugins()
  mock.restore()
})

async function send(method: string, url: string) {
  const req = Object.assign(Readable.from([]), { method, url, headers: {} })
  const res = {
    status: 0,
    body: '',
    headersSent: false,
    writableEnded: false,
    setHeader() {},
    writeHead(status: number) {
      res.status = status
      res.headersSent = true
      return res
    },
    end(body: unknown = '') {
      res.body = String(body)
      res.writableEnded = true
      return res
    },
  }
  await handle(req as unknown as IncomingMessage, res as unknown as ServerResponse)
  return { status: res.status, body: res.body ? JSON.parse(res.body) : undefined }
}

const allow = (directive: string, ...sources: string[]) =>
  registerPlugin({
    name: 'csp',
    register: (ctx) => ctx.allowOnPage(directive as PageDirective, ...sources),
  })

test('allowOnPage takes https hosts, with a subdomain wildcard and a path', async () => {
  // What the ads plugin asks for.
  const google = [
    'https://*.googlesyndication.com',
    'https://*.doubleclick.net',
    'https://*.google.com',
    'https://*.adtrafficquality.google',
  ]
  await allow('script-src', ...google, 'https://*.gstatic.com')
  await allow('frame-src', ...google)
  await allow('connect-src', ...google, 'https://api.example.com:8443/v1/')
  await allow('img-src', 'data:', 'blob:', "'self'")
  await allow('font-src', 'data:')
  const policy = pluginPagePolicy()
  expect(policy).toContain('https://*.gstatic.com;')
  expect(policy).toContain('https://api.example.com:8443/v1/;')
  expect(policy).toEndWith("form-action 'self'")
})

test('allowOnPage refuses anything that would add a directive or weaken the policy', async () => {
  const bad: [string, string][] = [
    ['script-src', 'https://x.example; frame-ancestors *'],
    ['script-src', 'https://x.example,https://y.example'],
    ['script-src', 'https://x.example https://y.example'],
    ['script-src', 'https://x.example\nframe-ancestors *'],
    ['script-src', "'unsafe-inline'"],
    ['script-src', "'unsafe-eval'"],
    ['script-src', "'strict-dynamic'"],
    ['script-src', "'nonce-abc'"],
    ['script-src', '*'],
    ['script-src', 'https:'],
    ['script-src', 'data:'],
    ['script-src', 'blob:'],
    ['script-src', 'http://x.example'],
    ['script-src', 'https://*'],
    ['script-src', 'https://*.com'],
    ['script-src', 'x.example'],
    ['frame-src', 'data:'],
    ['connect-src', 'https://x.example/"a'],
    ['frame-ancestors', 'https://x.example'],
    ['default-src', 'https://x.example'],
  ]
  for (const [directive, source] of bad) {
    expect(pageSourceProblem(directive, source)).toBeString()
    expect(allow(directive, source)).rejects.toThrow('plugin csp: allowOnPage:')
  }
  expect(pluginPagePolicy()).not.toContain('x.example')
})

test('a beforeModel hook that hangs refuses the work instead of holding it', async () => {
  setHookTimeout(20)
  const run = mock(async () => 'ok')
  await registerPlugin({ name: 'slow', register: (ctx) => ctx.beforeModel(hang) })
  const refused = await aroundModel({ user, action: 'chat' }, run).catch((e) => e)
  expect(refused).toBeInstanceOf(Refused)
  expect(refused).toMatchObject({ code: 'plugin_timeout', status: 503 })
  expect(run).not.toHaveBeenCalled()
})

test('when a later beforeModel refuses, the plugins that already ran give back what they took', async () => {
  const gaveBack: string[] = []
  await registerPlugin({
    name: 'credits',
    register(ctx) {
      ctx.beforeModel(async () => {})
      ctx.modelFailed(async () => {
        gaveBack.push('credits')
      })
    },
  })
  await registerPlugin({
    name: 'gate',
    register(ctx) {
      ctx.beforeModel(async () => {
        throw new Refused('no', 'Não', 402)
      })
      ctx.modelFailed(async () => {
        gaveBack.push('gate')
      })
    },
  })
  const run = mock(async () => 'ok')
  expect(aroundModel({ user, action: 'chat' }, run)).rejects.toMatchObject({ code: 'no' })
  await Bun.sleep(0)
  expect(gaveBack).toEqual(['credits'])
  expect(run).not.toHaveBeenCalled()
})

test('a beforeModel hook that finishes after its timeout gives back what it took', async () => {
  setHookTimeout(10)
  const gaveBack = mock(async () => {})
  let finish = () => {}
  await registerPlugin({
    name: 'late',
    register(ctx) {
      ctx.beforeModel(() => new Promise<void>((resolve) => (finish = resolve)))
      ctx.modelFailed(gaveBack)
    },
  })
  expect(aroundModel({ user, action: 'chat' }, async () => 'ok')).rejects.toBeInstanceOf(Refused)
  await Bun.sleep(30)
  expect(gaveBack).not.toHaveBeenCalled()
  finish()
  await Bun.sleep(0)
  expect(gaveBack).toHaveBeenCalledTimes(1)
})

test('a listener that hangs is logged and the next one still runs', async () => {
  setHookTimeout(20)
  const next = mock(async () => {})
  await registerPlugin({ name: 'slow', register: (ctx) => ctx.on('user:deleted', hang) })
  await registerPlugin({ name: 'fast', register: (ctx) => ctx.on('user:deleted', next) })
  await emit('user:deleted', user)
  expect(next).toHaveBeenCalledWith(user)
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining('slow: user:deleted'))
})

test('an interceptor that hangs fails that request', async () => {
  setHookTimeout(20)
  spyOn(auth, 'authenticate').mockResolvedValue(makeUser())
  await registerPlugin({ name: 'slow', register: (ctx) => ctx.intercept('/ads.txt', hang) })
  expect((await send('GET', '/ads.txt')).status).toBe(500)
})

test('interceptors only see the demo read', async () => {
  spyOn(auth, 'authenticate').mockResolvedValue(makeUser({ id: 'user:demo', demo: true }))
  const ran: string[] = []
  await registerPlugin({
    name: 'demo-fixture',
    register(ctx) {
      ctx.intercept('/api/*', async ({ method }) => {
        ran.push(method)
      })
    },
  })
  const res = await send('POST', '/api/chat')
  expect(res).toMatchObject({ status: 403, body: { error: 'demo_read_only' } })
  expect(ran).toEqual([])
})
