import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MockAppState, SAMPLE_DATA, SAMPLE_ME } from '../../src/app/app-state'
import { PushAsk } from '../../src/components/push-ask'
import * as nativePush from '../../src/lib/native-push'
import * as push from '../../src/lib/push'
import type { Me } from '../../src/lib/types'
import { ToastHost } from '../../src/ui/toast'

const SEEN = 'platjourney:push-ask-seen'
const player: Me = { ...SAMPLE_ME, onboarded: true, nativePush: true }

// The native app with push, this device in the given state.
function device(state: push.PushState, native = true) {
  spyOn(nativePush, 'isNativePush').mockReturnValue(native)
  spyOn(nativePush, 'nativePushAvailable').mockReturnValue(native)
  spyOn(push, 'pushState').mockResolvedValue(state)
  return spyOn(push, 'enablePush').mockResolvedValue('on')
}

// What the screen told the page, as the usage plugin hears it.
function heard() {
  const seen: push.PushInviteDetail[] = []
  const listener = (e: Event) => seen.push((e as CustomEvent<push.PushInviteDetail>).detail)
  document.addEventListener(push.PUSH_INVITE_EVENT, listener)
  return seen
}

const show = (me: Me = player) =>
  render(
    <MockAppState value={{ me, data: SAMPLE_DATA }}>
      <PushAsk />
      <ToastHost />
    </MockAppState>,
  )

const settle = () => new Promise((done) => setTimeout(done, 0))

beforeEach(() => localStorage.removeItem(SEEN))
afterEach(() => {
  cleanup()
  mock.restore()
  localStorage.removeItem(SEEN)
})

test('the first time in the app it asks, and the system dialog comes only after the tap', async () => {
  const enable = device('off')
  const events = heard()
  show()
  const turnOn = await screen.findByRole('button', { name: 'Ativar avisos' })
  expect(enable).not.toHaveBeenCalled()
  fireEvent.click(turnOn)
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Ativar avisos' })).toBeNull())
  expect(enable).toHaveBeenCalledTimes(1)
  expect(events).toEqual([{ where: 'ask', result: 'on' }])
  expect(localStorage.getItem(SEEN)).toBe('1')
})

test('"not now" closes it for good on this device', async () => {
  device('off')
  const events = heard()
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }))
  expect(screen.queryByRole('button', { name: 'Ativar avisos' })).toBeNull()
  expect(events).toEqual([{ where: 'ask', result: 'later' }])
  cleanup()
  show()
  await settle()
  expect(screen.queryByRole('button', { name: 'Ativar avisos' })).toBeNull()
})

test('nothing when notices are already on or blocked', async () => {
  device('on')
  show()
  await settle()
  expect(screen.queryByRole('button', { name: 'Ativar avisos' })).toBeNull()
  cleanup()
  mock.restore()
  device('denied')
  show()
  await settle()
  expect(screen.queryByRole('button', { name: 'Ativar avisos' })).toBeNull()
})

test('it waits for the introduction, and a browser or the demo never sees it', async () => {
  device('off')
  show({ ...player, onboarded: false })
  await settle()
  expect(screen.queryByRole('button', { name: 'Ativar avisos' })).toBeNull()
  cleanup()
  show({ ...player, demo: true })
  await settle()
  expect(screen.queryByRole('button', { name: 'Ativar avisos' })).toBeNull()
  cleanup()
  mock.restore()
  device('off', false)
  show()
  await settle()
  expect(screen.queryByRole('button', { name: 'Ativar avisos' })).toBeNull()
})
