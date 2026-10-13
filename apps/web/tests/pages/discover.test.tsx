import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { rankingData } from '../../src/components/game-cards.stories'
import { recsData } from '../../src/components/recommendations.stories'
import { serversData } from '../../src/components/servers.stories'
import { Discover } from '../../src/pages/discover'
import { MODEL_WORK_DONE } from '../../src/ui/plugin-slot'
import { mockApi, never, renderApp, reply } from '../support/web'

afterEach(() => mock.restore())

const loaded = { ...SAMPLE_DATA, ranking: rankingData, servers: serversData }
const recs = () => document.getElementById('recs') as HTMLElement
const refresh = () => screen.getByRole('button', { name: 'Gerar novas recomendações' })

test('the library ranking and the recommendations, without the server alerts', async () => {
  const done = mock()
  window.addEventListener(MODEL_WORK_DONE, done)
  const cache: Record<string, unknown> = {}
  mockApi({ '/api/recommendations': recsData })
  renderApp(<Discover />, { value: { data: loaded, cache } })
  const ranking = document.getElementById('ranking') as HTMLElement
  expect(within(ranking).getAllByRole('link')).toHaveLength(3)
  expect(screen.queryByRole('heading', { name: 'Servidores online' })).toBeNull()
  expect(refresh().hasAttribute('disabled')).toBe(true)
  expect(await within(recs()).findByText(/Horizon Zero Dawn/)).toBeTruthy()
  expect(refresh().hasAttribute('disabled')).toBe(false)
  expect(done).toHaveBeenCalledTimes(1)
  window.removeEventListener(MODEL_WORK_DONE, done)
  expect(cache.recs).toEqual(recsData)
  expect(cache.recsLoad).toBeUndefined()
})

test('cached recommendations cost nothing on the next visit', () => {
  const calls = mockApi({})
  renderApp(<Discover />, { value: { data: loaded, cache: { recs: recsData } } })
  expect(within(recs()).getByText(/Sekiro/)).toBeTruthy()
  expect(calls).toHaveLength(0)
})

test('coming back mid-load waits for the request already running', async () => {
  const calls = mockApi({})
  let finish: (r: typeof recsData) => void = () => {}
  const pending = new Promise<typeof recsData>((r) => {
    finish = r
  })
  renderApp(<Discover />, { value: { data: loaded, cache: { recsLoad: pending } } })
  expect(recs().querySelector('.sk')).toBeTruthy()
  finish(recsData)
  expect(await within(recs()).findByText(/Sekiro/)).toBeTruthy()
  expect(calls).toHaveLength(0)
})

test('the refresh button asks for fresh ones', async () => {
  const calls = mockApi({
    '/api/recommendations?refresh=1': { profile: null, items: [recsData.items[1]] },
  })
  renderApp(<Discover />, { value: { data: loaded, cache: { recs: recsData } } })
  fireEvent.click(refresh())
  await waitFor(() => expect(within(recs()).queryByText(/Horizon Zero Dawn/)).toBeNull())
  expect(within(recs()).getByText(/Sekiro/)).toBeTruthy()
  expect(calls[0].path).toBe('/api/recommendations?refresh=1')
})

test('a failed search says so', async () => {
  mockApi({ '/api/recommendations': reply(500) })
  renderApp(<Discover />, { value: { data: loaded } })
  expect(await within(recs()).findByRole('alert')).toBeTruthy()
  expect(recs().textContent).toContain('Não conseguimos montar suas recomendações agora.')
})

test('dismissing a game drops it and says it will not come back', async () => {
  const cache: Record<string, unknown> = { recs: recsData }
  const calls = mockApi({
    'POST /api/recommendations/dismiss': { ...recsData, items: [recsData.items[1]] },
  })
  renderApp(<Discover />, { value: { data: loaded, cache } })
  fireEvent.click(screen.getByRole('button', { name: 'Não recomendar Horizon Zero Dawn' }))
  fireEvent.click(screen.getByRole('button', { name: 'Só remover' }))
  expect(await screen.findByText('Horizon Zero Dawn não aparece mais')).toBeTruthy()
  expect(within(recs()).queryByText(/Horizon Zero Dawn/)).toBeNull()
  expect(calls[0].body).toEqual({ game: 'game:10' })
  expect((cache.recs as typeof recsData).items).toHaveLength(1)
})

test('a reason goes along and the toast says Nexo takes it into account', async () => {
  const calls = mockApi({
    'POST /api/recommendations/dismiss': { ...recsData, items: [recsData.items[1]] },
  })
  renderApp(<Discover />, { value: { data: loaded, cache: { recs: recsData } } })
  fireEvent.click(screen.getByRole('button', { name: 'Não recomendar Horizon Zero Dawn' }))
  fireEvent.click(screen.getByRole('button', { name: 'Muito longo' }))
  expect(
    await screen.findByText('Horizon Zero Dawn saiu. O Nexo leva isso em conta nas próximas.'),
  ).toBeTruthy()
  expect(calls[0].body).toEqual({ game: 'game:10', reason: 'too_long' })
})

