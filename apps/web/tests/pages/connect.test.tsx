import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from '../../src/app/app'
import { SAMPLE_ME } from '../../src/app/app-state'
import { Connect, isConnectPage } from '../../src/pages/connect'
import { gone, mockApi, never, reply } from '../support/web'

const params = new URLSearchParams({
  client_id: 'abc',
  redirect_uri: 'https://assistant.example/cb',
  code_challenge: 'c'.repeat(43),
  state: 'xyz',
})
const client = { name: 'Claude', redirectHost: 'assistant.example' }

beforeEach(() => {
  window.location.hash = `#/connect?${params}`
})

afterEach(() => {
  cleanup()
  mock.restore()
  window.location.hash = ''
})

test('the consent page says who asks, what it reads, and sends the code back on Allow', async () => {
  const go = mock(() => {})
  const calls = mockApi({
    '/api/oauth/client': client,
    'POST /api/oauth/authorize': { redirect: 'https://assistant.example/cb?code=1&state=xyz' },
  })
  render(<Connect me={SAMPLE_ME} go={go} />)
  expect(
    await screen.findByRole('heading', { name: 'Claude quer ler a sua conta do PlatJourney' }),
  ).toBeTruthy()
  expect(screen.getByText(`Você está entrando como ${SAMPLE_ME.onlineId}.`)).toBeTruthy()
  expect(screen.getAllByRole('listitem')).toHaveLength(4)
  expect(screen.getByText('Não poderá mudar nada na sua conta.')).toBeTruthy()
  expect(screen.getByText('Depois você volta para assistant.example.')).toBeTruthy()
  expect(calls[0].path).toBe(
    `/api/oauth/client?client_id=abc&redirect_uri=${encodeURIComponent('https://assistant.example/cb')}`,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Permitir' }))
  await waitFor(() =>
    expect(go).toHaveBeenCalledWith('https://assistant.example/cb?code=1&state=xyz'),
  )
  expect(calls[1].body).toEqual({
    clientId: 'abc',
    redirectUri: 'https://assistant.example/cb',
    challenge: 'c'.repeat(43),
    state: 'xyz',
    allow: true,
  })
})

test('Cancel sends the refusal back; a failure lets the player try again', async () => {
  const go = mock(() => {})
  let fail = true
  mockApi({
    '/api/oauth/client': client,
    'POST /api/oauth/authorize': () =>
      fail ? reply(500) : { redirect: 'https://assistant.example/cb?error=access_denied' },
  })
  render(<Connect me={SAMPLE_ME} go={go} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Não deu para concluir agora. Tente de novo.',
  )
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  await waitFor(() =>
    expect(go).toHaveBeenCalledWith('https://assistant.example/cb?error=access_denied'),
  )
})

test('a link the server does not know says to start again; it waits while it checks', async () => {
  mockApi({ '/api/oauth/client': reply(404) })
  render(<Connect me={SAMPLE_ME} />)
  expect(
    await screen.findByText('Este link de conexão não vale mais. Comece de novo pelo assistente.'),
  ).toBeTruthy()
  cleanup()
  mockApi({ '/api/oauth/client': never })
  render(<Connect me={SAMPLE_ME} />)
  expect(document.querySelector('#connect-page .sk')).toBeTruthy()
})

test('the app opens the consent page alone, and asks to sign in first when needed', async () => {
  expect(isConnectPage()).toBe(true)
  expect(isConnectPage('#/settings')).toBe(false)
  mockApi({ '/api/me': { user: SAMPLE_ME }, '/api/oauth/client': client })
  render(<App />)
  expect(await screen.findByRole('heading', { name: /Claude quer ler/ })).toBeTruthy()
  expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).toBeNull()
  // The boot screen leaves without waiting for the app's data, which this page never asks for.
  await gone(() => document.querySelector('.boot-screen'))
  cleanup()
  mockApi({ '/api/me': reply(401) })
  render(<App />)
  expect(await screen.findByLabelText('Seu PSN ID')).toBeTruthy()
})
