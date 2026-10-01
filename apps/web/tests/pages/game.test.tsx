import { afterEach, expect, mock, test } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { samplePlan } from '../../src/components/plan.stories'
import { current } from '../../src/fixtures'
import type { CurrentGame } from '../../src/lib/types'
import { Game, GameScreen } from '../../src/pages/game'
import { mockApi, never, renderApp } from '../support/web'

afterEach(() => mock.restore())

const game = current as unknown as CurrentGame

test('the current game: hero, trophies and guide', () => {
  renderApp(<GameScreen current={game} plan={<p>plano</p>} />)
  expect(screen.getByRole('heading', { level: 1, name: 'Jogo atual' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'DAYS GONE' })).toBeTruthy()
  expect(screen.getByText('plano')).toBeTruthy()
  expect(document.getElementById('trophies-card')?.textContent).toContain('De raspão')
  expect(document.getElementById('guide-card')?.textContent).toContain('Burnout Apocalipse')
  expect(screen.getByRole('link', { name: 'perguntar ao Nexo' }).getAttribute('href')).toBe('/nexo')
})

test('no game yet: only the hero, with how to start', () => {
  renderApp(<GameScreen current={null} plan={<p>plano</p>} />)
  expect(screen.getByRole('heading', { name: 'O próximo desafio é seu.' })).toBeTruthy()
  expect(screen.queryByText('plano')).toBeNull()
  expect(document.getElementById('trophies-card')).toBeNull()
})

test('loading: skeletons for the hero and the guide', () => {
  const { container } = renderApp(<GameScreen current={undefined} plan={null} />)
  expect(screen.getByRole('heading', { name: 'Troféus' })).toBeTruthy()
  expect(container.querySelector('#game-hero .sk')).toBeTruthy()
  expect(container.querySelector('#guide-card .sk')).toBeTruthy()
})

test('the screen reads the app state and loads the session plan', async () => {
  const calls = mockApi({ '/api/plan': { plan: samplePlan } })
  renderApp(<Game />, { value: { data: { ...SAMPLE_DATA, current: game } } })
  expect(screen.getByRole('heading', { name: 'DAYS GONE' })).toBeTruthy()
  await waitFor(() => expect(calls.some((c) => c.path === '/api/plan')).toBe(true))
})

test('before the first state the screen is loading', () => {
  mockApi({ '/api/plan': never })
  const { container } = renderApp(<Game />, { value: { data: null } })
  expect(container.querySelector('#game-hero .sk')).toBeTruthy()
})
