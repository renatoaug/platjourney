import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { rankingData } from '../../src/components/game-cards.stories'
import { recsData } from '../../src/components/recommendations.stories'
import { serversData } from '../../src/components/servers.stories'
import { similarData } from '../../src/components/similar-picks.stories'
import { setLocale } from '../../src/i18n/locale'
import type { SimilarRecs } from '../../src/lib/types'
import { Discover } from '../../src/pages/discover'
import { MODEL_WORK_DONE } from '../../src/plugins'
import { mockApi, never, renderApp, reply } from '../support/web'

afterEach(() => mock.restore())

const loaded = { ...SAMPLE_DATA, ranking: rankingData, servers: serversData }
const none: SimilarRecs = { items: [], quick: [], series: [] }
const recs = () => document.getElementById('recs') as HTMLElement
const similar = () => document.getElementById('similar') as HTMLElement
const refresh = () => screen.getByRole('button', { name: /Gerar de novo/ })
const row = (name: string) => within(similar()).getByRole('link', { name: new RegExp(name) })
// Nexo's picks already asked for.
const asked = (extra: Record<string, unknown> = {}) => ({
  similar: similarData,
  recs: recsData,
  ...extra,
})
const reason = (link: HTMLElement) => link.querySelector('.band-reason')?.textContent

test('by default: games like the player’s, with the games that led to each one', async () => {
  const cache: Record<string, unknown> = {}
  const calls = mockApi({ '/api/recommendations/similar': similarData })
  renderApp(<Discover />, { value: { data: loaded, cache } })
  const ranking = document.getElementById('ranking') as HTMLElement
  expect(within(ranking).getAllByRole('link')).toHaveLength(3)
  expect(screen.queryByRole('heading', { name: 'Servidores online' })).toBeNull()
  // Nexo's section comes first and waits to be asked; then the similar games, then the library.
  const sections = [...document.querySelectorAll('section.game-band')]
  expect(sections.map((x) => x.id)).toEqual(['recs', 'similar', 'ranking'])
  expect(within(recs()).getByRole('button', { name: /Pedir ao Nexo/ })).toBeTruthy()
  expect(similar().querySelector('.sk')).toBeTruthy()
  const horizon = await within(similar()).findByRole('link', { name: /Horizon Zero Dawn/ })
  expect(horizon.getAttribute('href')).toBe('/title/game/game%3A10')
  const because = horizon.querySelector('.band-reason') as HTMLElement
  expect(because.textContent).toBe('Parecido com Days Gone e Ghost of Tsushima')
  expect([...because.querySelectorAll('strong')].map((b) => b.textContent)).toEqual([
    'Days Gone',
    'Ghost of Tsushima',
  ])
  expect(horizon.textContent).toContain('~50h')
  expect(within(horizon).getByRole('img', { name: '1 jogada' })).toBeTruthy()
  expect(reason(row('Sekiro'))).toBe('Parecido com Bloodborne, que você platinou')
  expect(within(row('Sekiro')).getByRole('img', { name: 'Há troféus perdíveis' })).toBeTruthy()
  expect(reason(row('Spider-Man'))).toBe(
    'Parecido com Days Gone, Ghost of Tsushima e inFAMOUS Second Son',
  )
  // Nexo is not asked for anything until the player wants it.
  expect(calls.map((c) => c.path)).toEqual(['/api/recommendations/similar'])
  expect(cache.similar).toEqual(similarData)
  expect(cache.similarLoad).toBeUndefined()
})

test('the because line in English', async () => {
  setLocale('en', { persist: false })
  mockApi({})
  renderApp(<Discover />, { value: { data: loaded, cache: { similar: similarData } } })
  expect(reason(row('Horizon'))).toBe('Like Days Gone and Ghost of Tsushima')
  expect(reason(row('Sekiro'))).toBe('Like Bloodborne, which you platinumed')
})

