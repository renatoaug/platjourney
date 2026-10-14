import { afterEach, beforeEach, expect, mock, setSystemTime, test } from 'bun:test'
import { screen, within } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { rankingData } from '../../src/components/game-cards.stories'
import { currentData, tipsData } from '../../src/components/nexo-brief.stories'
import type { ProfileSummary } from '../../src/lib/types'
import { Home } from '../../src/pages/home'
import { mockApi, renderApp } from '../support/web'

// The home's release calendar asks for its own list; these tests are about the rest of the page.
beforeEach(() => {
  mockApi({ '/api/releases': [] })
})

afterEach(() => {
  setSystemTime()
  mock.restore()
})

const loaded = { ...SAMPLE_DATA, current: currentData, tips: tipsData, ranking: rankingData }

test('greets the player by the hour', () => {
  for (const [hour, word] of [
    [9, 'Bom dia'],
    [15, 'Boa tarde'],
    [21, 'Boa noite'],
  ] as const) {
    setSystemTime(new Date(2026, 8, 30, hour))
    const view = renderApp(<Home />, { value: { data: loaded } })
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`${word}, jogador.`)
    expect(screen.getByText('30 de setembro de 2026')).toBeTruthy()
    view.unmount()
  }
})

test('shows the journey, the radar, the goal and the latest from Nexo', () => {
  renderApp(<Home />, { value: { data: loaded } })
  expect(screen.getByText('Cada troféu é um passo. Vamos à sua próxima conquista?')).toBeTruthy()
  const hero = document.getElementById('home-hero') as HTMLElement
  expect(within(hero).getByRole('heading', { name: 'DAYS GONE' })).toBeTruthy()
  expect(within(hero).getByRole('link', { name: /Continuar jornada/ })).toBeTruthy()
  const radar = document.getElementById('home-ranking') as HTMLElement
  expect(within(radar).getAllByRole('link')).toHaveLength(3)
  expect(screen.getByText('Ghost of Tsushima')).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Suas conquistas' }).textContent).toContain(
    'Platinas conquistadas',
  )
  expect(screen.getByText('DESAFIO 2026')).toBeTruthy()
  const tips = document.getElementById('home-tips') as HTMLElement
  expect(tips.querySelectorAll('.tip')).toHaveLength(3)
})

test('chat replies stay out of the activity', () => {
  const chat = { ...tipsData[0], id: 'tip:chat', kind: 'chat', content: 'resposta do chat' }
  renderApp(<Home />, { value: { data: { ...loaded, tips: [chat, ...tipsData] } } })
  expect(screen.queryByText('resposta do chat')).toBeNull()
})

test('a new player: nothing in progress, no activity, profile on its way', () => {
  renderApp(<Home />, {
    value: { data: { ...SAMPLE_DATA, profile: null as unknown as ProfileSummary } },
  })
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sua próxima conquista.')
  expect(screen.getByRole('heading', { name: 'O próximo desafio é seu.' })).toBeTruthy()
  expect(screen.getByText('Nada no radar ainda')).toBeTruthy()
  expect(screen.getByRole('link', { name: /Procurar um jogo/ }).getAttribute('href')).toBe(
    '/guides',
  )
  expect(screen.getByText('O Nexo ainda não falou')).toBeTruthy()
  expect(
    screen.getByText('Seu progresso aparece aqui quando o perfil estiver disponível.'),
  ).toBeTruthy()
})

test('loading: skeletons everywhere', () => {
  const { container } = renderApp(<Home />, { value: { data: null } })
  expect(screen.getByText('Cada troféu é um passo. Vamos ao próximo?')).toBeTruthy()
  expect(container.querySelectorAll('.sk').length).toBeGreaterThan(20)
  expect(screen.queryByText('nada em andamento')).toBeNull()
})
