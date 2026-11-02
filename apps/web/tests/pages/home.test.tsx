import { afterEach, beforeEach, expect, mock, setSystemTime, test } from 'bun:test'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { rankingData } from '../../src/components/game-cards.stories'
import { currentData, tipsData } from '../../src/components/nexo-brief.stories'
import type { ProfileSummary } from '../../src/lib/types'
import { Home } from '../../src/pages/home'
import { Nexo } from '../../src/pages/nexo'
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
    view.unmount()
  }
})

test('shows the console, the radar, the goal and the latest from Nexo', () => {
  renderApp(<Home />, { value: { data: loaded } })
  const hero = document.getElementById('home-hero') as HTMLElement
  expect(within(hero).getByRole('heading', { level: 2 }).textContent).toBe(currentData.name)
  expect(within(hero).getByRole('button', { name: /Abrir jogo/ })).toBeTruthy()
  const radar = document.getElementById('home-ranking') as HTMLElement
  expect(within(radar).getAllByRole('link')).toHaveLength(3)
  expect(within(radar).getByText('Ghost of Tsushima')).toBeTruthy()
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
  expect(screen.getByText('Jogue algo na PSN e ele aparece aqui, com a arte do jogo.')).toBeTruthy()
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
  expect(container.querySelectorAll('.sk').length).toBeGreaterThan(15)
  expect(screen.queryByText('nada em andamento')).toBeNull()
})

for (const hasHistory of [true, false]) {
  test(`the mounted Home game link opens that game's ${hasHistory ? 'history' : 'draft'}, never the newest other game`, async () => {
    const calls = mockApi({
      '/api/releases': [],
      '/api/chat/threads': [
        {
          game: 'game:unrelated',
          np: 'NPWR99999_00',
          name: 'Outro jogo',
          messages: 2,
          last_at: '2026-11-01T00:00:00Z',
          last_question: 'Outra conversa',
        },
      ],
      [`/api/chat?game=${encodeURIComponent(currentData.game.id)}`]: hasHistory
        ? [{ role: 'assistant', content: 'Histórico do jogo escolhido' }]
        : [],
    })
    renderApp(
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/nexo" element={<Nexo />} />
      </Routes>,
      { value: { data: loaded } },
    )
    fireEvent.click(screen.getByRole('link', { name: 'Perguntar ao Nexo' }))
    await waitFor(() =>
      expect(
        calls.some((c) => c.path === `/api/chat?game=${encodeURIComponent(currentData.game.id)}`),
      ).toBe(true),
    )
    if (hasHistory) expect(await screen.findByText('Histórico do jogo escolhido')).toBeTruthy()
    else
      await waitFor(() =>
        expect(screen.getByRole('combobox', { name: 'Mensagem para Nexo' })).toBeTruthy(),
      )
    expect(calls.some((c) => c.path.includes('game%3Aunrelated'))).toBe(false)
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })
}
