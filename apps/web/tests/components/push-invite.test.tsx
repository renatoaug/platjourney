import { afterEach, beforeEach, expect, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MockAppState, SAMPLE_ME } from '../../src/app/app-state'
import { PushInvite } from '../../src/components/push-invite'
import type { Me } from '../../src/lib/types'
import { ToastHost } from '../../src/ui/toast'
import { mockApi } from '../support/web'

// A browser with push and no subscription yet, the permission as given.
let permission: NotificationPermission
function browser(start: NotificationPermission, answer: NotificationPermission = 'granted') {
  permission = start
  const sub = {
    endpoint: 'https://push.example/a',
    toJSON: () => ({ endpoint: 'https://push.example/a', keys: { p256dh: 'k', auth: 's' } }),
  }
  let current: typeof sub | null = null
  const pushManager = {
    getSubscription: async () => current,
    subscribe: async () => {
      current = sub
      return sub
    },
  }
  const reg = { pushManager }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistration: async () => reg,
      register: async () => reg,
      ready: Promise.resolve(reg),
    },
  })
  Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} })
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: {
      get permission() {
        return permission
      },
      requestPermission: async () => {
        permission = answer
        return answer
      },
    },
  })
}

const player: Me = { ...SAMPLE_ME, pushKey: 'AQID' }
const show = (variant: 'card' | 'row', me: Me = player) =>
  render(
    <MockAppState value={{ me }}>
      <PushInvite variant={variant} />
      <ToastHost />
    </MockAppState>,
  )

beforeEach(() => localStorage.removeItem('pj.push-invite.done'))
afterEach(() => localStorage.removeItem('pj.push-invite.done'))

test('the card asks only after the tap, then goes away once notices are on', async () => {
  browser('default')
  const calls = mockApi({ 'POST /api/push/subscription': { ok: true } })
  show('card')
  const enable = await screen.findByRole('button', { name: 'Ativar' })
  expect(permission).toBe('default')
  fireEvent.click(enable)
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Ativar' })).toBeNull())
  expect(permission).toBe('granted')
  expect(calls.some((c) => c.method === 'POST')).toBe(true)
})

test('dismissed, the card stays away on this device', async () => {
  browser('default')
  mockApi({})
  const { unmount } = show('card')
  fireEvent.click(await screen.findByRole('button', { name: 'Dispensar' }))
  expect(screen.queryByRole('button', { name: 'Ativar' })).toBeNull()
  unmount()
  show('card')
  await new Promise((done) => setTimeout(done, 0))
  expect(screen.queryByRole('button', { name: 'Ativar' })).toBeNull()
})

test('blocked, the bell explains where to allow it and the card says nothing', async () => {
  browser('denied')
  mockApi({})
  const { unmount } = show('card')
  await new Promise((done) => setTimeout(done, 0))
  expect(screen.queryByText(/Quer que o Nexo/)).toBeNull()
  unmount()
  show('row')
  expect(await screen.findByText(/bloqueadas neste aparelho/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Ativar' })).toBeNull()
})

test('the demo never offers notices', async () => {
  browser('default')
  mockApi({})
  show('row', { ...player, demo: true })
  await new Promise((done) => setTimeout(done, 0))
  expect(screen.queryByText(/neste aparelho/)).toBeNull()
})
