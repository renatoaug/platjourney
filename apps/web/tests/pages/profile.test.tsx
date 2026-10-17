import { afterEach, expect, jest, mock, test } from 'bun:test'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { SAMPLE_ME } from '../../src/app/app-state'
import { Profile } from '../../src/pages/profile'
import { profileData } from '../../src/pages/profile.stories'
import { mockApi, never, renderApp, reply } from '../support/web'

afterEach(() => {
  jest.useRealTimers()
  mock.restore()
})

const results = () => document.getElementById('platinum-results')?.textContent
const list = () => document.getElementById('platinum-list') as HTMLElement
const search = () => screen.getByRole('textbox', { name: 'Buscar platina' })

test('the profile: identity, tiles, the collection and the yearly rhythm', async () => {
  mockApi({ '/api/profile': profileData })
  const { container } = renderApp(<Profile />)
  expect(container.querySelector('#profile-page .sk')).toBeTruthy()
  expect(await screen.findByRole('heading', { level: 1, name: 'jogador' })).toBeTruthy()
  expect(container.querySelector('.profile-platforms')?.textContent).toContain('PS5 24')
  expect(screen.getAllByText('40% para o 313')).toHaveLength(2)
  const tiles = container.querySelector('.profile-tiles') as HTMLElement
  const year = new Date().getFullYear()
  const count = profileData.byYear.find((y) => y.year === year)?.count ?? 0
  expect(tiles.textContent).toContain(`${count} em ${year}`)
  expect(tiles.textContent).toContain('2.972')
  expect(tiles.textContent).not.toContain('mais jogado')
  expect(tiles.textContent).not.toContain('Platina mais rara')
  const rarest = container.querySelector('.profile-rarest') as HTMLElement
  expect(rarest.textContent).toContain('Platina mais rara')
  expect(rarest.textContent).toContain('2,4% de quem joga tem')
  expect(tiles.textContent).toContain('Melhor mês')
  expect(screen.getByRole('heading', { name: 'Platinas 10' })).toBeTruthy()
  expect(results()).toBe('1–10 de 10 platinas')
  const rows = within(list()).getAllByRole('link')
  expect(rows).toHaveLength(10)
  expect(rows[0].getAttribute('href')).toBe('/title/game/game%3A0')
  expect(rows[1].textContent).toContain('27h jogadas')
  expect(rows[0].textContent).not.toContain('jogadas')
  expect(container.querySelectorAll('.years .year')).toHaveLength(5)
  // The settings live on their own page now.
  expect(screen.queryByRole('tab')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Conta' })).toBeNull()
})

test('pages through the collection with the standard pager', async () => {
  const scroll = mock()
  const original = HTMLElement.prototype.scrollIntoView
  HTMLElement.prototype.scrollIntoView = scroll
  // Thirty platinums: three pages, so the middle one has both buttons enabled.
  const platinums = [0, 1, 2, 3, 4, 5].flatMap((round) =>
    profileData.platinums.slice(0, 5).map((p) => ({
      ...p,
      game: { ...p.game, id: `${p.game.id}-${round}` },
    })),
  )
  try {
    mockApi({ '/api/profile': { ...profileData, platinums } })
    renderApp(<Profile />)
    await screen.findByText('1–10 de 30 platinas')
    const pages = screen.getByRole('navigation', { name: 'Páginas de platinas' })
    const next = within(pages).getByRole('button', { name: 'Próxima página' })
    const prev = within(pages).getByRole('button', { name: 'Página anterior' })
    expect(prev.hasAttribute('disabled')).toBe(true)
    fireEvent.click(next)
    expect(results()).toBe('11–20 de 30 platinas')
    expect(
      within(pages).getByRole('button', { name: 'Página 2' }).getAttribute('aria-current'),
    ).toBe('page')
    expect(scroll).toHaveBeenCalled()
    fireEvent.click(next)
    expect(results()).toBe('21–30 de 30 platinas')
    fireEvent.click(within(pages).getByRole('button', { name: 'Página 1' }))
    expect(results()).toBe('1–10 de 30 platinas')
    fireEvent.click(within(pages).getByRole('button', { name: 'Página 3' }))
    expect(next.hasAttribute('disabled')).toBe(true)
    fireEvent.click(prev)
    // The page is kept for the next visit; go back to the first for the other tests.
    fireEvent.click(prev)
    expect(results()).toBe('1–10 de 30 platinas')
  } finally {
    HTMLElement.prototype.scrollIntoView = original
  }
})

test('searching the collection, and finding nothing', async () => {
  mockApi({ '/api/profile': profileData })
  renderApp(<Profile />)
  await screen.findByText('1–10 de 10 platinas')
  fireEvent.change(search(), { target: { value: 'GHOST' } })
  expect(results()).toBe('1–1 de 1 platinas')
  expect(within(list()).getByText('Ghost of Tsushima')).toBeTruthy()
  expect(screen.queryByRole('navigation', { name: 'Páginas de platinas' })).toBeNull()
  fireEvent.change(search(), { target: { value: 'zzz' } })
  expect(results()).toBe('Nenhuma platina encontrada')
  expect(screen.getByText('Tente buscar por outro jogo.')).toBeTruthy()
  // The search is kept for the next visit; clear it for the other tests.
  fireEvent.change(search(), { target: { value: '' } })
})

test('a new profile: nothing yet', async () => {
  mockApi({
    '/api/profile': {
      ...profileData,
      platinums: [],
      byYear: [],
      byPlatform: [],
      rarest: null,
      fastestStreak: null,
      mostPlayed: [],
    },
  })
  const { container } = renderApp(<Profile />)
  expect(await screen.findByText('Nenhuma platina ainda')).toBeTruthy()
  expect(screen.queryByLabelText('Buscar na sua coleção')).toBeNull()
  expect(screen.getByText('Sem platinas para contar')).toBeTruthy()
  expect(container.querySelector('.profile-tiles')?.textContent).not.toContain('Platina mais rara')
})

test('while PSN dates arrive the list refreshes quietly, but never under a search', async () => {
  let pending = 40
  const calls = mockApi({
    '/api/profile': () => ({
      ...profileData,
      platinums: pending ? [] : profileData.platinums,
      pendingPlatinums: pending,
    }),
  })
  jest.useFakeTimers()
  renderApp(<Profile />)
  await act(async () => {})
  expect(screen.getByText('Buscando a data de mais 40 platinas na PSN…')).toBeTruthy()
  expect(screen.getByText('Sua coleção está sendo sincronizada.')).toBeTruthy()
  const count = () => calls.filter((c) => c.path === '/api/profile').length
  expect(count()).toBe(1)

  // A search in progress holds the refresh.
  fireEvent.focus(search())
  await act(async () => {
    jest.advanceTimersByTime(8000)
  })
  expect(count()).toBe(1)
  fireEvent.blur(search())

  pending = 0
  await act(async () => {
    jest.advanceTimersByTime(8000)
  })
  expect(count()).toBe(2)
  // Quiet: no skeleton in between, and the dates are in.
  expect(screen.getByText('1–10 de 10 platinas')).toBeTruthy()
  await act(async () => {
    jest.advanceTimersByTime(20_000)
  })
  expect(count()).toBe(2)
})

test('a failure says the profile could not load', async () => {
  mockApi({ '/api/profile': reply(500) })
  renderApp(<Profile />)
  expect((await screen.findByRole('alert')).textContent).toBe('Não conseguimos carregar o perfil.')
})

test('private trophies: no profile, and the way to the settings', async () => {
  mockApi({
    '/api/profile': reply(409, { error: 'trophies_private' }),
    '/api/me': { user: SAMPLE_ME },
  })
  renderApp(<Profile />)
  expect(await screen.findByText('Seus troféus estão privados')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Abrir configurações' }).getAttribute('href')).toBe(
    '/settings',
  )
  expect(screen.queryByRole('heading', { name: /^Platinas/ })).toBeNull()
})

test('private trophies and no session either: the error', async () => {
  mockApi({ '/api/profile': reply(409, { error: 'trophies_private' }), '/api/me': reply(500) })
  renderApp(<Profile />)
  expect((await screen.findByRole('alert')).textContent).toBe('Não conseguimos carregar o perfil.')
})

test('loading stays on the skeleton', () => {
  mockApi({ '/api/profile': never })
  const { container } = renderApp(<Profile />)
  expect(container.querySelectorAll('.profile-tiles .tile')).toHaveLength(5)
  expect(container.querySelectorAll('.collection-grid .collection-tile')).toHaveLength(10)
})
