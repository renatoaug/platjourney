import { afterEach, expect, jest, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { MockAppState, SAMPLE_DATA } from '../../src/app/app-state'
import { similarGamesData } from '../../src/components/similar-games.stories'
import type { GuideDetail } from '../../src/lib/types'
import { Title, type TitleDetail } from '../../src/pages/title'
import { ownedData, recommendedData } from '../../src/pages/title.stories'
import { gone, mockApi, never, renderApp, reply } from '../support/web'

afterEach(() => {
  jest.useRealTimers()
  // Unmount before the fakes go: a page still mounted would fire its late requests at the real fetch.
  cleanup()
  mock.restore()
})

const guide = ownedData.guide as GuideDetail
const hero = () => document.querySelector('.hero') as HTMLElement
const meta = () => document.querySelector('.meta')?.textContent
// Only the title's own requests; the similar games ask once the title is in.
const titleCalls = (calls: { path: string }[]) =>
  calls.filter((c) => c.path.startsWith('/api/title'))

function open(path: string, detail: TitleDetail | ReturnType<typeof reply>) {
  // The page also asks for similar games once it has the game; none here unless a test says so.
  const calls = mockApi({ '/api/title': () => detail, '/api/games/similar': { items: [] } })
  const view = renderApp(<Title />, { path, route: '/title/*' })
  return { calls, ...view }
}

test('a game from the library: progress, the guide numbers and the trophies', async () => {
  const { calls } = open('/title/game/game%3A19561', ownedData)
  expect(await screen.findByRole('heading', { name: 'DAYS GONE' })).toBeTruthy()
  expect(calls[0].path).toBe('/api/title?game=game%3A19561')
  expect(screen.getByRole('heading', { name: 'DAYS GONE' })).toBeTruthy()
  expect(screen.getByRole('img', { name: 'Dificuldade 3 de 10: Fácil' })).toBeTruthy()
  expect(meta()).toContain('18h jogadas de ~70h')
  expect(meta()).toContain('1 jornada')
  expect(meta()).toContain('Sem perdíveis')
  expect(meta()).not.toContain('Troféus online')
  expect(screen.getByRole('progressbar', { name: 'Progresso do jogo' })).toBeTruthy()
  expect(screen.getByRole('link', { name: /Conversar com Nexo/ }).getAttribute('href')).toBe(
    '/nexo?game=NPWR17130_00&name=DAYS+GONE',
  )
  expect(document.querySelector('.journey-trophies, #title-trophies')?.textContent).toContain(
    'De raspão',
  )
  expect(screen.getByRole('link', { name: /Voltar/ }).getAttribute('href')).toBe('/discover')
})

test('a PSN list id asks by id', async () => {
  const { calls } = open('/title/id/NPWR17130_00', ownedData)
  await screen.findByRole('heading', { name: 'DAYS GONE' })
  expect(calls[0].path).toBe('/api/title?id=NPWR17130_00')
})

test('a game by name asks with its platform, PS5 by default', async () => {
  const { calls, unmount } = open('/title/name/Days%20Gone?platform=PS4', recommendedData)
  await screen.findByRole('heading', { name: 'DAYS GONE' })
  expect(calls[0].path).toBe('/api/title?name=Days%20Gone&platform=PS4')
  unmount()
  mock.restore()
  const second = open('/title/name/Days%20Gone', recommendedData)
  await screen.findByRole('heading', { name: 'DAYS GONE' })
  expect(second.calls[0].path).toBe('/api/title?name=Days%20Gone&platform=PS5')
})

test('loading: the journey for a library game, the catalog page for any other link', () => {
  mockApi({ '/api/title': never })
  const { unmount } = renderApp(<Title />, { path: '/title/id/NPWR1_00', route: '/title/*' })
  expect(document.querySelector('.journey-trophies')).toBeTruthy()
  unmount()
  for (const path of ['/title/game/game%3A1', '/title/name/Hades']) {
    const view = renderApp(<Title />, { path, route: '/title/*' })
    expect(document.querySelector('.journey-trophies')).toBeNull()
    expect(view.container.querySelector('.trophy-roadmap')).toBeTruthy()
    expect(view.container.querySelector('.guide-heading')).toBeTruthy()
    expect(view.container.querySelector('.trophy-controls')).toBeTruthy()
    view.unmount()
  }
})

test('a game the player does not own: its list by tier, its facts and saving it', async () => {
  const calls = mockApi({
    '/api/title': recommendedData,
    '/api/games/similar': { items: [] },
    'POST /api/goals': {
      ...SAMPLE_DATA.goals,
      interests: [
        { id: 'interest:9', game: recommendedData.game, position: 1, progress: 0, done: false },
      ],
    },
  })
  renderApp(<Title />, { path: '/title/game/game%3A19561', route: '/title/*' })
  await screen.findByRole('heading', { name: 'DAYS GONE' })
  // Nothing of the player's to show: no library label, but what there is to earn.
  expect(hero().querySelector('.live-label')).toBeNull()
  expect(hero().querySelector('.trophy-breakdown')?.textContent).toMatch(/\d+ troféus/)
  expect(meta()).toMatch(/~70(?: horas|h)/)
  // The catalog trophies still list, beside the guide.
  expect(document.querySelector('.journey-trophies, #title-trophies')?.textContent).toContain(
    'De raspão',
  )
  // Nexo can talk about it before the player buys it.
  // The game's own link; the journey's asks about the selected trophy.
  const gameAsk = screen
    .getAllByRole('link', { name: 'Perguntar ao Nexo' })
    .find((a) => !a.getAttribute('href')?.includes('trophy='))
  expect(gameAsk?.getAttribute('href')).toBe(
    `/nexo?game=${encodeURIComponent(recommendedData.game.id)}&name=${encodeURIComponent(recommendedData.name).replace(/%20/g, '+')}`,
  )
  fireEvent.click(screen.getByRole('button', { name: /Salvar nos interesses/ }))
  expect(await screen.findByRole('button', { name: 'Nos interesses', pressed: true })).toBeTruthy()
  expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
    command: 'add game:19561 from:title',
  })
})

