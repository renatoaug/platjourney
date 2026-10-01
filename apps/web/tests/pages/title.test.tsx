import { afterEach, expect, jest, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { MockAppState, SAMPLE_DATA } from '../../src/app/app-state'

import type { GuideDetail } from '../../src/lib/types'
import { Title, type TitleDetail } from '../../src/pages/title'
import { ownedData, recommendedData } from '../../src/pages/title.stories'
import { mockApi, never, renderApp, reply } from '../support/web'

afterEach(() => {
  jest.useRealTimers()
  mock.restore()
})

const guide = ownedData.guide as GuideDetail
const hero = () => document.querySelector('.card.hero') as HTMLElement
const meta = () => hero().querySelector('.meta')?.textContent

function open(path: string, detail: TitleDetail | ReturnType<typeof reply>) {
  const calls = mockApi({ '/api/title': () => detail })
  const view = renderApp(<Title />, { path, route: '/title/*' })
  return { calls, ...view }
}

test('a game from the library: progress, the guide numbers and the trophies', async () => {
  const { calls } = open('/title/game/game%3A19561', ownedData)
  expect(await screen.findByText('NA SUA BIBLIOTECA')).toBeTruthy()
  expect(calls[0].path).toBe('/api/title?game=game%3A19561')
  expect(screen.getByRole('heading', { name: 'DAYS GONE' })).toBeTruthy()
  expect(meta()).toContain('Dificuldade 3/10')
  expect(meta()).toContain('18h jogadas de ~70h')
  expect(meta()).toContain('1 jornada')
  expect(meta()).toContain('Sem perdíveis')
  expect(meta()).not.toContain('Troféus online')
  expect(screen.getByRole('progressbar', { name: 'Progresso do jogo' })).toBeTruthy()
  expect(screen.getByRole('link', { name: /Conversar com o Nexo/ }).getAttribute('href')).toBe(
    '/nexo',
  )
  expect(document.getElementById('title-trophies')?.textContent).toContain('De raspão')
  expect(screen.getByRole('link', { name: /Voltar/ }).getAttribute('href')).toBe('/discover')
})

test('a PSN list id asks by id', async () => {
  const { calls } = open('/title/id/NPWR17130_00', ownedData)
  await screen.findByText('NA SUA BIBLIOTECA')
  expect(calls[0].path).toBe('/api/title?id=NPWR17130_00')
})

test('a game by name asks with its platform, PS5 by default', async () => {
  const { calls, unmount } = open('/title/name/Days%20Gone?platform=PS4', recommendedData)
  await screen.findByText('FORA DA SUA BIBLIOTECA')
  expect(calls[0].path).toBe('/api/title?name=Days%20Gone&platform=PS4')
  unmount()
  mock.restore()
  const second = open('/title/name/Days%20Gone', recommendedData)
  await screen.findByText('FORA DA SUA BIBLIOTECA')
  expect(second.calls[0].path).toBe('/api/title?name=Days%20Gone&platform=PS5')
})

test('loading: the two columns for a library game, the wide guide for one by name', () => {
  mockApi({ '/api/title': never })
  const { container, unmount } = renderApp(<Title />, {
    path: '/title/game/game%3A1',
    route: '/title/*',
  })
  expect(screen.getByRole('heading', { name: 'Troféus' })).toBeTruthy()
  expect(container.querySelector('.guide-wide')).toBeNull()
  unmount()
  const second = renderApp(<Title />, { path: '/title/name/Hades', route: '/title/*' })
  expect(second.container.querySelector('.guide-wide .sk')).toBeTruthy()
})

test('a game the player does not own: the overview and saving it', async () => {
  const calls = mockApi({
    '/api/title': recommendedData,
    'POST /api/goals': {
      ...SAMPLE_DATA.goals,
      interests: [
        { id: 'interest:9', game: recommendedData.game, position: 1, progress: 0, done: false },
      ],
    },
  })
  renderApp(<Title />, { path: '/title/game/game%3A19561', route: '/title/*' })
  await screen.findByText('FORA DA SUA BIBLIOTECA')
  expect(hero().textContent).toContain('Você ainda não tem este jogo. A platina de Days Gone')
  expect(meta()).toContain('~70 horas')
  // The catalog trophies still list, beside the guide.
  expect(document.getElementById('title-trophies')?.textContent).toContain('De raspão')
  fireEvent.click(screen.getByRole('button', { name: /Salvar nos interesses/ }))
  expect(await screen.findByRole('button', { name: 'Nos interesses', pressed: true })).toBeTruthy()
  expect(calls.at(-1)?.body).toEqual({ command: 'add game:19561' })
})

test('without a trophy list the guide takes the width', async () => {
  open('/title/name/Days%20Gone', { ...recommendedData, trophies: null })
  await screen.findByText('FORA DA SUA BIBLIOTECA')
  expect(document.getElementById('title-trophies')).toBeNull()
  expect(document.querySelector('.guide-wide#title-guide')).toBeTruthy()
  expect(screen.getByText(/Guia montado pela web, sem a sua lista de troféus\./)).toBeTruthy()
})

test('a guide with missables, online trophies and several runs', async () => {
  open('/title/game/game%3A19561', {
    ...ownedData,
    hoursPlayed: null,
    guide: { ...guide, hasMissables: true, hasOnline: true, playthroughs: 2 },
  })
  await screen.findByText('NA SUA BIBLIOTECA')
  expect(meta()).toContain('Troféus perdíveis')
  expect(meta()).toContain('Troféus online')
  expect(meta()).toContain('2 jornadas')
  expect(meta()).toContain('~70 horas')
})

test('a platinum no longer possible gets the banner', async () => {
  open('/title/game/game%3A19561', {
    ...ownedData,
    guide: { ...guide, unobtainable: 'Os servidores fecharam em 2024.' },
  })
  expect((await screen.findByRole('note')).textContent).toContain('Platina não é mais possível')
})

test('a guide being researched: polls until it lands', async () => {
  let building = true
  const calls = mockApi({
    '/api/title': () => (building ? { ...ownedData, guide: null, building: true } : ownedData),
  })
  jest.useFakeTimers()
  renderApp(<Title />, { path: '/title/game/game%3A19561', route: '/title/*' })
  await act(async () => {})
  expect(meta()).toBe('Guia sendo preparado…')
  building = false
  await act(async () => {
    jest.advanceTimersByTime(6000)
  })
  expect(calls).toHaveLength(2)
  expect(meta()).toContain('Dificuldade 3/10')
  await act(async () => {
    jest.advanceTimersByTime(12_000)
  })
  expect(calls).toHaveLength(2)
})

test('leaving the page stops the polling', async () => {
  const calls = mockApi({ '/api/title': { ...ownedData, guide: null, building: true } })
  jest.useFakeTimers()
  const { unmount } = renderApp(<Title />, {
    path: '/title/game/game%3A19561',
    route: '/title/*',
  })
  await act(async () => {})
  unmount()
  jest.advanceTimersByTime(12_000)
  expect(calls).toHaveLength(1)
})

test('an answer that lands after leaving is dropped', async () => {
  let answer: (r: Response) => void = () => {}
  mockApi({ '/api/title': () => new Promise<Response>((r) => (answer = r)) })
  const { unmount } = renderApp(<Title />, { path: '/title/game/x', route: '/title/*' })
  unmount()
  answer(reply(500))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
})

test('a game that does not exist', async () => {
  open('/title/game/nada', reply(404))
  expect((await screen.findByRole('alert')).textContent).toBe('Não achamos esse jogo.')
})

test('Back returns to the screen the game was opened from', async () => {
  mockApi({ '/api/title': never() })
  render(
    <MemoryRouter initialEntries={['/guides', '/title/game/game%3A1']} initialIndex={1}>
      <MockAppState>
        <Routes>
          <Route path="/guides" element={<p>guides list</p>} />
          <Route path="/title/*" element={<Title />} />
        </Routes>
      </MockAppState>
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('link', { name: /Voltar/ }))
  expect(await screen.findByText('guides list')).toBeTruthy()
})