test('short platinums and the same series in their bands', () => {
  mockApi({})
  renderApp(<Discover />, { value: { data: loaded, cache: { similar: similarData } } })
  const quick = screen.getByRole('region', { name: 'Platina relâmpago' })
  expect(within(quick).getAllByRole('link')).toHaveLength(2)
  const astro = within(quick).getByRole('link', { name: /Astro/ })
  expect(astro.getAttribute('href')).toBe('/title/game/game%3A20')
  expect(astro.textContent).toContain('~6h')
  expect(
    within(astro.closest('article') as HTMLElement).getByRole('img', {
      name: 'Dificuldade 2 de 10: Fácil',
    }),
  ).toBeTruthy()
  const series = screen.getByRole('region', { name: 'Na mesma série' })
  const forbidden = within(series).getByRole('link', { name: /Horizon Forbidden West/ })
  expect(reason(forbidden)).toBe('Você platinou Horizon Zero Dawn')
  expect(forbidden.querySelector('.band-reason strong')?.textContent).toBe('Horizon Zero Dawn')
})

test('a series game the player only played says so', () => {
  mockApi({})
  const series = [{ ...similarData.series[0], platinumed: [] }]
  renderApp(<Discover />, {
    value: { data: loaded, cache: { similar: { ...similarData, series } } },
  })
  const band = screen.getByRole('region', { name: 'Na mesma série' })
  expect(reason(within(band).getByRole('link'))).toBe('Você jogou Horizon Zero Dawn')
})

test('the bands are left out when they have nothing', () => {
  mockApi({})
  renderApp(<Discover />, {
    value: { data: loaded, cache: { similar: { ...similarData, quick: [], series: [] } } },
  })
  expect(screen.queryByRole('region', { name: 'Platina relâmpago' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Na mesma série' })).toBeNull()
  expect(within(similar()).getAllByRole('link')).toHaveLength(3)
})

test('the bands wait for the similar games instead of flashing', () => {
  mockApi({ '/api/recommendations/similar': never })
  renderApp(<Discover />, { value: { data: loaded } })
  expect(screen.queryByRole('region', { name: 'Platina relâmpago' })).toBeNull()
})

test('a failed similarity search says so', async () => {
  mockApi({ '/api/recommendations/similar': reply(500) })
  renderApp(<Discover />, { value: { data: loaded } })
  expect((await within(similar()).findByRole('alert')).textContent).toContain(
    'Não conseguimos buscar jogos parecidos',
  )
  expect(screen.queryByRole('region', { name: 'Platina relâmpago' })).toBeNull()
})

test('no similar game yet', () => {
  mockApi({})
  renderApp(<Discover />, { value: { cache: { similar: none } } })
  expect(screen.getByText('Nenhum jogo parecido ainda')).toBeTruthy()
  expect(screen.getByText('Nada em andamento ainda')).toBeTruthy()
  expect(screen.getByRole('link', { name: /Procurar um jogo/ }).getAttribute('href')).toBe(
    '/guides',
  )
})

test('rules that leave every similar game out say so and lead to them', async () => {
  mockApi({})
  const prefs = {
    added: { genres: [], traits: [], avoid: [] },
    removed: { genres: [], traits: [], avoid: [] },
    filters: { noMissables: true },
  }
  renderApp(<Discover />, {
    value: { data: loaded, cache: { similar: none, recs: { ...recsData, prefs } } },
  })
  expect(screen.getByText('Nenhum parecido passa nos seus filtros')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Ajustar filtros/ }))
  await waitFor(() =>
    expect((document.querySelector('#taste details') as HTMLDetailsElement).open).toBe(true),
  )
})

test('Pedir ao Nexo shows the stored batch, without forcing a new one', async () => {
  const done = mock()
  window.addEventListener(MODEL_WORK_DONE, done)
  const cache: Record<string, unknown> = { similar: similarData }
  const calls = mockApi({ '/api/recommendations': recsData })
  renderApp(<Discover />, { value: { data: loaded, cache } })
  expect(within(recs()).getByText('ANÁLISE DO NEXO')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Gerar de novo/ })).toBeNull()
  expect(calls).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: /Pedir ao Nexo/ }))
  expect(await within(recs()).findByText(/Horizon Zero Dawn/)).toBeTruthy()
  expect(refresh()).toBeTruthy()
  expect(calls.map((c) => c.path)).toEqual(['/api/recommendations'])
  expect(done).toHaveBeenCalledTimes(1)
  window.removeEventListener(MODEL_WORK_DONE, done)
  expect(cache.recs).toEqual(recsData)
  expect(cache.recsLoad).toBeUndefined()
})