test('without a trophy list the trophies column says it is on its way', async () => {
  open('/title/name/Days%20Gone', { ...recommendedData, trophies: null })
  await screen.findByRole('heading', { name: 'DAYS GONE' })
  const trophies = document.getElementById('title-trophies')
  expect(trophies?.textContent).toContain('Buscando a lista de troféus')
  expect(trophies?.textContent).toContain('Volte em breve')
  expect(document.getElementById('title-guide')).toBeTruthy()
  expect(screen.queryByText(/Guia montado pela web/)).toBeNull()
})

test('a guide with missables, online trophies and several runs', async () => {
  open('/title/game/game%3A19561', {
    ...ownedData,
    hoursPlayed: null,
    guide: { ...guide, hasMissables: true, hasOnline: true, playthroughs: 2 },
  })
  await screen.findByRole('heading', { name: 'DAYS GONE' })
  expect(meta()).toContain('Troféus perdíveis')
  expect(meta()).toContain('Troféus online')
  expect(meta()).toContain('2 jornadas')
  expect(meta()).toMatch(/~70(?: horas|h)/)
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
    '/api/games/similar': { items: [] },
  })
  jest.useFakeTimers()
  renderApp(<Title />, { path: '/title/game/game%3A19561', route: '/title/*' })
  await act(async () => {})
  expect(meta()).toContain('Seu guia está sendo preparado')
  building = false
  await act(async () => {
    jest.advanceTimersByTime(6000)
  })
  expect(titleCalls(calls)).toHaveLength(2)
  expect(screen.getByRole('img', { name: 'Dificuldade 3 de 10: Fácil' })).toBeTruthy()
  await act(async () => {
    jest.advanceTimersByTime(12_000)
  })
  expect(titleCalls(calls)).toHaveLength(2)
  // Polling the title never asks for its similar games again.
  expect(calls.filter((c) => c.path.startsWith('/api/games/similar'))).toHaveLength(1)
})

test('leaving the page stops the polling', async () => {
  const calls = mockApi({
    '/api/title': { ...ownedData, guide: null, building: true },
    '/api/games/similar': { items: [] },
  })
  jest.useFakeTimers()
  const { unmount } = renderApp(<Title />, {
    path: '/title/game/game%3A19561',
    route: '/title/*',
  })
  await act(async () => {})
  unmount()
  jest.advanceTimersByTime(12_000)
  expect(titleCalls(calls)).toHaveLength(1)
})

