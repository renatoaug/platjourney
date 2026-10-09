import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import type { ChatMessage } from '../../src/components/chat/chat'
import { Loaded } from '../../src/components/chat/chat.stories'
import { current } from '../../src/fixtures'
import type { CurrentGame } from '../../src/lib/types'
import { Nexo } from '../../src/pages/nexo'
import { MODEL_WORK_DONE } from '../../src/ui/plugin-slot'
import { mockApi, never, renderApp, reply } from '../support/web'

afterEach(() => mock.restore())

const messages = Loaded.args?.chat as ChatMessage[]
const log = () => screen.getByRole('log', { name: 'Conversa com o Nexo' })

function type(text: string) {
  fireEvent.change(screen.getByRole('combobox', { name: 'Mensagem para Nexo' }), {
    target: { value: text },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
}

test('loads the conversation once and keeps it in the cache', async () => {
  const cache: Record<string, unknown> = {}
  const calls = mockApi({ '/api/chat': messages })
  const { unmount } = renderApp(<Nexo />, { value: { cache } })
  expect(await within(log()).findByText('E depois disso?')).toBeTruthy()
  unmount()
  renderApp(<Nexo />, { value: { cache } })
  expect(within(log()).getByText('E depois disso?')).toBeTruthy()
  expect(calls.filter((c) => c.path.startsWith('/api/chat?'))).toHaveLength(1)
})

test('the subtitle names the current game', () => {
  mockApi({ '/api/chat': never })
  const { unmount } = renderApp(<Nexo />, {
    value: { data: { ...SAMPLE_DATA, current: current as unknown as CurrentGame } },
  })
  expect(screen.getByText('Falando sobre DAYS GONE (13%).')).toBeTruthy()
  unmount()
  const second = renderApp(<Nexo />)
  expect(screen.getByText('Pergunta qualquer coisa sobre a platina ou o game.')).toBeTruthy()
  second.unmount()
  renderApp(<Nexo />, { value: { data: null } })
  expect(screen.getByText('Um passo mais perto da platina.')).toBeTruthy()
})

test('a failed load says so', async () => {
  mockApi({ '/api/chat': reply(500) })
  renderApp(<Nexo />)
  expect(await screen.findByRole('alert')).toBeTruthy()
})

test('sending shows the message at once and then the whole conversation back', async () => {
  const done = mock()
  window.addEventListener(MODEL_WORK_DONE, done)
  const calls = mockApi({
    'GET /api/chat': [],
    'POST /api/chat': ({ body }) => ({
      messages: [
        { role: 'user', content: (body as { text: string }).text },
        { role: 'assistant', content: 'Siga com as hordas.' },
      ],
    }),
  })
  renderApp(<Nexo />)
  await waitFor(() => expect(calls.some((c) => c.path.startsWith('/api/chat?'))).toBe(true))
  type('E agora?')
  expect(within(log()).getByText('E agora?')).toBeTruthy()
  expect(await within(log()).findByText('Siga com as hordas.')).toBeTruthy()
  expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ text: 'E agora?' })
  expect(done).toHaveBeenCalled()
  window.removeEventListener(MODEL_WORK_DONE, done)
})

test('an answer without the conversation is appended', async () => {
  mockApi({ 'GET /api/chat': [], 'POST /api/chat': { text: 'Resposta curta.' } })
  renderApp(<Nexo />)
  await settle()
  type('oi')
  expect(await within(log()).findByText('Resposta curta.')).toBeTruthy()
})

test('an error from the service is shown as the answer', async () => {
  mockApi({ 'GET /api/chat': [], 'POST /api/chat': { error: 'Sem guia ainda.' } })
  renderApp(<Nexo />)
  await settle()
  type('oi')
  expect(await within(log()).findByText('Sem guia ainda.')).toBeTruthy()
})

test('a failed send keeps the message and warns', async () => {
  mockApi({ 'GET /api/chat': [], 'POST /api/chat': reply(500) })
  renderApp(<Nexo />)
  await settle()
  type('oi')
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Não conseguimos falar com o Nexo.'),
  )
  expect(within(log()).getByText('oi')).toBeTruthy()
})

test('a refusal: only its toast', async () => {
  mockApi({ 'GET /api/chat': [], 'POST /api/chat': reply(402) })
  renderApp(<Nexo />)
  await settle()
  type('oi')
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Isso não está disponível agora.'),
  )
})

