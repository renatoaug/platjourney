import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { SAMPLE_ME } from '../../src/app/app-state'
import {
  ConnectedApps,
  ConnectedAppsSkeleton,
  type Connection,
} from '../../src/components/connected-apps'
import type { Me } from '../../src/lib/types'
import { mockApi, never, renderApp, reply } from '../support/web'

afterEach(() => mock.restore())

const claude: Connection = {
  id: 'oauth_token:1',
  name: 'Claude',
  created_at: '2026-10-19T10:00:00Z',
  used_at: '2026-10-19T12:00:00Z',
}
const gpt: Connection = {
  id: 'oauth_token:2',
  name: 'ChatGPT',
  created_at: '2026-10-18T10:00:00Z',
  used_at: null,
}

test('the connected assistants show with when they were used, and one disconnects', async () => {
  const calls = mockApi({
    '/api/connections': { connections: [claude, gpt] },
    'DELETE /api/connections': { connections: [gpt] },
  })
  renderApp(<ConnectedApps user={SAMPLE_ME} onChanged={() => {}} />)
  expect(screen.getByRole('heading', { name: 'Apps conectados' })).toBeTruthy()
  expect(screen.getByText(/http:\/\/localhost.*\/mcp/)).toBeTruthy()
  expect(await screen.findByText('Claude')).toBeTruthy()
  // A green "Conectado", when it was last used and since when; one never used says so.
  expect(screen.getAllByText('Conectado')).toHaveLength(2)
  expect(screen.getByText(/· usado /)).toBeTruthy()
  expect(screen.getByText(/ainda não usado · desde/)).toBeTruthy()
  // Each known assistant shows its own mark.
  const logos = [...document.querySelectorAll('#connected-apps img.app-logo')].map((i) =>
    i.getAttribute('src'),
  )
  expect(logos).toEqual(['/telegram.svg', '/claude.svg', '/chatgpt.svg'])
  fireEvent.click(screen.getAllByRole('button', { name: 'Desconectar' })[0])
  expect(await screen.findByText('Claude desconectado.')).toBeTruthy()
  await waitFor(() =>
    expect(screen.queryAllByRole('button', { name: 'Desconectar' })).toHaveLength(1),
  )
  expect(calls[1]).toEqual({
    path: '/api/connections',
    method: 'DELETE',
    body: { id: 'oauth_token:1' },
  })
})

test('no assistant, a failed load and a failed disconnect each say so', async () => {
  mockApi({ '/api/connections': { connections: [] } })
  const first = renderApp(<ConnectedApps user={SAMPLE_ME} onChanged={() => {}} />)
  // Nothing connected: Claude and ChatGPT each show how to connect them.
  expect(await screen.findAllByRole('button', { name: 'Como conectar' })).toHaveLength(2)
  first.unmount()
  mock.restore()
  mockApi({ '/api/connections': reply(500) })
  const second = renderApp(<ConnectedApps user={SAMPLE_ME} onChanged={() => {}} />)
  expect(await screen.findByText('Não conseguimos carregar os apps conectados.')).toBeTruthy()
  second.unmount()
  mock.restore()
  mockApi({ '/api/connections': { connections: [claude] }, 'DELETE /api/connections': reply(500) })
  renderApp(<ConnectedApps user={SAMPLE_ME} onChanged={() => {}} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }))
  expect(await screen.findByText('Não deu para desconectar agora. Tente de novo.')).toBeTruthy()
  expect(screen.getByText('Claude')).toBeTruthy()
})

test('loading shows the card with placeholders', () => {
  mockApi({ '/api/connections': never })
  renderApp(<ConnectedApps user={SAMPLE_ME} onChanged={() => {}} />)
  expect(document.querySelector('#connected-apps .sk')).toBeTruthy()
  renderApp(<ConnectedAppsSkeleton />)
  expect(screen.getAllByRole('heading', { name: 'Apps conectados' })).toHaveLength(2)
  expect(screen.getAllByText('Telegram')).toHaveLength(2)
})

