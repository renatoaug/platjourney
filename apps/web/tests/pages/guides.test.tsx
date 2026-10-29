import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type GuideCardItem, Guides, type GuidesPage } from '../../src/pages/guides'
import { mockApi, renderApp, reply } from '../support/web'

afterEach(() => mock.restore())

const item = (n: number, guide = true): GuideCardItem => ({
  id: `game:${n}`,
  name: `Game ${n}`,
  cover_url: null,
  platforms: ['PS5', 'PS4'],
  release_year: 2020 + n,
  guide: guide
    ? { difficulty: 3, hours: 12, hasMissables: n === 1, hasOnline: n === 1, unobtainable: null }
    : null,
})
// The main list, apart from the shelves above it (which show the same sample games).
const list = () => within(document.querySelector('.guides-main') as HTMLElement)
const inList = (text: string) => waitFor(() => list().getByText(text))

const page = (items: GuideCardItem[], extra: Partial<GuidesPage> = {}): GuidesPage => ({
  page: 1,
  size: 24,
  total: items.length,
  items,
  ...extra,
})

test('the games with a guide, each linking to its page', async () => {
  mockApi({ '/api/guides': page([item(1), item(2)]) })
  renderApp(<Guides />, { path: '/guides', route: '/guides' })
  const first = (await inList('Game 1')).closest('a') as HTMLElement
  expect(first.getAttribute('href')).toContain('/title/game/game%3A1')
  expect(within(first).getByRole('img', { name: 'Dificuldade 3 de 10: Fácil' })).toBeTruthy()
  expect(within(first).getByText('~12h')).toBeTruthy()
  expect(within(first).getByRole('img', { name: 'Tem troféus perdíveis' })).toBeTruthy()
  expect(within(first).getByRole('img', { name: 'Tem troféus online' })).toBeTruthy()
  expect(screen.getByText('2 jogos')).toBeTruthy()
})

test('a game without a guide or with an unavailable platinum says so', async () => {
  const gone = item(3)
  if (gone.guide) gone.guide.unobtainable = 'Servers closed'
  mockApi({ '/api/guides': page([item(2, false), gone]) })
  renderApp(<Guides />, { path: '/guides', route: '/guides' })
  expect(await inList('Sem guia ainda')).toBeTruthy()
  expect(list().getByText('Platina indisponível')).toBeTruthy()
})

test('search, platform and order go to the request', async () => {
  const calls = mockApi({ '/api/guides': page([item(1)]) })
  renderApp(<Guides />, { path: '/guides', route: '/guides' })
  await inList('Game 1')
  fireEvent.click(screen.getByRole('button', { name: 'PS Vita' }))
  await waitFor(() => expect(calls.at(-1)?.path).toBe('/api/guides?platform=PS+Vita'))
  expect(screen.getByRole('button', { name: 'PS Vita' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar por' }), {
    target: { value: 'easiest' },
  })
  await waitFor(() => expect(calls.at(-1)?.path).toBe('/api/guides?platform=PS+Vita&sort=easiest'))
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar jogo' }), {
    target: { value: 'souls' },
  })
  await waitFor(
    () => expect(calls.at(-1)?.path).toBe('/api/guides?q=souls&platform=PS+Vita&sort=easiest'),
    { timeout: 1500 },
  )
  expect(screen.getByRole('option', { name: 'Mais relevantes' })).toBeTruthy()
})

test('the pager asks for the next page', async () => {
  const calls = mockApi({
    '/api/guides': page([item(1)], { total: 30 }),
  })
  renderApp(<Guides />, { path: '/guides', route: '/guides' })
  await inList('Game 1')
  window.scrollTo = mock() as never
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
  await waitFor(() => expect(calls.at(-1)?.path).toBe('/api/guides?page=2'))
})

test('nothing found and a failed load each have their message', async () => {
  mockApi({ '/api/guides': page([]) })
  const { unmount } = renderApp(<Guides />, { path: '/guides', route: '/guides' })
  expect(await screen.findByText('Nenhum jogo encontrado.')).toBeTruthy()
  unmount()
  mock.restore()
  mockApi({ '/api/guides': () => reply(500, { error: 'boom' }) })
  renderApp(<Guides />, { path: '/guides', route: '/guides' })
  expect(
    await screen.findByText('Não conseguimos carregar os guias. Recarregue a página.'),
  ).toBeTruthy()
})

