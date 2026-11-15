import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { disablePush, enablePush, pushState } from '../../src/lib/push'
import { mockApi } from '../support/web'

// A browser with push: a service worker registration, its push manager and the permission.
interface Fake {
  permission: NotificationPermission
  sub: { endpoint: string; toJSON: () => object; unsubscribe: ReturnType<typeof mock> } | null
  subscribe: ReturnType<typeof mock>
  register: ReturnType<typeof mock>
  ask: NotificationPermission
}
let fake: Fake

const sub = () => ({
  endpoint: 'https://push.example/a',
  toJSON: () => ({ endpoint: 'https://push.example/a', keys: { p256dh: 'k', auth: 's' } }),
  unsubscribe: mock(async () => true),
})

function browser(over: Partial<Fake> = {}) {
  const pushManager = {
    getSubscription: async () => fake.sub,
    subscribe: mock(async () => {
      fake.sub = sub()
      return fake.sub
    }),
  }
  fake = {
    permission: 'default',
    sub: null,
    subscribe: pushManager.subscribe,
    register: mock(async () => ({ pushManager })),
    ask: 'granted',
    ...over,
  }
  const reg = { pushManager }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistration: async () => reg,
      register: fake.register,
      ready: Promise.resolve(reg),
    },
  })
  Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} })
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: {
      get permission() {
        return fake.permission
      },
      requestPermission: async () => {
        fake.permission = fake.ask
        return fake.ask
      },
    },
  })
}

function noPush(agent: string) {
  delete (navigator as unknown as Record<string, unknown>).serviceWorker
  delete (window as unknown as Record<string, unknown>).PushManager
  delete (window as unknown as Record<string, unknown>).Notification
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: agent })
}

beforeEach(() => browser())

afterEach(() => {
  mock.restore()
  delete (window as unknown as Record<string, unknown>).Capacitor
})

test('the native app has no push yet', async () => {
  ;(window as unknown as Record<string, unknown>).Capacitor = { isNativePlatform: () => true }
  expect(await pushState()).toBe('native')
  expect(await enablePush('k')).toBe('native')
})

test('an iPhone tab needs the home screen; another browser without push has none', async () => {
  noPush('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
  expect(await pushState()).toBe('install')
  noPush('Mozilla/5.0 (X11; Linux x86_64)')
  expect(await pushState()).toBe('unsupported')
})

test('blocked notifications, then off without a subscription', async () => {
  browser({ permission: 'denied' })
  expect(await pushState()).toBe('denied')
  browser({ permission: 'granted' })
  expect(await pushState()).toBe('off')
})

test('a device already on is saved again on the server', async () => {
  browser({ permission: 'granted', sub: sub() })
  const calls = mockApi({ 'POST /api/push/subscription': { ok: true } })
  expect(await pushState()).toBe('on')
  expect(calls[0].body).toEqual({
    endpoint: 'https://push.example/a',
    keys: { p256dh: 'k', auth: 's' },
  })
})

test('turning on asks permission, subscribes with the key bytes and saves the device', async () => {
  const calls = mockApi({ 'POST /api/push/subscription': { ok: true } })
  expect(await enablePush('AQID')).toBe('on')
  expect(fake.register).toHaveBeenCalledWith('/sw.js')
  const options = fake.subscribe.mock.calls[0][0] as { applicationServerKey: Uint8Array }
  expect([...options.applicationServerKey]).toEqual([1, 2, 3])
  expect(calls[0].path).toBe('/api/push/subscription')
})

test('turning on stops at the permission the player refused or dismissed', async () => {
  browser({ ask: 'denied' })
  expect(await enablePush('AQID')).toBe('denied')
  browser({ ask: 'default' })
  expect(await enablePush('AQID')).toBe('off')
})

test('turning off drops the device on the server and in the browser', async () => {
  const device = sub()
  browser({ permission: 'granted', sub: device })
  const calls = mockApi({ 'DELETE /api/push/subscription': { ok: true } })
  expect(await disablePush()).toBe('off')
  expect(calls[0]).toMatchObject({ method: 'DELETE', body: { endpoint: 'https://push.example/a' } })
  expect(device.unsubscribe).toHaveBeenCalled()
  browser()
  expect(await disablePush()).toBe('off')
})
