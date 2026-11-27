import { expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { SAMPLE_ME } from '../../src/app/app-state'
import type { GameMapData, MapPoint } from '../../src/components/game-map'
import { mockApi, renderApp, reply } from '../support/web'

// The map engine needs WebGL: a stand-in draws each pin as a button, so the page around it is tested.
mock.module('../../src/components/game-map-canvas', () => ({
  default: ({
    points,
    onSelect,
  }: {
    points: MapPoint[]
    onSelect: (id: string | null) => void
  }) => (
    <div data-testid="canvas">
      {points.map((p) => (
        <button key={p.id} type="button" onClick={() => onSelect(p.id)}>
          pin {p.id}
        </button>
      ))}
    </div>
  ),
}))

const { GameMap, GameMapSkeleton } = await import('../../src/components/game-map')

const map: GameMapData = {
  background: 'water',
  minZoom: 2,
  maxZoom: 8,
  tileMaxZoom: 6,
  center: [0, 0],
  zoom: 3,
  attribution: 'Mapa: © Exemplo',
  categories: [
    { id: 'cards', name: { 'pt-BR': 'Cartas', en: 'Cards' }, icon: 'cards' },
    { id: 'banks', name: { 'pt-BR': 'Bancos', en: 'Banks' }, icon: 'shield' },
  ],
  points: [
    {
      id: 'cards-1',
      category: 'cards',
      lng: 0,
      lat: 0,
      title: 'Sammy',
      detail: { 'pt-BR': 'No armário.', en: 'On the cabinet.' },
    },
    { id: 'cards-2', category: 'cards', lng: 1, lat: 1, approx: true },
    { id: 'banks-1', category: 'banks', lng: 2, lat: 2, title: 'Fleeca' },
  ],
}
const game = 'game:52189'

test('the map shows every spot, one category at a time, and only what is left', async () => {
  mockApi({ '/api/game-map': map, '/api/game-map/collected': { spots: ['banks-1'] } })
  renderApp(<GameMap game={game} />)
  await screen.findByText('pin cards-1')
  expect(screen.getAllByText(/^pin /)).toHaveLength(3)
  fireEvent.click(screen.getByRole('button', { name: /Cartas/ }))
  expect(screen.getAllByText(/^pin /)).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: /Tudo/ }))
  await screen.findByText('1 de 3 coletados')
  fireEvent.click(screen.getByRole('button', { name: /Só o que falta/ }))
  expect(screen.queryByText('pin banks-1')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Bancos/ }))
  expect(screen.getByText('Nada para mostrar com esses filtros.')).toBeTruthy()
})

test('a chosen spot shows its card in the page language, and marking it goes to the account', async () => {
  const calls = mockApi({
    '/api/game-map': map,
    'GET /api/game-map/collected': { spots: [] },
    'POST /api/game-map/collected': { spots: ['cards-1'] },
  })
  renderApp(<GameMap game={game} />)
  fireEvent.click(await screen.findByText('pin cards-1'))
  expect(screen.getByText('No armário.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Marcar como coletado/ }))
  await screen.findByRole('button', { name: /Desmarcar/ })
  expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
    game,
    spot: 'cards-1',
    collected: true,
  })
  fireEvent.click(screen.getByText('pin cards-2'))
  expect(screen.getByText('Posição aproximada: o centro do bairro.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
  expect(screen.queryByText('Posição aproximada: o centro do bairro.')).toBeNull()
})

test('a failed mark is undone, and the credit opens behind its button', async () => {
  mockApi({
    '/api/game-map': map,
    'GET /api/game-map/collected': { spots: [] },
    'POST /api/game-map/collected': reply(500),
  })
  renderApp(<GameMap game={game} />)
  fireEvent.click(await screen.findByText('pin banks-1'))
  fireEvent.click(screen.getByRole('button', { name: /Marcar como coletado/ }))
  await screen.findByRole('button', { name: /Marcar como coletado/ })
  expect(screen.queryByText('Mapa: © Exemplo')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Créditos do mapa' }))
  expect(screen.getByText('Mapa: © Exemplo')).toBeTruthy()
})

test('without an account the marks stay on the device', async () => {
  localStorage.setItem(`pj-map-collected:${game}`, JSON.stringify(['cards-2']))
  const calls = mockApi({ '/api/game-map': map })
  renderApp(<GameMap game={game} />, { value: { me: { ...SAMPLE_ME, visitor: true } } })
  await screen.findByText('1 de 3 coletados')
  fireEvent.click(screen.getByText('pin cards-1'))
  fireEvent.click(screen.getByRole('button', { name: /Marcar como coletado/ }))
  await screen.findByText('2 de 3 coletados')
  expect(JSON.parse(localStorage.getItem(`pj-map-collected:${game}`) ?? '[]')).toEqual([
    'cards-2',
    'cards-1',
  ])
  expect(calls.some((c) => c.path.includes('collected'))).toBe(false)
  localStorage.clear()
})

test('a game without a map says so; a failed map offers to try again', async () => {
  mockApi({ '/api/game-map': reply(404) })
  const { unmount } = renderApp(<GameMap game={game} />)
  await screen.findByText('Este jogo ainda não tem mapa.')
  unmount()
  let tries = 0
  mockApi({ '/api/game-map': () => (tries++ ? map : reply(500)) })
  renderApp(<GameMap game={game} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
  await waitFor(() => expect(screen.getAllByText(/^pin /)).toHaveLength(3))
})

test('the skeleton keeps the map and the filters in place', () => {
  const { container } = renderApp(<GameMapSkeleton />)
  expect(container.querySelector('.game-map[aria-busy="true"] .game-map-chips')).toBeTruthy()
})
