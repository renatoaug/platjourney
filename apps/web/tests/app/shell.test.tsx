import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { Shell } from '../../src/app/shell'
import { current as journeyFixture } from '../../src/fixtures'
import type { ProfileSummary } from '../../src/lib/types'
import { pluginPages } from '../../src/plugins'
import { mockApi, never, renderApp } from '../support/web'

// Screens that fetch get nothing back unless a test says otherwise.
beforeEach(() => {
  mockApi({})
})
afterEach(() => mock.restore())

const where = () => screen.getByTestId('location').textContent

test('primary navigation has only the three product destinations', () => {
  renderApp(<Shell />, { path: '/games' })
  const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
  expect(
    within(nav)
      .getAllByRole('link')
      .map((l) => l.textContent),
  ).toEqual(['Jornada', 'Jogos', 'Descobrir'])
  expect(within(nav).getByRole('link', { name: 'Jogos' }).className).toContain('active')
  fireEvent.click(screen.getByRole('button', { name: 'Abrir o menu da conta' }))
  for (const name of ['Histórico', 'Conversas com Nexo', 'Configurações', 'Buscar guias'])
    expect(screen.getByRole('menuitem', { name })).toBeTruthy()
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

test('primary navigation opens the games screen', () => {
  renderApp(<Shell />, { path: '/' })
  fireEvent.click(screen.getByRole('link', { name: 'Jogos' }))
  expect(where()).toBe('/games')
  expect(screen.getByRole('heading', { level: 1, name: 'Jogos' })).toBeTruthy()
})

test('an unknown route goes home', () => {
  renderApp(<Shell />, { path: '/nada' })
  expect(where()).toBe('/')
  expect(screen.getByText('Jornada', { selector: '#route-label' })).toBeTruthy()
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

test("a plugin's page gets an item in the menu, its route and its title", async () => {
  pluginPages.push({
    path: '/hello',
    label: { 'pt-BR': 'Olá', en: 'Hello' },
    icon: 'bolt',
    component: () => <h1>Página do plugin</h1>,
  })
  try {
    renderApp(<Shell />, { path: '/hello' })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir o menu da conta' }))
    expect(screen.getByRole('menuitem', { name: 'Olá' }).getAttribute('href')).toBe('/hello')
    expect(screen.getByRole('heading', { name: 'Página do plugin' })).toBeTruthy()
    await waitFor(() => expect(document.title).toBe('Olá'))
  } finally {
    pluginPages.length = 0
  }
})

test('contextual Nexo returns to the mounted journey with its open session intact', async () => {
  mockApi({ '/api/plan': { plan: null }, '/api/chat': [], '/api/chat/threads': [] })
  const current = journeyFixture
  if (!current) throw new Error('fixture requires a game')
  renderApp(<Shell />, { value: { data: { ...SAMPLE_DATA, current } } })
  const session = document.getElementById('journey-session') as HTMLDetailsElement
  session.open = true
  fireEvent.click(screen.getByRole('link', { name: 'Conversar com Nexo' }))
  await screen.findByRole('button', { name: 'Voltar à jornada' })
  expect(document.getElementById('journey-session')).toBe(session)
  fireEvent.click(screen.getByRole('button', { name: 'Voltar à jornada' }))
  await waitFor(() => expect(document.querySelector('.journey-chat')).toBeNull())
  expect(document.getElementById('journey-session')).toBe(session)
  expect(session.open).toBe(true)
  expect(screen.getByTestId('location').textContent).toBe('/')
})

test('contextual chat follows the keyboard viewport and restores page scroll styles', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport')
  const viewport = Object.assign(new EventTarget(), { height: window.innerHeight, offsetTop: 0 })
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  mockApi({ '/api/plan': { plan: null }, '/api/chat': [], '/api/chat/threads': [] })
  document.body.style.position = 'relative'
  try {
    renderApp(<Shell />, { value: { data: { ...SAMPLE_DATA, current: journeyFixture } } })
    fireEvent.click(screen.getByRole('link', { name: 'Conversar com Nexo' }))
    await screen.findByRole('button', { name: 'Voltar à jornada' })
    const dialog = document.querySelector('.journey-chat') as HTMLElement
    expect(dialog.dataset.keyboard).toBe('false')
    viewport.height = 300
    act(() => viewport.dispatchEvent(new Event('resize')))
    expect(dialog.dataset.keyboard).toBe('true')
    expect(dialog.style.getPropertyValue('--journey-viewport-height')).toBe('300px')
    expect(document.body.style.position).toBe('fixed')
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à jornada' }))
    await waitFor(() => expect(document.querySelector('.journey-chat')).toBeNull())
    expect(document.body.style.position).toBe('relative')
  } finally {
    document.body.style.position = ''
    if (descriptor) Object.defineProperty(window, 'visualViewport', descriptor)
    else Reflect.deleteProperty(window, 'visualViewport')
  }
})