test('an answer still in flight blocks a second send, even after coming back', async () => {
  const cache: Record<string, unknown> = { chats: { none: [] }, chatThreads: [], chatSending: true }
  const calls = mockApi({})
  renderApp(<Nexo />, { value: { cache } })
  expect(screen.getByRole('button', { name: 'Enviar' }).hasAttribute('disabled')).toBe(true)
  fireEvent.submit(document.getElementById('chat-form') as HTMLFormElement)
  expect(calls).toHaveLength(0)
})

// Lets pending effects and requests settle.
async function settle() {
  await waitFor(() =>
    expect(screen.queryByLabelText('Nexo está preparando uma resposta')).toBeNull(),
  )
  await new Promise((r) => setTimeout(r, 0))
}

test('a link naming a game opens the chat on it, once, and clears the address', async () => {
  const calls = mockApi({ '/api/chat': messages, 'POST /api/current': { current: null } })
  renderApp(<Nexo />, {
    path: '/nexo?game=NPWR99999_00&name=Jogo%20Exemplo',
    route: '/nexo',
    value: { data: { ...SAMPLE_DATA, current: current as unknown as CurrentGame } },
  })
  await waitFor(() =>
    expect(calls.find((c) => c.path === '/api/current')?.body).toEqual({ np: 'NPWR99999_00' }),
  )
  await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/nexo'))
  expect(calls.filter((c) => c.path === '/api/current')).toHaveLength(1)
})

test('a link naming the game already in the chat does not switch', async () => {
  const calls = mockApi({ '/api/chat': messages })
  const game = current as unknown as CurrentGame
  renderApp(<Nexo />, {
    path: `/nexo?game=${game.np}`,
    route: '/nexo',
    value: { data: { ...SAMPLE_DATA, current: game } },
  })
  await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/nexo'))
  expect(calls.some((c) => c.path === '/api/current')).toBe(false)
})

const thread = (over: Record<string, unknown>) => ({
  game: 'game:1',
  np: 'NPWR00001_00',
  name: 'Jogo Exemplo',
  cover_url: null,
  messages: 3,
  last_at: '2026-01-01T10:00:00Z',
  last_question: 'Onde fica o baú?',
  ...over,
})

test('each game is its own conversation, listed beside the chat with its last question', async () => {
  const calls = mockApi({
    '/api/chat/threads': [
      thread({}),
      thread({ game: null, np: null, name: null, last_question: null }),
    ],
    '/api/chat': messages,
  })
  renderApp(<Nexo />)
  const list = await screen.findByRole('complementary', { name: 'Conversas' })
  expect(within(list).getByText('Jogo Exemplo')).toBeTruthy()
  expect(within(list).getByText('Onde fica o baú?')).toBeTruthy()
  expect(within(list).getByText('Geral')).toBeTruthy()
  expect(calls.find((c) => c.path.startsWith('/api/chat?'))?.path).toBe('/api/chat?game=none')
})

test('a conversation of another game in the library switches the chat to that game', async () => {
  const calls = mockApi({
    '/api/chat/threads': [thread({})],
    '/api/chat': messages,
    'POST /api/current': { current: null },
  })
  renderApp(<Nexo />)
  fireEvent.click(await screen.findByRole('button', { name: /Jogo Exemplo/ }))
  await waitFor(() =>
    expect(calls.find((c) => c.path === '/api/current')?.body).toEqual({ np: 'NPWR00001_00' }),
  )
})

test('a conversation outside the library is read only, with a way back', async () => {
  const calls = mockApi({
    '/api/chat/threads': [thread({ np: null, name: 'Jogo Antigo' })],
    '/api/chat': messages,
  })
  renderApp(<Nexo />)
  fireEvent.click(await screen.findByRole('button', { name: /Jogo Antigo/ }))
  expect(
    await screen.findByText(
      'Esta é a conversa de Jogo Antigo, que não está na sua biblioteca agora.',
    ),
  ).toBeTruthy()
  expect(calls.some((c) => c.path === '/api/chat?game=game%3A1')).toBe(true)
  expect(screen.queryByRole('combobox', { name: 'Mensagem para Nexo' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Voltar para a conversa' }))
  expect(await screen.findByRole('combobox', { name: 'Mensagem para Nexo' })).toBeTruthy()
})
