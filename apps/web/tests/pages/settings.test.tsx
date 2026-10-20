import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { MockAppState, SAMPLE_ME } from '../../src/app/app-state'
import type { Me } from '../../src/lib/types'
import { Settings } from '../../src/pages/settings'
import { ToastHost } from '../../src/ui/toast'
import { mockApi, never, renderApp, reply } from '../support/web'

afterEach(() => mock.restore())

test('the settings show Telegram, notifications, preferences, the account and connected apps', async () => {
  mockApi({
    '/api/me': { user: { ...SAMPLE_ME, telegramLinked: true } },
    '/api/connections': { connections: [] },
  })
  const { container } = renderApp(<Settings />)
  expect(container.querySelector('#settings-page .sk')).toBeTruthy()
  expect(screen.getByRole('heading', { level: 1, name: 'Configurações' })).toBeTruthy()
  expect(await screen.findByRole('heading', { name: 'Notificações' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Preferências' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Conta' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Apps conectados' })).toBeTruthy()
  // Nothing connected: Claude and ChatGPT each show how to connect them.
  expect(await screen.findAllByRole('button', { name: 'Como conectar' })).toHaveLength(2)
})

test('unlinking Telegram reloads the account', async () => {
  const calls = mockApi({
    '/api/connections': { connections: [] },
    '/api/me': { user: { ...SAMPLE_ME, telegramLinked: true } },
    'DELETE /api/telegram/link': {},
  })
  renderApp(<Settings />)
  fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }))
  await waitFor(() => expect(calls.filter((c) => c.path === '/api/me')).toHaveLength(2))
})

// The app state as the real one keeps it: setMe replaces the account every screen reads.
function WithAccount() {
  const [me, setMe] = useState<Me>(SAMPLE_ME)
  return (
    <MemoryRouter>
      <MockAppState value={{ me, setMe }}>
        <Settings />
      </MockAppState>
      <ToastHost />
    </MemoryRouter>
  )
}

test('a saved preference shows at once, without loading the account again', async () => {
  const calls = mockApi({
    '/api/connections': { connections: [] },
    '/api/me': { user: SAMPLE_ME },
    'POST /api/account/preferences': { user: { ...SAMPLE_ME, psPlus: 'extra' } },
  })
  render(<WithAccount />)
  const plus = (await screen.findByRole('combobox')) as HTMLSelectElement
  fireEvent.change(plus, { target: { value: 'extra' } })
  await screen.findByText('PS Plus salvo.')
  // The saved account renders again: read the select as it is now, once it settles.
  await waitFor(() =>
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('extra'),
  )
  expect(calls.filter((c) => c.path === '/api/me')).toHaveLength(1)
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
