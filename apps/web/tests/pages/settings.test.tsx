import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { SAMPLE_ME } from '../../src/app/app-state'
import { Settings } from '../../src/pages/settings'
import { mockApi, never, renderApp, reply } from '../support/web'

afterEach(() => mock.restore())

test('the settings show Telegram, notifications, preferences and the account', async () => {
  mockApi({ '/api/me': { user: { ...SAMPLE_ME, telegramLinked: true } } })
  const { container } = renderApp(<Settings />)
  expect(container.querySelector('#settings-page .sk')).toBeTruthy()
  expect(screen.getByRole('heading', { level: 1, name: 'Configurações' })).toBeTruthy()
  expect(await screen.findByRole('heading', { name: 'Notificações' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Preferências' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Conta' })).toBeTruthy()
})

test('unlinking Telegram reloads the account', async () => {
  const calls = mockApi({
    '/api/me': { user: { ...SAMPLE_ME, telegramLinked: true } },
    'DELETE /api/telegram/link': {},
  })
  renderApp(<Settings />)
  fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }))
  await waitFor(() => expect(calls.filter((c) => c.path === '/api/me')).toHaveLength(2))
})

test('a failure says the settings could not load', async () => {
  mockApi({ '/api/me': reply(500) })
  renderApp(<Settings />)
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Não conseguimos carregar as configurações.',
  )
})

test('loading stays on the skeleton', () => {
  mockApi({ '/api/me': never })
  const { container } = renderApp(<Settings />)
  expect(container.querySelector('#settings-page .sk')).toBeTruthy()
})