test('a failed dismiss keeps the game and warns', async () => {
  mockApi({ 'POST /api/recommendations/dismiss': reply(500) })
  renderApp(<Discover />, { value: { data: loaded, cache: { recs: recsData } } })
  fireEvent.click(screen.getByRole('button', { name: 'Não recomendar Sekiro: Shadows Die Twice' }))
  fireEvent.click(screen.getByRole('button', { name: 'Só remover' }))
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Não conseguimos remover.'),
  )
  expect(within(recs()).getByText(/Sekiro/)).toBeTruthy()
})

test('empty: nothing in progress and no recommendations', () => {
  renderApp(<Discover />, {
    value: { cache: { recs: { profile: null, items: [] } } },
  })
  expect(screen.getByText('Nada em andamento ainda')).toBeTruthy()
  expect(screen.getByRole('link', { name: /Procurar um jogo/ }).getAttribute('href')).toBe(
    '/guides',
  )
  expect(screen.getByText('Nenhuma recomendação ainda')).toBeTruthy()
})

test('loading: skeletons for the ranking and the recommendations', () => {
  mockApi({ '/api/recommendations': never })
  const { container } = renderApp(<Discover />, { value: { data: null } })
  expect(container.querySelectorAll('#ranking .row')).toHaveLength(10)
})

test('the library pages ten at a time', () => {
  mockApi({})
  const many = Array.from({ length: 13 }, (_, i) => ({ ...rankingData[0], game: `game:r${i}` }))
  renderApp(<Discover />, {
    value: { data: { ...loaded, ranking: many }, cache: { recs: recsData } },
  })
  const ranking = document.getElementById('ranking') as HTMLElement
  expect(within(ranking).getAllByRole('link')).toHaveLength(10)
  fireEvent.click(screen.getByRole('button', { name: 'Página 2' }))
  expect(within(ranking).getAllByRole('link')).toHaveLength(3)
})

test('Customize opens the taste profile', () => {
  mockApi({})
  renderApp(<Discover />, { value: { data: loaded, cache: { recs: recsData } } })
  const details = document.querySelector('#taste details') as HTMLDetailsElement
  expect(details.open).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: /Personalizar/ }))
  expect(details.open).toBe(true)
})

test('a library with nothing to learn from says so and does not offer a search', async () => {
  mockApi({ '/api/recommendations': { profile: null, items: [], reason: 'no-library' } })
  renderApp(<Discover />, { value: { data: { ...SAMPLE_DATA, ranking: [], servers: [] } } })
  expect(await screen.findByText('Seu gosto ainda é um mistério')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Gerar novas recomendações' })).toBeNull()
})

test('profile changes stay a draft until saved; saving can bring new picks', async () => {
  const calls = mockApi({
    'POST /api/recommendations/preferences': { ...recsData, prefs: undefined },
    '/api/recommendations?refresh=1': recsData,
  })
  renderApp(<Discover />, { value: { data: loaded, cache: { recs: recsData } } })
  fireEvent.click(screen.getByText('Ver perfil completo'))
  fireEvent.click(screen.getByRole('button', { name: 'Tirar Troféus online' }))
  expect(screen.queryByRole('button', { name: 'Tirar Troféus online' })).toBeNull()
  expect(calls.some((c) => c.path === '/api/recommendations/preferences')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
  expect(screen.getByRole('button', { name: 'Tirar Troféus online' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Tirar Troféus online' }))
  fireEvent.click(screen.getByRole('button', { name: 'Salvar e gerar novas recomendações' }))
  await waitFor(() =>
    expect(calls.some((c) => c.path === '/api/recommendations?refresh=1')).toBe(true),
  )
  const sent = calls.find((c) => c.path === '/api/recommendations/preferences')
  const body = sent?.body as { removed: { avoid: string[] } } | undefined
  expect(body?.removed.avoid).toEqual(['Troféus online'])
})

test('a failed save says so', async () => {
  mockApi({ 'POST /api/recommendations/preferences': reply(500) })
  renderApp(<Discover />, { value: { data: loaded, cache: { recs: recsData } } })
  fireEvent.click(screen.getByText('Ver perfil completo'))
  fireEvent.click(screen.getByRole('button', { name: 'Tirar Troféus online' }))
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(await screen.findByText('Não conseguimos salvar seu perfil. Tenta de novo.')).toBeTruthy()
})