test('Gerar de novo asks Nexo for fresh ones', async () => {
  const calls = mockApi({
    '/api/recommendations?refresh=1': { profile: null, items: [recsData.items[1]] },
  })
  renderApp(<Discover />, { value: { data: loaded, cache: asked() } })
  fireEvent.click(refresh())
  expect(refresh().hasAttribute('disabled')).toBe(true)
  await waitFor(() => expect(within(recs()).queryByText(/Horizon Zero Dawn/)).toBeNull())
  expect(within(recs()).getByText(/Sekiro/)).toBeTruthy()
  expect(calls[0].path).toBe('/api/recommendations?refresh=1')
})

test('Nexo’s picks already asked for cost nothing on the next visit', () => {
  const calls = mockApi({})
  renderApp(<Discover />, { value: { data: loaded, cache: asked() } })
  expect(within(recs()).getByText(/Sekiro/)).toBeTruthy()
  expect(calls).toHaveLength(0)
})

test('coming back mid-load waits for the request already running', async () => {
  const calls = mockApi({})
  let finish: (r: typeof recsData) => void = () => {}
  const pending = new Promise<typeof recsData>((r) => {
    finish = r
  })
  renderApp(<Discover />, {
    value: {
      data: loaded,
      cache: { similar: similarData, recsLoad: pending },
    },
  })
  expect(recs().querySelector('.sk')).toBeTruthy()
  finish(recsData)
  expect(await within(recs()).findByText(/Sekiro/)).toBeTruthy()
  expect(calls).toHaveLength(0)
})

test('a failed Nexo search says so', async () => {
  mockApi({ '/api/recommendations': reply(500) })
  renderApp(<Discover />, { value: { data: loaded, cache: { similar: similarData } } })
  fireEvent.click(screen.getByRole('button', { name: /Pedir ao Nexo/ }))
  expect(await within(recs()).findByRole('alert')).toBeTruthy()
  expect(recs().textContent).toContain('Não conseguimos montar suas recomendações agora.')
})

test('dismissing a similar game drops it without loading Nexo’s picks', async () => {
  const cache: Record<string, unknown> = { similar: similarData }
  const calls = mockApi({
    'POST /api/recommendations/dismiss': { ...recsData, items: [recsData.items[1]] },
  })
  renderApp(<Discover />, { value: { data: loaded, cache } })
  fireEvent.click(screen.getByRole('button', { name: 'Não recomendar Horizon Zero Dawn' }))
  fireEvent.click(screen.getByRole('button', { name: 'Só remover' }))
  expect(await screen.findByText('Horizon Zero Dawn não aparece mais')).toBeTruthy()
  expect(within(similar()).queryByText(/Horizon Zero Dawn/)).toBeNull()
  expect(calls[0].body).toEqual({ game: 'game:10' })
  expect((cache.similar as SimilarRecs).items).toHaveLength(2)
  expect(cache.recs).toBeUndefined()
})

test('dismissing one of Nexo’s picks drops it and says it will not come back', async () => {
  const cache: Record<string, unknown> = asked()
  const calls = mockApi({
    'POST /api/recommendations/dismiss': { ...recsData, items: [recsData.items[1]] },
  })
  renderApp(<Discover />, { value: { data: loaded, cache } })
  fireEvent.click(within(recs()).getByRole('button', { name: 'Não recomendar Horizon Zero Dawn' }))
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
  renderApp(<Discover />, { value: { data: loaded, cache: asked() } })
  fireEvent.click(within(recs()).getByRole('button', { name: 'Não recomendar Horizon Zero Dawn' }))
  fireEvent.click(screen.getByRole('button', { name: 'Muito longo' }))
  expect(
    await screen.findByText('Horizon Zero Dawn saiu. O Nexo leva isso em conta nas próximas.'),
  ).toBeTruthy()
  expect(calls[0].body).toEqual({ game: 'game:10', reason: 'too_long' })
})

