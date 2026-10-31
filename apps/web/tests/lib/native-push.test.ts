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
import { mockApi, reply } from '../support/web'

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
  let heldDeletion: Promise<object> | null = null
  let deletionFailure: 'network' | 'server' | null = null
  const calls = mockApi({
    '/api/push/native': ({ method }) => {
      if (method === 'DELETE' && heldDeletion) return heldDeletion
      if (method === 'DELETE' && deletionFailure === 'network') throw new TypeError('offline')
      if (method === 'DELETE' && deletionFailure === 'server') return reply(503)
      return { ok: true }
    },
  })
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
  // Losing the DELETE response leaves a durable intent, but must still stop native delivery.
  deletionFailure = 'network'
  const unregistrations = push.unregister.mock.calls.length
  const cleared = push.removeAllDeliveredNotifications.mock.calls.length
  await expect(disableNativePush()).rejects.toThrow('revocation pending')
  expect(push.unregister.mock.calls.length).toBeGreaterThan(unregistrations)
  expect(push.removeAllDeliveredNotifications.mock.calls.length).toBeGreaterThan(cleared)
  expect(localStorage.getItem('platjourney:apns:user:one')).toBe('revoking')
  const saved = calls.filter((c) => c.method === 'POST').length
  handlers.get('registration')?.({ value: 'c'.repeat(64) })
  await expect(nativePushState()).rejects.toThrow('revocation pending')
  expect(calls.filter((c) => c.method === 'POST')).toHaveLength(saved)
  // Re-opening the lifecycle (including app restart) cannot turn pending revocation back on.
  stop()
  stop = startNativePush('user:one', true)
  await expect(nativePushState()).rejects.toThrow('revocation pending')
  deletionFailure = null
  window.dispatchEvent(new Event('online'))
  await waitFor(() => {
    if (localStorage.getItem('platjourney:apns:user:one')) throw new Error('retry pending')
  })
  expect(await nativePushState()).toBe('off')
  expect(await enableNativePush()).toBe('on')
  // Native failures also retain the intent and do not skip clearing delivered notifications.
  push.unregister.mockRejectedValueOnce(new Error('native error'))
  await expect(disableNativePush()).rejects.toThrow('revocation pending')
  expect(localStorage.getItem('platjourney:apns:user:one')).toBe('revoking')
  expect(await disableNativePush()).toBe('off')
  expect(await nativePushState()).toBe('off')
  expect(push.unregister).toHaveBeenCalled()
  expect(await enableNativePush()).toBe('on')
  deletionFailure = 'server'
  await expect(disableNativePush()).rejects.toThrow('revocation pending')
  let finishDeletion!: (result: object) => void
  heldDeletion = new Promise((resolve) => {
    finishDeletion = resolve
  })
  const beforeHeld = calls.length
  const oldRevocation = disableNativePush()
  const oldResult = oldRevocation.catch((error: Error) => error)
  await waitFor(() => {
    if (calls.length === beforeHeld) throw new Error('DELETE not started')
  })
  expect((calls.at(-1)?.body as typeof first)?.owner).toBe('user:one')
  // Logout ends delivery via the server session even if its device DELETE failed.
  document.dispatchEvent(new Event('api:signout'))
  const afterLogout = calls.length
  handlers.get('registration')?.({ value: 'd'.repeat(64) })
  await Promise.resolve()
  expect(calls).toHaveLength(afterLogout)
  stop()
  deletionFailure = null
  stop = startNativePush('user:two', true)
  heldDeletion = null
  finishDeletion({ ok: true })
  expect(((await oldResult) as Error).message).toContain('session changed')
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(await nativePushState()).toBe('off')
  expect(localStorage.getItem('platjourney:apns:user:one')).toBe('revoking')
  expect((calls.at(-1)?.body as typeof first)?.owner).toBe('user:two')
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
  // Returning to the original account retries only its pending removal, never registration.
  const postsBeforeReturn = calls.filter((c) => c.method === 'POST').length
  stop = startNativePush('user:one', true)
  expect(await nativePushState()).toBe('denied')
  expect((calls.at(-1)?.body as typeof first)?.owner).toBe('user:one')
  expect(calls.filter((c) => c.method === 'POST')).toHaveLength(postsBeforeReturn)
  expect(localStorage.getItem('platjourney:apns:user:one')).toBeNull()
  stop()
  history.replaceState(null, '', '/')
})
