import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from '../../src/app/app'
import { SAMPLE_DATA, SAMPLE_ME } from '../../src/app/app-state'
import { mockApi, reply } from '../support/web'

beforeEach(() => {
  window.location.hash = ''
})
afterEach(() => mock.restore())

test('a signed-in player lands on the app', async () => {
  mockApi({ '/api/me': { user: SAMPLE_ME }, '/api/state': SAMPLE_DATA })
  render(<App />)
  await waitFor(() =>
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeTruthy(),
  )
  await waitFor(() => expect(screen.getByText('Dados sincronizados')).toBeTruthy())
})

test('without a session it asks for the PSN id', async () => {
  mockApi({ '/api/me': reply(401) })
  render(<App />)
  expect(await screen.findByLabelText('Seu PSN ID')).toBeTruthy()
})

test('when the server is down it says so', async () => {
  mockApi({ '/api/me': reply(503) })
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Fora do ar' })).toBeTruthy()
})

test('a session that ends mid-use goes back to the login', async () => {
  mockApi({ '/api/me': { user: SAMPLE_ME }, '/api/state': SAMPLE_DATA })
  render(<App />)
  await screen.findByRole('navigation', { name: 'Navegação principal' })
  act(() => {
    document.dispatchEvent(new Event('api:unauthorized'))
  })
  expect(await screen.findByLabelText('Seu PSN ID')).toBeTruthy()
  expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).toBeNull()
})

test('signing in opens the app', async () => {
  mockApi({
    '/api/me': reply(401),
    'POST /api/auth/lookup': { onlineId: 'jogador', status: 'registered', trophiesPrivate: false },
    'POST /api/auth/login': { user: SAMPLE_ME },
    '/api/state': SAMPLE_DATA,
  })
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
