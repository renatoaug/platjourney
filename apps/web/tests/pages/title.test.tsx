import { afterEach, expect, jest, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { MockAppState, SAMPLE_DATA } from '../../src/app/app-state'
import { NexoBubble } from '../../src/components/nexo-bubble'
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
// The owned game's overview: its facts card, the guide's card and, on the guide's page, its facts.
const facts = () => document.querySelector('.game-facts')?.textContent
const guideCard = () => screen.getByRole('button', { name: /^Guia da platina/ }).textContent
const quickFacts = () => document.querySelector('.journey-guide .quick-facts')?.textContent
// Only the title's own requests; the similar games ask once the title is in.
const titleCalls = (calls: { path: string }[]) =>
  calls.filter((c) => c.path.startsWith('/api/title'))

function open(path: string, detail: TitleDetail | ReturnType<typeof reply>) {
  // The page also asks for similar games once it has the game; none here unless a test says so.
  const calls = mockApi({ '/api/title': () => detail, '/api/games/similar': { items: [] } })
  // The shell's floating Nexo, which follows the game on screen.
  const view = renderApp(
    <>
      <Title />
      <NexoBubble initial={{ x: 0, y: 0 }} />
    </>,
    { path, route: '/title/*' },
  )
  return { calls, ...view }
}

test('a game from the library: progress, the guide numbers and the trophies', async () => {
  const { calls } = open('/title/game/game%3A19561', ownedData)
  expect(await screen.findByRole('heading', { level: 1, name: 'DAYS GONE' })).toBeTruthy()
  expect(calls[0].path).toBe('/api/title?game=game%3A19561')
  expect(screen.getByRole('progressbar', { name: 'Progresso no jogo' })).toBeTruthy()
  // The guide's difficulty and time sit in the overview's facts.
  expect(facts()).toContain('3/10Dificuldade')
  expect(facts()).toContain('~70hTempo')
  expect(document.querySelector('.journey-trophies, #title-trophies')?.textContent).toContain(
    'De raspão',
  )
  expect(screen.getByRole('link', { name: /Voltar/ }).getAttribute('href')).toBe('/discover')
  // The rest of the guide's numbers are on the guide's page.
  fireEvent.click(screen.getByRole('button', { name: /^Guia da platina/ }))
  expect(quickFacts()).toContain('Jogadas mínimas1')
  expect(quickFacts()).toContain('PerdíveisNenhum')
  expect(quickFacts()).toContain('OnlineNão')
  fireEvent.click(screen.getByRole('button', { name: 'Voltar para o jogo' }))
  // Nexo about the whole game is the floating Nexo, which opens on the game on screen.
  fireEvent.click(screen.getByRole('button', { name: 'Falar com o Nexo' }))
  expect(screen.getByTestId('location').textContent).toBe('/nexo?game=NPWR17130_00&name=DAYS+GONE')
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

test('loading: the one game page’s skeleton, whatever the link', () => {
  mockApi({ '/api/title': never })
  // A library game or a catalog one: one page, so one skeleton, with no old catalog layout.
  for (const path of ['/title/id/NPWR1_00', '/title/game/game%3A1', '/title/name/Hades']) {
    // The shell's floating Nexo, which follows the game on screen.
    const view = renderApp(
      <>
        <Title />
        <NexoBubble initial={{ x: 0, y: 0 }} />
      </>,
      { path, route: '/title/*' },
    )
    const skeleton = view.container.querySelector('.journey[aria-busy="true"]')
    expect(skeleton).toBeTruthy()
    expect(skeleton?.querySelector('.game-overview-head')).toBeTruthy()
    expect(skeleton?.querySelector('.game-links')).toBeTruthy()
    expect(skeleton?.querySelector('.journey-trophies')).toBeTruthy()
    expect(view.container.querySelector('.trophy-roadmap')).toBeNull()
    expect(view.container.querySelector('.guide-heading')).toBeNull()
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
  // Nothing of the player's to show: no progress, but what there is to earn, by tier.
  expect(screen.queryByRole('progressbar')).toBeNull()
  expect(document.querySelector('.game-overview-played')?.textContent).toMatch(/^\d+ troféus$/)
  const tiers = document.querySelector('.game-tiers')?.textContent ?? ''
  expect(tiers).toMatch(/\d/)
  expect(tiers).not.toContain('/')
  const trophyCount = recommendedData.trophies?.length ?? 0
  const tierCounts = [...document.querySelectorAll('.game-tier b')].map((b) =>
    Number(b.textContent),
  )
  expect(tierCounts.reduce((a, b) => a + b, 0)).toBe(trophyCount)
  // Its facts: the guide's time.
  expect(facts()).toMatch(/~70(?: horas|h)Tempo/)
  // No session route for a game the player does not have.
  expect(screen.queryByRole('button', { name: /^Planejar sessão/ })).toBeNull()
  // The catalog trophies still list, under the cards.
  expect(document.querySelector('.journey-trophies')?.textContent).toContain('De raspão')
  // The actions are saving and the store; Nexo is the floating bubble, not a button here.
  expect(document.querySelector('.game-overview-cta')?.textContent).not.toContain(
    'Perguntar ao Nexo',
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
  expect(document.querySelector('.journey-trophies')).toBeNull()
  // No list to ask Nexo about yet; the guide is still a card away.
  expect(screen.queryByRole('link', { name: 'Perguntar ao Nexo' })).toBeNull()
  expect(screen.queryByText(/Guia montado pela web/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /^Guia da platina/ }))
  expect(document.getElementById('journey-guide-section')).toBeTruthy()
  // Nor a card to preview a route of trophies it does not have.
  fireEvent.click(screen.getByRole('button', { name: 'Voltar para o jogo' }))
  expect(await screen.findByRole('button', { name: /^Guia da platina/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^Jornada da platina/ })).toBeNull()
})

test('a guide with missables, online trophies and several runs', async () => {
  open('/title/game/game%3A19561?view=guide', {
    ...ownedData,
    hoursPlayed: null,
    guide: { ...guide, hasMissables: true, hasOnline: true, playthroughs: 2 },
  })
  await screen.findByRole('heading', { level: 1, name: 'Guia da platina' })
  expect(quickFacts()).toContain('OnlineSim')
  expect(quickFacts()).toContain('Jogadas mínimas2')
  expect(quickFacts()).toMatch(/~70(?: horas|h)/)
})

// The overview shows the banner under its head when the guide says the platinum is gone.
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
  expect(guideCard()).toContain('Sendo preparado')
  expect(document.querySelector('.game-facts')).toBeNull()
  building = false
  await act(async () => {
    jest.advanceTimersByTime(6000)
  })
  expect(titleCalls(calls)).toHaveLength(2)
  expect(guideCard()).toContain('Dicas, perdíveis e a ordem dos troféus')
  expect(facts()).toContain('3/10Dificuldade')
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
  const card = screen.getByRole('button', { name: /^Jornada da platina/ })
  expect(card.textContent).toContain('Prévia do caminho até a platina')
  fireEvent.click(card)
  expect(await screen.findByRole('heading', { level: 1, name: 'Jornada da platina' })).toBeTruthy()
  expect(document.querySelector('.trophy-roadmap')).toBeTruthy()
  expect(document.querySelector('.roadmap-preview-notice[role=status]')).toBeNull()
  expect(document.querySelector('.roadmap-total')?.textContent).not.toContain('progresso')
  expect(screen.queryByRole('button', { name: 'Voltar ao meu progresso' })).toBeNull()
  expect(document.querySelector('.roadmap-past')).toBeNull()
})

test('a game the player does not own offers Nexo on its trophies, by the catalog game', async () => {
  open('/title/game/game%3A19561', recommendedData)
  await screen.findByRole('heading', { name: 'DAYS GONE' })
  const asks = [...document.querySelectorAll('#journey-trophies .trophy-help-btn')]
  expect(asks.length).toBeGreaterThan(0)
  const href = asks[0].getAttribute('href') ?? ''
  expect(href).toContain(`game=${encodeURIComponent('game:19561')}`)
  expect(href).toContain('trophy=')
})

test('a game outside the library has its facts on About and its guide’s numbers on the guide', async () => {
  open('/title/game/game%3A19561', {
    ...ownedData,
    owned: false,
    game: { ...ownedData.game, released_at: '2019-04-26T00:00:00Z' },
  })
  await screen.findByRole('heading', { level: 1, name: 'DAYS GONE' })
  // Folded on the overview: their row unfolds them in place.
  expect(document.querySelector('.game-about')).toBeNull()
  const about = screen.getByRole('button', { name: /^Sobre o jogo/ })
  expect(about.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(about)
  expect(about.getAttribute('aria-expanded')).toBe('true')
  expect(document.querySelector('.game-link-panel.journey-about .game-about')).toBeTruthy()
  expect(screen.getByRole('heading', { level: 1, name: 'DAYS GONE' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^Guia da platina/ }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Guia da platina' })).toBeTruthy()
  expect(quickFacts()).toContain('Jogadas mínimas1')
  // With a guide, the facts are not repeated above it.
  expect(document.querySelector('.journey-guide .game-about')).toBeNull()
})

test('a catalog game without a guide shows its facts above the guide’s page', async () => {
  open('/title/game/game%3A19561?view=guide', {
    ...recommendedData,
    guide: null,
    game: { ...recommendedData.game, released_at: '2019-04-26T00:00:00Z' },
  })
  await screen.findByRole('heading', { level: 1, name: 'Guia da platina' })
  expect(document.querySelector('#journey-guide-section .game-about')).toBeTruthy()
})
