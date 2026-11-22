import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MockAppState, SAMPLE_DATA, SAMPLE_ME } from '../../src/app/app-state'
import * as installGuide from '../../src/components/install-guide'
import { ASK_AGAIN_MS, askReason, MAX_ASKS, PushAsk } from '../../src/components/push-ask'
import * as nativePush from '../../src/lib/native-push'
import * as push from '../../src/lib/push'
import type { Me, Tip } from '../../src/lib/types'
import { ToastHost } from '../../src/ui/toast'

const ASKED = 'platjourney:push-ask'
const ASKED_BEFORE = 'platjourney:push-ask-seen'
const asked = () => JSON.parse(localStorage.getItem(ASKED) ?? 'null')
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

const clear = () => {
  localStorage.removeItem(ASKED)
  localStorage.removeItem(ASKED_BEFORE)
}

beforeEach(clear)
afterEach(() => {
  cleanup()
  mock.restore()
  clear()
})

test('the first time in the app it asks, and the system dialog comes only after the tap', async () => {
  const enable = device('off')
  const events = heard()
  show()
  const turnOn = await screen.findByRole('button', { name: 'Ativar' })
  expect(enable).not.toHaveBeenCalled()
  fireEvent.click(turnOn)
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Ativar' })).toBeNull())
  expect(enable).toHaveBeenCalledTimes(1)
  expect(events).toEqual([{ where: 'ask', result: 'on' }])
  expect(asked().count).toBe(1)
})

test('"not now" closes it, and opening the app again does not bring it back', async () => {
  device('off')
  const events = heard()
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }))
  expect(screen.queryByRole('button', { name: 'Ativar' })).toBeNull()
  expect(events).toEqual([{ where: 'ask', result: 'later' }])
  cleanup()
  show()
  await settle()
  expect(screen.queryByRole('button', { name: 'Ativar' })).toBeNull()
})

test('nothing when notices are already on or blocked', async () => {
  device('on')
  show()
  await settle()
  expect(screen.queryByRole('button', { name: 'Ativar' })).toBeNull()
  cleanup()
  mock.restore()
  device('denied')
  show()
  await settle()
  expect(screen.queryByRole('button', { name: 'Ativar' })).toBeNull()
})

test('it waits for the introduction, and a browser or the demo never sees it', async () => {
  device('off')
  show({ ...player, onboarded: false })
  await settle()
  expect(screen.queryByRole('button', { name: 'Ativar' })).toBeNull()
  cleanup()
  show({ ...player, demo: true })
  await settle()
  expect(screen.queryByRole('button', { name: 'Ativar' })).toBeNull()
  cleanup()
  mock.restore()
  device('off', false)
  show()
  await settle()
  expect(screen.queryByRole('button', { name: 'Ativar' })).toBeNull()
})

test('PlatJourney installed from the browser asks too, with Web Push; a browser tab does not', async () => {
  device('off', false)
  spyOn(installGuide, 'installed').mockReturnValue(true)
  show({ ...player, pushKey: 'AQID' })
  expect(await screen.findByRole('button', { name: 'Ativar' })).toBeTruthy()
  cleanup()
  show({ ...player, pushKey: undefined })
  await settle()
  expect(screen.queryByRole('button', { name: 'Ativar' })).toBeNull()
})

const tip = (kind: string, hoursAgo: number, now: number): Tip => ({
  id: `tip:${kind}${hoursAgo}`,
  kind,
  content: '🏆 **Paraíso perdido**',
  created_at: new Date(now - hoursAgo * 3_600_000).toISOString(),
  game: { id: 'game:52189', name: 'Grand Theft Auto VI' } as Tip['game'],
})

test('after a "not now", it asks again a week later, over a trophy notice still unread', () => {
  const now = Date.now()
  const week = now - ASK_AGAIN_MS - 1
  const missed = tip('unlock', 2, now)
  // The first time: no reason needed.
  expect(askReason({ count: 0, at: 0 }, { tips: [], unread: 0 }, now)).toEqual({})
  // A week on, a trophy came in and is unread: asked again, over that trophy.
  expect(askReason({ count: 1, at: week }, { tips: [missed], unread: 1 }, now)).toEqual({ missed })
  // Too soon, read, not a trophy, or older than the last time asked: not now.
  expect(
    askReason({ count: 1, at: now - 86_400_000 }, { tips: [missed], unread: 1 }, now),
  ).toBeNull()
  expect(askReason({ count: 1, at: week }, { tips: [missed], unread: 0 }, now)).toBeNull()
  expect(
    askReason({ count: 1, at: week }, { tips: [tip('deal', 2, now)], unread: 1 }, now),
  ).toBeNull()
  expect(
    askReason(
      { count: 1, at: now - 3 * 3_600_000 + 1 - ASK_AGAIN_MS },
      { tips: [tip('unlock', 2 + 24 * 8, now)], unread: 1 },
      now,
    ),
  ).toBeNull()
  // Three times at most.
  expect(askReason({ count: MAX_ASKS, at: week }, { tips: [missed], unread: 1 }, now)).toBeNull()
})

test('a device the first version asked counts as asked once', async () => {
  device('off')
  localStorage.setItem(ASKED_BEFORE, '1')
  show()
  await settle()
  expect(screen.queryByRole('button', { name: 'Ativar' })).toBeNull()
})

test('asked again, it names the trophy notice that was missed and reports it apart', async () => {
  device('off')
  const events = heard()
  const now = Date.now()
  localStorage.setItem(ASKED, JSON.stringify({ count: 1, at: now - ASK_AGAIN_MS - 1 }))
  render(
    <MockAppState
      value={{ me: player, data: { ...SAMPLE_DATA, tips: [tip('unlock', 2, now)], unread: 1 } }}
    >
      <PushAsk />
      <ToastHost />
    </MockAppState>,
  )
  expect(await screen.findByText(/Caiu troféu no Grand Theft Auto VI há 2 horas/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Agora não' }))
  expect(events).toEqual([{ where: 'again', result: 'later' }])
  expect(asked().count).toBe(2)
})