test('Claude and ChatGPT, when not connected, show how to connect them in a dialog, with the address to copy', async () => {
  const write = mock(() => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true })
  mockApi({ '/api/connections': { connections: [claude] } })
  renderApp(<ConnectedApps user={SAMPLE_ME} onChanged={() => {}} />)
  // Claude is connected already: only ChatGPT offers the steps.
  const how = await screen.findByRole('button', { name: 'Como conectar' })
  expect(screen.getAllByRole('button', { name: 'Como conectar' })).toHaveLength(1)
  fireEvent.click(how)
  expect(document.querySelector('dialog.connect-guide')).toBeTruthy()
  expect(screen.getByText('Como conectar o ChatGPT')).toBeTruthy()
  // What to click is in bold, what to paste in the accent.
  expect(screen.getByText('Adicionar servidor MCP').tagName).toBe('B')
  expect(screen.getByText(`${window.location.origin}/mcp`).className).toBe('connect-value')
  fireEvent.click(screen.getByText('Copiar endereço'))
  expect(await screen.findByText('Endereço copiado.')).toBeTruthy()
  expect(write).toHaveBeenCalledWith(`${window.location.origin}/mcp`)
  fireEvent.click(screen.getByText('Fechar'))
  expect(document.querySelector('dialog.connect-guide')).toBeNull()
})

test('the ChatGPT desktop app, which registers as Codex, counts as ChatGPT', async () => {
  mockApi({ '/api/connections': { connections: [{ ...gpt, name: 'Codex' }] } })
  renderApp(<ConnectedApps user={SAMPLE_ME} onChanged={() => {}} />)
  expect(await screen.findByText('Codex')).toBeTruthy()
  expect(document.querySelector('#connected-apps img[src="/chatgpt.svg"]')).toBeTruthy()
  // Only Claude still offers the steps.
  expect(screen.getAllByRole('button', { name: 'Como conectar' })).toHaveLength(1)
})

test('an assistant without a known mark gets a plain icon', async () => {
  mockApi({ '/api/connections': { connections: [{ ...gpt, name: 'MCP Inspector' }] } })
  renderApp(<ConnectedApps user={SAMPLE_ME} onChanged={() => {}} />)
  expect(await screen.findByText('MCP Inspector')).toBeTruthy()
  expect(document.querySelector('#connected-apps .app-logo-plain')).toBeTruthy()
})

describe('Telegram', () => {
  const linked: Me = {
    ...SAMPLE_ME,
    telegramLinked: true,
    telegramBot: { username: 'platjourney_bot', name: 'Nexo' },
  }
  const show = (user: Me = SAMPLE_ME, onChanged = () => {}) =>
    renderApp(<ConnectedApps user={user} onChanged={onChanged} />)

  test('connecting opens the bot link', async () => {
    const open = spyOn(window, 'open').mockImplementation(() => null)
    mockApi({
      '/api/connections': { connections: [] },
      'POST /api/telegram/link': { url: 'https://t.me/bot?start=x' },
    })
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }))
    expect(await screen.findByText('Toque em Iniciar no Telegram para concluir.')).toBeTruthy()
    expect(open).toHaveBeenCalledWith('https://t.me/bot?start=x', '_blank', 'noopener')
  })

  test('a failed link says so', async () => {
    mockApi({ '/api/connections': { connections: [] }, 'POST /api/telegram/link': reply(500) })
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }))
    expect(await screen.findByText('Não conseguimos gerar o link. Tente de novo.')).toBeTruthy()
  })

  test('a linked account shows the bot and can disconnect', async () => {
    const calls = mockApi({
      '/api/connections': { connections: [] },
      'DELETE /api/telegram/link': { ok: true },
    })
    const onChanged = mock()
    show(linked, onChanged)
    expect(screen.getByRole('link', { name: '@platjourney_bot' }).getAttribute('href')).toBe(
      'https://t.me/platjourney_bot',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Desconectar' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/telegram/link')).toBe(true)
  })

  test('a linked account without a bot name falls back to Nexo', () => {
    mockApi({ '/api/connections': never })
    show({ ...linked, telegramBot: undefined })
    expect(screen.getByText('Nexo')).toBeTruthy()
  })

  test('the demo cannot connect Telegram and says why', () => {
    mockApi({ '/api/connections': never })
    show({ ...SAMPLE_ME, demo: true })
    expect((document.getElementById('telegram-link') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/demonstração/)).toBeTruthy()
  })
})
