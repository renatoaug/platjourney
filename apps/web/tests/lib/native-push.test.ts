import { afterEach, expect, mock, test } from 'bun:test'
import { waitFor } from '@testing-library/react'
import {
  disableNativePush,
  enableNativePush,
  listenNativePush,
  nativePushState,
  notificationPath,
  startNativePush,
} from '../../src/lib/native-push'
import { mockApi } from '../support/web'

afterEach(() => {
  mock.restore()
  delete (window as unknown as Record<string, unknown>).Capacitor
})

test('notification taps accept only the internal history route and a valid tip', () => {
  expect(notificationPath('/history?tip=tip%3Aold')).toBe('/history?tip=tip%3Aold&from=push')
  expect(notificationPath('/history')).toBe('/history?from=push')
  for (const bad of [
    'https://evil.test/history',
    '//evil.test/history',
    '/history/other',
    '/history?tip=other:one',
    '/history?tip=tip:../secret',
    null,
  ])
    expect(notificationPath(bad)).toBeNull()
})

test('iOS registers, renews, revokes, respects account preferences and stops on logout', async () => {
  let permission = 'prompt'
  let token = 'a'.repeat(64)
  const handlers = new Map<string, (event: object) => void>()
  const push = {
    checkPermissions: async () => ({ receive: permission }),
    requestPermissions: async () => {
      permission = 'granted'
      return { receive: permission }
    },
    addListener: async (name: string, handler: (event: object) => void) => {
      handlers.set(name, handler)
      return { remove: async () => {} }
    },
    register: mock(async () => {
      handlers.get('registration')?.({ value: token })
    }),
    unregister: mock(async () => {}),
    removeAllDeliveredNotifications: mock(async () => {}),
  }
  ;(window as unknown as Record<string, unknown>).Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
    Plugins: { PushNotifications: push },
  }
  const calls = mockApi({ '/api/push/native': { ok: true } })
  await listenNativePush()
  let stop = startNativePush('user:one', true)
  await waitFor(() => {
    if (!calls.length) throw new Error('waiting for permission check')
  })
  expect(await enableNativePush()).toBe('on')
  const first = calls.find((c) => c.method === 'POST')?.body as {
    owner: string
    installation: string
    token: string
  }
  expect(first.owner).toBe('user:one')
  expect(first.installation).toMatch(/^[a-f0-9]{64}$/)
  token = 'b'.repeat(64)
  expect(await nativePushState()).toBe('on')
  expect((calls.at(-1)?.body as typeof first)?.token).toBe(token)
  expect((calls.at(-1)?.body as typeof first)?.installation).toBe(first.installation)
  expect(await disableNativePush()).toBe('off')
  expect(await nativePushState()).toBe('off')
  expect(push.unregister).toHaveBeenCalled()
  stop()
  stop = startNativePush('user:two', true)
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(await nativePushState()).toBe('off')
  expect(await enableNativePush()).toBe('on')
  expect((calls.filter((c) => c.method === 'POST').at(-1)?.body as typeof first)?.owner).toBe(
    'user:two',
  )
  permission = 'denied'
  expect(await nativePushState()).toBe('denied')
  expect(calls.at(-1)?.method).toBe('DELETE')
  document.dispatchEvent(new Event('api:signout'))
  const posts = calls.filter((c) => c.method === 'POST').length
  handlers.get('registration')?.({ value: 'c'.repeat(64) })
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(calls.filter((c) => c.method === 'POST')).toHaveLength(posts)
  handlers.get('pushNotificationActionPerformed')?.({
    notification: { data: { url: '/history?tip=tip%3Aold' } },
  })
  expect(window.location.pathname + window.location.search).toBe('/history?tip=tip%3Aold&from=push')
  stop()
  history.replaceState(null, '', '/')
})