test('an empty search offers to look the game up and keeps a request it cannot find', async () => {
  mockApi({ '/api/guides': page([]) })
  const ask = mock(async () => ({ requested: true }))
  renderApp(<Guides ask={ask} />, { path: '/guides?q=Jogo%20Novo', route: '/guides' })
  fireEvent.click(await screen.findByRole('button', { name: 'Pedir “Jogo Novo”' }))
  expect(ask).toHaveBeenCalledWith('Jogo Novo')
  expect(
    await screen.findByText(
      'Ainda não temos “Jogo Novo”. O pedido ficou registrado para o jogo entrar no catálogo.',
    ),
  ).toBeTruthy()
  expect(await screen.findByText('Pedido de “Jogo Novo” registrado.')).toBeTruthy()
})

test('a game found outside the catalog opens its page', async () => {
  mockApi({ '/api/guides': page([]) })
  const ask = mock(async () => ({ game: 'game:9' }))
  renderApp(<Guides ask={ask} />, { path: '/guides?q=Jogo%20Novo', route: '/guides' })
  fireEvent.click(await screen.findByRole('button', { name: 'Pedir “Jogo Novo”' }))
  await waitFor(() =>
    expect(screen.getByTestId('location').textContent).toBe('/title/game/game%3A9'),
  )
})

test('a failed lookup says so and the button stays', async () => {
  mockApi({ '/api/guides': page([]) })
  renderApp(<Guides ask={() => Promise.reject(new Error('x'))} />, {
    path: '/guides?q=Jogo%20Novo',
    route: '/guides',
  })
  fireEvent.click(await screen.findByRole('button', { name: 'Pedir “Jogo Novo”' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Pedir “Jogo Novo”' })).toBeTruthy()
})

test('an empty list without a search does not offer the lookup', async () => {
  mockApi({ '/api/guides': page([]) })
  renderApp(<Guides />, { path: '/guides?platform=PS3', route: '/guides' })
  expect(await screen.findByText('Nenhum jogo encontrado.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Pedir/ })).toBeNull()
})

test('asking again for the same game says it was already asked for', async () => {
  mockApi({ '/api/guides': page([]) })
  const ask = mock(async () => ({ requested: true, already: true }))
  renderApp(<Guides ask={ask} />, { path: '/guides?q=Jogo%20Novo', route: '/guides' })
  fireEvent.click(await screen.findByRole('button', { name: 'Pedir “Jogo Novo”' }))
  expect(await screen.findByText(/Você já pediu “Jogo Novo”/)).toBeTruthy()
  expect(screen.queryByText('Pedido de “Jogo Novo” registrado.')).toBeNull()
})

test('the filters go to the request, show their counts, and clear together', async () => {
  const calls = mockApi({
    '/api/guides': page([item(1)], {
      facets: {
        difficulty: { easy: 4, medium: 9, hard: 12, brutal: 20 },
        hours: { '10': 2, '25': 5, '50': 9, '100': 15 },
        noMissables: 7,
        onePlaythrough: 11,
        noOnline: 13,
        genres: [{ name: 'Shooter', count: 6 }],
      },
    }),
  })
  renderApp(<Guides />, { path: '/guides', route: '/guides' })
  await inList('Game 1')
  fireEvent.click(screen.getByRole('button', { name: /Fácil/ }))
  await waitFor(() => expect(calls.at(-1)?.path).toContain('difficulty=easy'))
  fireEvent.click(screen.getByRole('button', { name: /Até 25h/ }))
  fireEvent.click(screen.getByRole('button', { name: /Sem perdíveis/ }))
  fireEvent.click(screen.getByRole('button', { name: /Tiro/ }))
  await waitFor(() => {
    const last = calls.at(-1)?.path ?? ''
    expect(last).toContain('hours=25')
    expect(last).toContain('noMissables=1')
    expect(last).toContain('genre=Shooter')
  })
  expect(screen.getByRole('button', { name: /Fácil/ }).textContent).toContain('4')
  fireEvent.click(screen.getByRole('button', { name: /Limpar filtros/ }))
  await waitFor(() => expect(calls.at(-1)?.path).toBe('/api/guides?'))
})

test('the list view shows the same games as rows', async () => {
  mockApi({ '/api/guides': page([item(1), item(2)]) })
  const { container } = renderApp(<Guides />, { path: '/guides', route: '/guides' })
  await inList('Game 1')
  fireEvent.click(screen.getByRole('button', { name: 'Lista' }))
  await waitFor(() => expect(container.querySelectorAll('.guide-row')).toHaveLength(2))
  expect(container.querySelector('.guide-grid')).toBeNull()
})