test('a failed dismiss keeps the game and warns', async () => {
  mockApi({ 'POST /api/recommendations/dismiss': reply(500) })
  renderApp(<Discover />, { value: { data: loaded, cache: asked() } })
  fireEvent.click(
    within(recs()).getByRole('button', { name: 'Não recomendar Sekiro: Shadows Die Twice' }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Só remover' }))
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Não conseguimos remover.'),
  )
  expect(within(recs()).getByText(/Sekiro/)).toBeTruthy()
})

test('Nexo’s section with an empty batch', () => {
  renderApp(<Discover />, {
    value: { cache: asked({ recs: { profile: null, items: [] } }) },
  })
  expect(screen.getByText('Nenhuma recomendação ainda')).toBeTruthy()
})

test('loading: skeletons for the ranking and the similar games', () => {
  mockApi({ '/api/recommendations/similar': never })
  const { container } = renderApp(<Discover />, { value: { data: null } })
  expect(container.querySelectorAll('#ranking .band-card')).toHaveLength(6)
  expect(container.querySelectorAll('#similar .band-card')).toHaveLength(6)
})

test('the library: one card per game in the ranking order, six a page', () => {
  mockApi({})
  const many = Array.from({ length: 8 }, (_, i) => ({
    ...rankingData[0],
    game: `game:r${i}`,
    name: `Jogo ${i}`,
  }))
  renderApp(<Discover />, {
    value: { data: { ...loaded, ranking: many }, cache: { similar: similarData } },
  })
  const ranking = document.getElementById('ranking') as HTMLElement
  expect(within(ranking).getByRole('heading', { name: 'Próxima platina' })).toBeTruthy()
  const links = within(ranking).getAllByRole('link')
  expect(links).toHaveLength(6)
  expect(links[0].getAttribute('href')).toBe('/title/game/game%3Ar0')
  expect(ranking.querySelector('.band-tag')?.textContent).toBe('1')
  expect(within(ranking).getByText('1/2')).toBeTruthy()
  fireEvent.click(within(ranking).getByRole('button', { name: 'Próxima página' }))
  expect(within(ranking).getAllByRole('link')).toHaveLength(2)
  expect(ranking.querySelector('.band-tag')?.textContent).toBe('7')
})

test('Customize opens the taste profile', () => {
  mockApi({})
  renderApp(<Discover />, { value: { data: loaded, cache: asked() } })
  const details = document.querySelector('#taste details') as HTMLDetailsElement
  expect(details.open).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: /Personalizar/ }))
  expect(details.open).toBe(true)
})

test('a library with nothing to learn from says so and offers no Nexo search', async () => {
  mockApi({ '/api/recommendations/similar': { ...none, reason: 'no-library' } })
  renderApp(<Discover />, {
    value: { data: { ...SAMPLE_DATA, ranking: [], servers: [] } },
  })
  expect(await screen.findByText('Seu gosto ainda é um mistério')).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Escolhas do Nexo' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Pedir ao Nexo/ })).toBeNull()
})

test('profile changes stay a draft until saved; saving can bring new picks', async () => {
  const calls = mockApi({
    'POST /api/recommendations/preferences': { ...recsData, prefs: undefined },
    '/api/recommendations?refresh=1': recsData,
    '/api/recommendations/similar': similarData,
  })
  renderApp(<Discover />, { value: { data: loaded, cache: asked() } })
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
  // The rules apply to the similar games too.
  expect(calls.some((c) => c.path === '/api/recommendations/similar')).toBe(true)
})

test('a failed save says so', async () => {
  mockApi({ 'POST /api/recommendations/preferences': reply(500) })
  renderApp(<Discover />, { value: { data: loaded, cache: asked() } })
  fireEvent.click(screen.getByText('Ver perfil completo'))
  fireEvent.click(screen.getByRole('button', { name: 'Tirar Troféus online' }))
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(await screen.findByText('Não conseguimos salvar seu perfil. Tenta de novo.')).toBeTruthy()
})
