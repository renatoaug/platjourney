import { afterEach, expect, jest, mock, test } from 'bun:test'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { SAMPLE_ME, useApp } from '../../src/app/app-state'
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
  expect(screen.getByText('PS5 · 24')).toBeTruthy()
  expect(screen.getByText('40% para o 313')).toBeTruthy()
  const tiles = container.querySelector('.profile-tiles') as HTMLElement
  const year = new Date().getFullYear()
  const count = profileData.byYear.find((y) => y.year === year)?.count ?? 0
  expect(tiles.textContent).toContain(`${count} em ${year}`)
  expect(tiles.textContent).toContain('2.972')
  expect(tiles.textContent).toContain('mais jogado: God of War (212h)')
  expect(tiles.textContent).toContain('Platina mais rara')
  expect(tiles.textContent).toContain('2,4% de quem joga tem')
  expect(tiles.textContent).toContain('platinas entre')
  expect(screen.getByRole('heading', { name: 'Platinas 10' })).toBeTruthy()
  expect(results()).toBe('1–6 de 10 platinas')
  const rows = within(list()).getAllByRole('link')
  expect(rows).toHaveLength(6)
  expect(rows[0].getAttribute('href')).toBe('/title/game/game%3A0')
  expect(rows[1].textContent).toContain('27h jogadas')
  expect(rows[0].textContent).not.toContain('jogadas')
  expect(container.querySelectorAll('.years .year')).toHaveLength(5)
})

test('pages through the collection, keeping focus on the button pressed', async () => {
  const scroll = mock()
  const original = HTMLElement.prototype.scrollIntoView
  HTMLElement.prototype.scrollIntoView = scroll
  // Fifteen platinums: three pages, so the middle one has both buttons enabled.
  const platinums = [0, 1, 2].flatMap((round) =>
    profileData.platinums.slice(0, 5).map((p) => ({
      ...p,
      game: { ...p.game, id: `${p.game.id}-${round}` },
    })),
  )
  try {
    mockApi({ '/api/profile': { ...profileData, platinums } })
    renderApp(<Profile />)
    await screen.findByText('1–6 de 15 platinas')
    const pages = screen.getByRole('navigation', { name: 'Páginas de platinas' })
    const next = within(pages).getByRole('button', { name: 'Próxima' })
    const prev = within(pages).getByRole('button', { name: 'Anterior' })
    expect(prev.hasAttribute('disabled')).toBe(true)
    fireEvent.click(next)
    expect(results()).toBe('7–12 de 15 platinas')
    expect(within(pages).getByText('2 de 3')).toBeTruthy()
    expect(scroll).toHaveBeenCalled()
    expect(document.activeElement === next).toBe(true)
    fireEvent.click(next)
    expect(results()).toBe('13–15 de 15 platinas')
    expect(next.hasAttribute('disabled')).toBe(true)
    fireEvent.click(prev)
    expect(document.activeElement === prev).toBe(true)
    // The page is kept for the next visit; go back to the first for the other tests.
    fireEvent.click(prev)
    expect(results()).toBe('1–6 de 15 platinas')
  } finally {
    HTMLElement.prototype.scrollIntoView = original
  }
})

test('searching the collection, and finding nothing', async () => {
  mockApi({ '/api/profile': profileData })
  renderApp(<Profile />)
  await screen.findByText('1–6 de 10 platinas')
  fireEvent.change(search(), { target: { value: 'GHOST' } })
  expect(results()).toBe('1–1 de 1 platinas')
  expect(within(list()).getByText('Ghost of Tsushima')).toBeTruthy()
  expect(document.getElementById('platinum-pages')?.hidden).toBe(true)
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

test('while PSN dates arrive the list refreshes quietly, but never under a form or a search', async () => {
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

  // So does an open password form.
  fireEvent.click(screen.getByRole('button', { name: 'Trocar senha' }))
  await act(async () => {
    jest.advanceTimersByTime(8000)
  })
  expect(count()).toBe(1)
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

  pending = 0
  await act(async () => {
    jest.advanceTimersByTime(8000)
  })
  expect(count()).toBe(2)
  // Quiet: no skeleton in between, and the dates are in.
  expect(screen.getByText('1–6 de 10 platinas')).toBeTruthy()
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

test('private trophies: only the account cards, so the player can still leave', async () => {
  mockApi({
    '/api/profile': reply(409, { error: 'trophies_private' }),
    '/api/me': { user: SAMPLE_ME },
  })
  renderApp(<Profile />)
  expect(await screen.findByRole('heading', { name: 'Conta' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: /^Platinas/ })).toBeNull()
})

test('private trophies and no session either: the error', async () => {
  mockApi({ '/api/profile': reply(409, { error: 'trophies_private' }), '/api/me': reply(500) })
  renderApp(<Profile />)
  expect((await screen.findByRole('alert')).textContent).toBe('Não conseguimos carregar o perfil.')
})

test('unlinking Telegram reloads the profile', async () => {
  const user = { ...SAMPLE_ME, telegramLinked: true }
  const calls = mockApi({
    '/api/profile': { ...profileData, user },
    'DELETE /api/telegram/link': {},
  })
  renderApp(<Profile />)
  fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }))
  await waitFor(() => expect(calls.filter((c) => c.path === '/api/profile')).toHaveLength(2))
})

test('loading stays on the skeleton', () => {
  mockApi({ '/api/profile': never })
  const { container } = renderApp(<Profile />)
  expect(container.querySelectorAll('.profile-tiles .tile')).toHaveLength(5)
  expect(screen.getByRole('heading', { name: 'Todas as platinas' })).toBeTruthy()
})