test('an answer that lands after leaving is dropped', async () => {
  let answer: (r: Response) => void = () => {}
  mockApi({
    '/api/title': () => new Promise<Response>((r) => (answer = r)),
    '/api/games/similar': { items: [] },
  })
  const { unmount } = renderApp(<Title />, { path: '/title/game/x', route: '/title/*' })
  unmount()
  answer(reply(500))
  await gone(() => screen.queryByRole('alert'))
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

test('similar games under the showcase: the expansion and the series first, with their tag', async () => {
  const calls = mockApi({
    '/api/title': ownedData,
    '/api/games/similar': { items: similarGamesData },
  })
  renderApp(<Title />, { path: '/title/game/game%3A19561', route: '/title/*' })
  // The band's skeleton first, then the games.
  const cards = await waitFor(() =>
    within(screen.getByRole('region', { name: 'Parecidos com este' })).getAllByRole('link'),
  )
  expect(cards.map((c) => c.querySelector('.band-name')?.textContent)).toEqual([
    'Days Gone: Broken Road',
    'Days Gone Remastered',
    'Ghost of Tsushima',
    'The Last of Us Part II',
    'Horizon Zero Dawn',
  ])
  const tag = (i: number) => cards[i].closest('.band-card')?.querySelector('.band-tag')
  expect(tag(0)?.textContent).toBe('Expansão')
  expect(tag(1)?.textContent).toBe('Mesma série')
  expect(tag(2)).toBeNull()
  expect(cards[0].getAttribute('href')).toBe('/title/game/game%3A41')
  // Asked beside the title, not after it, and once: the band reuses the request already made.
  const similar = calls.filter((c) => c.path === '/api/games/similar?game=game%3A19561')
  expect(similar).toHaveLength(1)
  expect(calls.indexOf(similar[0])).toBe(1)
})

test('no similar game leaves the section out', async () => {
  open('/title/game/game%3A19561', ownedData)
  await screen.findByRole('heading', { name: 'DAYS GONE' })
  await gone(() => document.querySelector('.game-band'))
})

test('a failed similar games request leaves the section out', async () => {
  mockApi({ '/api/title': ownedData, '/api/games/similar': reply(500) })
  renderApp(<Title />, { path: '/title/game/game%3A19561', route: '/title/*' })
  await screen.findByRole('heading', { name: 'DAYS GONE' })
  await gone(() => document.querySelector('.game-band'))
})

test('the tab shows the game’s name while the page is open', async () => {
  document.title = 'Jogo'
  // The catalog's name, not the trophy list's capitals.
  const { unmount } = open('/title/game/game%3A19561', {
    ...ownedData,
    game: { ...ownedData.game, name: 'Days Gone' },
  })
  await waitFor(() => expect(document.title).toBe('Days Gone · PlatJourney'))
  unmount()
  expect(document.title).toBe('Jogo')
})

test('a catalog game offers a roadmap preview without asserting ownership or personal progress', async () => {
  open('/title/game/game%3A19561', recommendedData)
  await screen.findByRole('heading', { name: 'DAYS GONE' })
  expect(document.querySelector('.roadmap-preview-notice[role=status]')).toBeNull()
  expect(document.querySelector('.roadmap-total')?.textContent).not.toContain('progresso')
  expect(screen.queryByRole('button', { name: 'Voltar ao meu progresso' })).toBeNull()
  expect(document.querySelector('.roadmap-past')).toBeNull()
})

test('a game the player does not own offers Nexo on its trophies, by the catalog game', async () => {
  open('/title/game/game%3A19561', recommendedData)
  await screen.findByRole('heading', { name: 'DAYS GONE' })
  const asks = [...document.querySelectorAll('#title-trophies .trophy-help-btn')]
  expect(asks.length).toBeGreaterThan(0)
  const href = asks[0].getAttribute('href') ?? ''
  expect(href).toContain(`game=${encodeURIComponent('game:19561')}`)
  expect(href).toContain('trophy=')
})

test('a game outside the library opens its guide on an About tab with the game facts', async () => {
  open('/title/game/game%3A19561', {
    ...ownedData,
    owned: false,
    game: { ...ownedData.game, released_at: '2019-04-26T00:00:00Z' },
  })
  const tab = await screen.findByRole('tab', { name: 'Sobre' })
  expect(tab.getAttribute('aria-selected')).toBe('true')
  const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '')
  expect(panel?.querySelector('.game-about')).toBeTruthy()
  expect(panel?.querySelector('.quick-facts')).toBeTruthy()
  // Not again beside the headline.
  expect(document.querySelector('.hero-aside .game-about')).toBeNull()
})
