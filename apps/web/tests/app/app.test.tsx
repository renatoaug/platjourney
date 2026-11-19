import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from '../../src/app/app'
import { SAMPLE_DATA, SAMPLE_ME } from '../../src/app/app-state'
import { mockApi, reply } from '../support/web'

beforeEach(() => {
  window.location.hash = ''
  window.history.pushState({}, '', '/')
})

// The sign-in screen's own address.
const atSignIn = () => window.history.pushState({}, '', '/entrar')
// Unmount before the fakes go: an app still on screen would fetch its screens' data (the home's
// state and releases) against the real fetch, which the setup refuses. CI is slow enough to hit it.
afterEach(() => {
  cleanup()
  delete (window as Window & { Capacitor?: unknown }).Capacitor
  mock.restore()
})

test('the mounted app hands the native cover over even when the session fails immediately', async () => {
  const hide = mock(() => Promise.resolve())
  ;(window as Window & { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
    Plugins: { SplashScreen: { hide } },
  }
  mockApi({ '/api/me': reply(503) })
  render(<App />)
  await screen.findByRole('heading', { name: 'Perdemos a conexão por um instante' })
  await waitFor(() => expect(hide).toHaveBeenCalledTimes(1), { timeout: 2500 })
})

test('a signed-in player lands on the app', async () => {
  mockApi({ '/api/me': { user: SAMPLE_ME }, '/api/state': SAMPLE_DATA })
  render(<App />)
  await waitFor(() =>
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeTruthy(),
  )
  await waitFor(() => expect(screen.getByText('Dados sincronizados')).toBeTruthy())
})

test('without a session the app opens on its public side, with the way in', async () => {
  mockApi({ '/api/me': reply(401) })
  render(<App />)
  expect(await screen.findByRole('navigation', { name: 'Navegação principal' })).toBeTruthy()
  expect(
    await screen.findByRole('heading', { name: 'Sua próxima platina começa aqui.' }),
  ).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Criar conta' }).getAttribute('href')).toBe('/entrar')
  // Nothing of an account's: no notices, no sync, no settings in the menu.
  expect(screen.queryByText('Dados sincronizados')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Configurações' })).toBeNull()
})

test('the sign-in screen has its own address and asks for the PSN id', async () => {
  mockApi({ '/api/me': reply(401) })
  atSignIn()
  render(<App />)
  expect(await screen.findByLabelText('Seu PSN ID')).toBeTruthy()
})

test('a screen of the account, opened without one, asks to sign in and comes back to it', async () => {
  mockApi({ '/api/me': reply(401) })
  window.history.pushState({}, '', '/settings')
  render(<App />)
  expect(await screen.findByText('Isto é da sua conta')).toBeTruthy()
  const signIn = screen.getAllByRole('link', { name: 'Entrar' })[0]
  expect(signIn.getAttribute('href')).toBe('/entrar?next=%2Fsettings')
})

test('when the server is down it says so instead of asking to sign in', async () => {
  mockApi({ '/api/me': reply(503) })
  render(<App />)
  expect(
    await screen.findByRole('heading', { name: 'Perdemos a conexão por um instante' }),
  ).toBeTruthy()
  expect(screen.queryByLabelText('Seu PSN ID')).toBeNull()
})

test('a network failure or an answer that is not JSON is the server being down', async () => {
  spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
  const first = render(<App />)
  expect(
    await screen.findByRole('heading', { name: 'Perdemos a conexão por um instante' }),
  ).toBeTruthy()
  first.unmount()
  mockApi({ '/api/me': new Response('<html>bad gateway</html>', { status: 200 }) })
  render(<App />)
  expect(
    await screen.findByRole('heading', { name: 'Perdemos a conexão por um instante' }),
  ).toBeTruthy()
})

test('trying again opens the app once the server answers, and says so while it does not', async () => {
  let down = true
  mockApi({
    '/api/me': () => (down ? reply(503) : { user: SAMPLE_ME }),
    '/api/state': SAMPLE_DATA,
  })
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
  expect(await screen.findByText('Ainda sem conexão. Tente de novo em instantes.')).toBeTruthy()
  down = false
  fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  expect(await screen.findByRole('navigation', { name: 'Navegação principal' })).toBeTruthy()
})

test('a session that ends mid-use stays on the page, without the account', async () => {
  mockApi({ '/api/me': { user: SAMPLE_ME }, '/api/state': SAMPLE_DATA })
  window.history.pushState({}, '', '/guides')
  render(<App />)
  await screen.findByText('Dados sincronizados')
  act(() => {
    document.dispatchEvent(new Event('api:unauthorized'))
  })
  expect(await screen.findByRole('link', { name: 'Criar conta' })).toBeTruthy()
  expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeTruthy()
  expect(screen.queryByText('Dados sincronizados')).toBeNull()
  expect(window.location.pathname).toBe('/guides')
})

test('signing in opens the app', async () => {
  mockApi({
    '/api/me': reply(401),
    'POST /api/auth/lookup': { onlineId: 'jogador', status: 'registered', trophiesPrivate: false },
    'POST /api/auth/login': { user: SAMPLE_ME },
    '/api/state': SAMPLE_DATA,
  })
  atSignIn()
  render(<App />)
  fireEvent.change(await screen.findByLabelText('Seu PSN ID'), { target: { value: 'jogador' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  fireEvent.change(await screen.findByLabelText('Senha do PlatJourney'), {
    target: { value: 'segredo123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  expect(await screen.findByRole('navigation', { name: 'Navegação principal' })).toBeTruthy()
})

test('the skip link moves focus to the content', async () => {
  const scrollTo = mock(() => {})
  const original = window.scrollTo
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo
  try {
    mockApi({ '/api/me': { user: SAMPLE_ME }, '/api/state': SAMPLE_DATA })
    render(<App />)
    await screen.findByRole('navigation', { name: 'Navegação principal' })
    fireEvent.click(screen.getByRole('button', { name: 'Pular para o conteúdo' }))
    expect(document.activeElement?.id).toBe('main-content')
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
  } finally {
    window.scrollTo = original
  }
})

test('the sign-in screen switches language, and the choice is kept and saved on sign-in', async () => {
  const calls = mockApi({
    '/api/me': reply(401),
    'POST /api/auth/lookup': { onlineId: 'jogador', status: 'registered', trophiesPrivate: false },
    'POST /api/auth/login': { user: { ...SAMPLE_ME, locale: 'pt-BR' } },
    'POST /api/account/preferences': { user: { ...SAMPLE_ME, locale: 'en' } },
    '/api/state': SAMPLE_DATA,
  })
  atSignIn()
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'English' }))
  fireEvent.change(await screen.findByLabelText('Your PSN ID'), { target: { value: 'jogador' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.change(await screen.findByLabelText('PlatJourney password'), {
    target: { value: 'segredo123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByRole('navigation', { name: 'Main navigation' })).toBeTruthy()
  expect(document.documentElement.lang).toBe('en')
  await waitFor(() =>
    expect(calls.find((c) => c.path === '/api/account/preferences')?.body).toEqual({
      locale: 'en',
    }),
  )
})
