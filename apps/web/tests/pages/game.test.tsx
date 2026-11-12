import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { SAMPLE_DATA, SAMPLE_ME } from '../../src/app/app-state'
import { nexoHref } from '../../src/components/nexo-asks'
import { NexoBubble } from '../../src/components/nexo-bubble'
import { samplePlan } from '../../src/components/plan.stories'
import { current } from '../../src/fixtures'
import type { CurrentGame } from '../../src/lib/types'
import { Game, GameScreen } from '../../src/pages/game'
import { mockApi, never, renderApp } from '../support/web'

afterEach(() => mock.restore())
const game: CurrentGame = {
  ...current,
  focus: { phases: [], trophy: current.trophies.find((t) => !t.earned && t.type !== 'platinum') },
}

for (const includeDlcProgress of [false, true]) {
  test(`the overview's ring shares the saved DLC scope: ${includeDlcProgress}`, async () => {
    mockApi({})
    const completed: CurrentGame = {
      ...game,
      progress: 50,
      groups: { base: { earned: 40, total: 40 }, dlc: { earned: 0, total: 10 } },
    }
    renderApp(<GameScreen current={completed} plan={null} />, {
      value: { me: { ...SAMPLE_ME, includeDlcProgress } },
    })
    await screen.findByRole('navigation', { name: completed.name })
    expect(document.querySelector('.game-ring b')?.textContent).toBe(
      includeDlcProgress ? '80%' : '100%',
    )
    expect(
      screen.getByRole('progressbar', { name: 'Progresso no jogo' }).getAttribute('aria-valuenow'),
    ).toBe(includeDlcProgress ? '80' : '100')
  })
}

test('the overview leads with progress; the route, the plan and the guide open on their own pages', () => {
  mockApi({})
  renderApp(<GameScreen current={game} plan={<p>plano</p>} />, {
    value: { me: { ...SAMPLE_ME, revealedTrophyGames: [game.game.id] } },
  })
  expect(screen.getByRole('heading', { level: 1, name: 'DAYS GONE' })).toBeTruthy()
  expect(screen.getByRole('progressbar', { name: 'Progresso no jogo' })).toBeTruthy()
  expect(document.getElementById('journey-trophies')?.textContent).toContain('De raspão')
  expect(screen.getByRole('heading', { name: /^Troféus/ })).toBeTruthy()
  // The route, the plan and the guide wait behind their cards.
  expect(document.querySelector('.trophy-roadmap')).toBeNull()
  expect(document.getElementById('journey-session')).toBeNull()
  expect(document.querySelector('.journey-guide')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: /^Jornada da platina/ }))
  expect(screen.getByRole('heading', { level: 1, name: 'Jornada da platina' })).toBeTruthy()
  expect(
    document.querySelector('.roadmap-step.is-suggested .roadmap-ask')?.getAttribute('href'),
  ).toContain('trophy=')
  fireEvent.click(screen.getByRole('button', { name: 'Voltar para o jogo' }))

  expect(screen.queryByText('plano')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /^Planejar sessão/ }))
  expect(screen.getByText('plano')).toBeTruthy()
  expect(document.getElementById('journey-session')?.textContent).toContain('um roteiro de sessão')
  fireEvent.click(screen.getByRole('button', { name: 'Voltar para o jogo' }))

  fireEvent.click(screen.getByRole('button', { name: /^Guia da platina/ }))
  expect(document.querySelector('.journey-guide')?.textContent).toContain('Burnout Apocalipse')
})

test('no game offers the library without inventing progress', () => {
  renderApp(<GameScreen current={null} plan={<p>plano</p>} />)
  expect(screen.getByRole('link', { name: 'Ver meus jogos' }).getAttribute('href')).toBe('/games')
  expect(screen.queryByText('plano')).toBeNull()
})

test('loading shows skeletons, not an empty or invented journey', () => {
  const { container } = renderApp(<GameScreen current={undefined} plan={null} />)
  expect(container.querySelector('.sk')).toBeTruthy()
  expect(screen.queryByText('Qual vai ser sua próxima platina?')).toBeNull()
})

test('a selected game scopes the plan request', async () => {
  const calls = mockApi({ '/api/plan': { plan: samplePlan } })
  // The plan lives on the session page, so it asks once that page is open.
  renderApp(<Game />, {
    path: '/game?view=session',
    value: { data: { ...SAMPLE_DATA, current: game } },
  })
  await waitFor(() => expect(calls.some((c) => c.path === `/api/plan?np=${game.np}`)).toBe(true))
})

test('before first state skeletons remain; a sync failure is explicit', () => {
  mockApi({ '/api/plan': never })
  const { container, unmount } = renderApp(<Game />, { value: { data: null } })
  expect(container.querySelector('.sk')).toBeTruthy()
  unmount()
  renderApp(<Game />, { value: { data: null, sync: 'failed' } })
  expect(screen.getByRole('alert').textContent).toContain('sincronizar')
})

test('the overview: the trophies by tier and the facts, then the cards in order and the list', () => {
  mockApi({})
  const withFacts = {
    ...current,
    game: { ...current.game, genres: ['Action'], developers: ['Bend Studio'] },
  } as unknown as CurrentGame
  const { container } = renderApp(<GameScreen current={withFacts} plan={null} />)
  const cards = screen.getByRole('navigation', { name: current.name })
  expect(
    within(cards)
      .getAllByRole('button')
      .map((b) => b.querySelector('b')?.textContent),
  ).toEqual(['Jornada da platina', 'Guia da platina', 'Planejar sessão', 'Sobre o jogo'])
  const order = [
    ...container.querySelectorAll('.game-links, .game-tiers, .game-facts, .journey-trophies'),
  ]
  expect(order.map((x) => x.classList[x.classList.length > 1 ? 1 : 0])).toEqual([
    'game-tiers',
    'game-facts',
    'game-links',
    'journey-trophies',
  ])
  expect(container.querySelector('.game-switch')).toBeNull()
  // The game's facts unfold in place under their row, with the overview still around them.
  const about = within(cards).getByRole('button', { name: /^Sobre o jogo/ })
  expect(about.getAttribute('aria-expanded')).toBe('false')
  expect(container.querySelector('.journey-about')).toBeNull()
  fireEvent.click(about)
  expect(about.getAttribute('aria-expanded')).toBe('true')
  const panel = container.querySelector('.game-link-panel.journey-about')
  expect(panel?.previousElementSibling).toBe(about)
  expect(panel?.querySelector('.game-about')?.textContent).toContain('Bend Studio')
  expect(container.querySelector('.journey-trophies')).toBeTruthy()
  fireEvent.click(about)
  expect(about.getAttribute('aria-expanded')).toBe('false')
  expect(container.querySelector('.journey-about')).toBeNull()
})

test('on a game page the floating Nexo opens a conversation about that game', () => {
  mockApi({})
  renderApp(
    <>
      <GameScreen current={game} plan={null} />
      <NexoBubble initial={{ x: 0, y: 0 }} />
    </>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Falar com o Nexo' }))
  expect(screen.getByTestId('location').textContent).toBe(nexoHref(game.np, game.name))
  expect(screen.getByTestId('location').textContent).toStartWith('/nexo?game=')
})
