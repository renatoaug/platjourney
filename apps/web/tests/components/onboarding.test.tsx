import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { SAMPLE_DATA, SAMPLE_ME } from '../../src/app/app-state'
import { Onboarding, OPEN_ONBOARDING } from '../../src/components/onboarding'
import type { Me } from '../../src/lib/types'
import type { ProfileData } from '../../src/pages/profile'
import { mockApi, renderApp } from '../support/web'

afterEach(() => {
  mock.restore()
  sessionStorage.clear()
})

const player: Me = { ...SAMPLE_ME, onboarded: false }
const playing = {
  game: { id: 'game:1', name: 'Astro Bot', cover_url: null },
  name: 'Astro Bot',
  platform: 'PS5',
  progress: 40,
  earned: 20,
  total: 50,
} as unknown as NonNullable<typeof SAMPLE_DATA.current>
const full = { ...SAMPLE_DATA, current: playing }
const plat = (name: string, earnedAt: string, rarity: number) => ({
  game: { id: `game:${name}`, name, cover_url: null },
  platform: 'PS5',
  earnedAt,
  rarity,
  trophyName: `${name} Master`,
  hours: 30,
})
const profile = {
  summary: SAMPLE_DATA.profile,
  platinums: [plat('Ghost', '2025-11-02', 7), plat('Detroit', '2026-04-10', 1.4)],
  pendingPlatinums: 0,
  byYear: [
    { year: 2025, count: 1 },
    { year: 2026, count: 1 },
  ],
  byPlatform: [],
  rarest: plat('Detroit', '2026-04-10', 1.4),
  fastestStreak: null,
  totalHours: 120,
  mostPlayed: [{ game: { id: 'game:Ghost', name: 'Ghost', cover_url: null }, hours: 60 }],
  user: player,
} as unknown as ProfileData

const stories = () => screen.queryByRole('dialog', { name: 'Sua história no PlatJourney' })
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Próxima tela' }))
const shown = () => document.querySelector('.story-slide.on') as HTMLElement
const path = () => screen.getByTestId('location').textContent

test('opens on the player’s story: the hello with their trophies by tier', () => {
  mockApi({ '/api/profile': profile })
  renderApp(<Onboarding />, { value: { me: player, data: full } })
  expect(stories()).toBeTruthy()
  expect(screen.getByText('Achamos sua história, jogador.')).toBeTruthy()
  expect(shown().querySelectorAll('.story-tier')).toHaveLength(4)
})

test('every slide with something to say is told, in order, up to the hunter card', async () => {
  mockApi({ '/api/profile': profile })
  renderApp(<Onboarding />, { value: { me: player, data: full } })
  await Bun.sleep(20)
  next()
  expect(shown().textContent).toContain('2 platinas.')
  next()
  expect(shown().textContent).toContain('120 horas')
  next()
  expect(shown().textContent).toContain('1,4%')
  next()
  expect(shown().textContent).toContain('Seu ritmo')
  next()
  expect(shown().textContent).toContain('Astro Bot')
  next()
  expect(shown().textContent).toContain('Seu cartão de caçador')
})

test('without platinums or hours those slides are left out', async () => {
  mockApi({
    '/api/profile': { ...profile, platinums: [], rarest: null, byYear: [], mostPlayed: [] },
  })
  renderApp(<Onboarding />, { value: { me: player, data: full } })
  await Bun.sleep(20)
  next()
  expect(shown().textContent).toContain('Sua próxima platina')
})

test('the arrow keys move between the slides', async () => {
  mockApi({ '/api/profile': profile })
  renderApp(<Onboarding />, { value: { me: player, data: full } })
  await Bun.sleep(20)
  fireEvent.keyDown(stories() as HTMLElement, { key: 'ArrowRight' })
  expect(shown().textContent).toContain('2 platinas.')
  fireEvent.keyDown(stories() as HTMLElement, { key: 'ArrowLeft' })
  expect(shown().textContent).toContain('Achamos sua história')
})

test('starting the journey saves it for the player and opens the game', async () => {
  const calls = mockApi({ '/api/profile': profile, 'POST /api/account/onboarded': { ok: true } })
  renderApp(<Onboarding />, { value: { me: player, data: full } })
  await Bun.sleep(20)
  for (let i = 0; i < 5; i++) next()
  fireEvent.click(screen.getByRole('button', { name: /Começar jornada/ }))
  expect(stories()).toBeNull()
  expect(path()).toBe('/game')
  expect(calls.some((c) => c.path === '/api/account/onboarded')).toBe(true)
})

test('skipping counts as seen; Escape skips too', () => {
  const calls = mockApi({ '/api/profile': profile, 'POST /api/account/onboarded': { ok: true } })
  renderApp(<Onboarding />, { value: { me: player, data: full } })
  fireEvent(stories() as HTMLElement, new Event('cancel', { cancelable: true }))
  expect(stories()).toBeNull()
  expect(calls.filter((c) => c.path === '/api/account/onboarded')).toHaveLength(1)
})

test('the demo remembers it in the browser session and never asks the server', () => {
  const calls = mockApi({ '/api/profile': profile })
  const demo = { ...player, demo: true }
  const first = renderApp(<Onboarding />, { value: { me: demo, data: full } })
  fireEvent.click(screen.getByRole('button', { name: 'Pular' }))
  first.unmount()
  renderApp(<Onboarding />, { value: { me: demo, data: full } })
  expect(stories()).toBeNull()
  expect(calls.some((c) => c.path === '/api/account/onboarded')).toBe(false)
})

test('it can be opened again from anywhere', () => {
  mockApi({ '/api/profile': profile })
  renderApp(<Onboarding />, { value: { me: { ...player, onboarded: true }, data: full } })
  expect(stories()).toBeNull()
  fireEvent(document, new Event(OPEN_ONBOARDING))
  expect(stories()).toBeTruthy()
})

test('while the first sync runs the hello waits with the sync line', () => {
  mockApi({ '/api/profile': profile })
  renderApp(<Onboarding />, {
    value: { me: player, data: { ...full, current: null }, warming: true },
  })
  expect(screen.getByText('Lendo seus troféus na PSN…')).toBeTruthy()
})

test('the story ends on a thank-you, and its button starts the journey at the next game', async () => {
  const calls = mockApi({ '/api/profile': profile, 'POST /api/account/onboarded': { ok: true } })
  renderApp(<Onboarding />, { value: { me: player, data: full } })
  await Bun.sleep(20)
  for (let i = 0; i < 7; i++) next()
  expect(shown().textContent).toContain('Obrigado por chegar, ')
  fireEvent.click(within(shown()).getByRole('button', { name: /Começar jornada/ }))
  expect(path()).toBe('/game')
  expect(calls.some((c) => c.path === '/api/account/onboarded')).toBe(true)
})

test('the first slide holds while the profile is on its way, then the platinum slides join', async () => {
  let answer: (v: Response) => void = () => {}
  mockApi({ '/api/profile': () => new Promise<Response>((r) => (answer = r)) })
  renderApp(<Onboarding />, { value: { me: player, data: full } })
  expect(document.querySelector('.story-bars')?.children.length).toBe(4)
  answer(new Response(JSON.stringify(profile)))
  await waitFor(() => expect(document.querySelector('.story-bars')?.children.length).toBe(8))
})
