import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { Shell } from '../../src/app/shell'
import type { ProfileSummary } from '../../src/lib/types'
import { pluginPages } from '../../src/plugins'
import { mockApi, never, renderApp } from '../support/web'

// Screens that fetch get nothing back unless a test says otherwise.
beforeEach(() => {
  mockApi({})
})
afterEach(() => mock.restore())

const where = () => screen.getByTestId('location').textContent

test('the sidebar lists every screen and marks the current one', () => {
  renderApp(<Shell />, { path: '/history' })
  const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
  const links = within(nav).getAllByRole('link')
  expect(links.map((l) => l.textContent)).toEqual([
    'Visão geral',
    'Jogo atual',
    'NexoIA',
    'Interesses',
    'Descobrir',
    'Guias',
    'Histórico',
  ])
  expect(within(nav).getByRole('link', { name: 'Histórico' }).className).toContain('active')
  expect(within(nav).getByRole('link', { name: 'Visão geral' }).className).not.toContain('active')
})

test('the breadcrumb and the tab title follow the route', async () => {
  mockApi({ '/api/title': never })
  const { unmount } = renderApp(<Shell />, { path: '/discover' })
  expect(screen.getByText('Descobrir', { selector: '#route-label' })).toBeTruthy()
  await waitFor(() => expect(document.title).toBe('Descobrir'))
  unmount()
  renderApp(<Shell />, { path: '/title/game/game%3A1' })
  expect(screen.getByText('Jogo', { selector: '#route-label' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Voltar' })).toBeTruthy()
})

test('navigating from the sidebar changes the screen', () => {
  renderApp(<Shell />, { path: '/' })
  expect(screen.getByRole('heading', { level: 1, name: /, jogador\.$/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('link', { name: 'Histórico' }))
  expect(where()).toBe('/history')
  expect(screen.getByRole('heading', { level: 1, name: 'Histórico' })).toBeTruthy()
})

test('an unknown route goes home', () => {
  renderApp(<Shell />, { path: '/nada' })
  expect(where()).toBe('/')
  expect(screen.getByText('Visão geral', { selector: '#route-label' })).toBeTruthy()
})

test('the sidebar profile: skeleton, the player, or waiting for PSN', () => {
  const { unmount } = renderApp(<Shell />, { value: { data: null } })
  const profile = () => screen.getByRole('link', { name: 'Meu perfil' })
  expect(profile().querySelectorAll('.sk').length).toBe(3)
  unmount()

  const second = renderApp(<Shell />)
  expect(profile().textContent).toBe('jogadorNível 312 · 42 platinas')
  second.unmount()

  renderApp(<Shell />, {
    value: { data: { ...SAMPLE_DATA, profile: null as unknown as ProfileSummary } },
  })
  expect(profile().textContent).toBe('Perfil indisponívelAguardando a PSN')
})

test('the sync button says how the last sync went and reloads', () => {
  const loadState = mock(async () => {})
  const syncedAt = new Date()
  const { unmount } = renderApp(<Shell />, { value: { loadState, syncedAt } })
  const button = screen.getByRole('button', { name: 'Atualizar dados' })
  expect(screen.getByText('Dados sincronizados')).toBeTruthy()
  expect(button.getAttribute('data-tip')).toMatch(
    /^Dados sincronizados às \d\d:\d\d\. Clique para atualizar\.$/,
  )
  fireEvent.click(button)
  expect(loadState).toHaveBeenCalledTimes(1)
  unmount()

  const cases = [
    ['private', 'Troféus privados', 'Troféus privados na PSN'],
    ['failed', 'Falha na sincronização', 'Falha na sincronização. Clique para tentar de novo.'],
    ['connecting', 'Conectando à PSN', 'Atualizar dados'],
  ] as const
  for (const [sync, text, tip] of cases) {
    const view = renderApp(<Shell />, { value: { sync } })
    expect(screen.getByText(text).className).toContain(sync === 'connecting' ? 'sync' : 'failed')
    expect(screen.getByRole('button', { name: 'Atualizar dados' }).getAttribute('data-tip')).toBe(
      tip,
    )
    view.unmount()
  }
})

test('the sync button is locked while loading', () => {
  renderApp(<Shell />, { value: { loading: true } })
  expect(screen.getByRole('button', { name: 'Atualizar dados' }).hasAttribute('disabled')).toBe(
    true,
  )
})

test('private trophies anywhere bring up the notice', () => {
  renderApp(<Shell />)
  expect(screen.queryByText('Não conseguimos ver seus troféus')).toBeNull()
  act(() => {
    document.dispatchEvent(new Event('api:private-profile'))
  })
  expect(screen.getByRole('heading', { name: 'Não conseguimos ver seus troféus' })).toBeTruthy()
})

test('the nav pill sits behind the active link once it has a size', () => {
  const proto = HTMLElement.prototype
  const saved = Object.getOwnPropertyDescriptors(proto)
  const size = (value: number) => ({ configurable: true, get: () => value })
  Object.defineProperties(proto, {
    offsetWidth: size(120),
    offsetHeight: size(36),
    offsetLeft: size(0),
    offsetTop: size(48),
  })
  try {
    const { container } = renderApp(<Shell />, { path: '/game' })
    const pill = container.querySelector('.nav-indicator') as HTMLElement
    expect(pill.style.width).toBe('120px')
    expect(pill.style.transform).toBe('translate(0px, 48px)')
    expect(pill.style.opacity).toBe('1')
    expect(container.querySelector('.nav')?.classList.contains('nav-animated')).toBe(true)
    fireEvent.click(screen.getByRole('link', { name: 'Interesses' }))
    expect(pill.style.transition).toBe('')
  } finally {
    for (const key of ['offsetWidth', 'offsetHeight', 'offsetLeft', 'offsetTop'] as const) {
      const d = saved[key]
      if (d) Object.defineProperty(proto, key, d)
      else delete (proto as unknown as Record<string, unknown>)[key]
    }
  }
})

test('without layout the pill stays hidden', () => {
  const { container } = renderApp(<Shell />)
  expect((container.querySelector('.nav-indicator') as HTMLElement).style.opacity).toBe('0')
})

test("a plugin's page gets an item in the menu, its route and its title", async () => {
  pluginPages.push({
    path: '/hello',
    label: { 'pt-BR': 'Olá', en: 'Hello' },
    icon: 'bolt',
    component: () => <h1>Página do plugin</h1>,
  })
  try {
    renderApp(<Shell />, { path: '/hello' })
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(within(nav).getByRole('link', { name: 'Olá' }).className).toContain('active')
    expect(screen.getByRole('heading', { name: 'Página do plugin' })).toBeTruthy()
    await waitFor(() => expect(document.title).toBe('Olá'))
  } finally {
    pluginPages.length = 0
  }
})
