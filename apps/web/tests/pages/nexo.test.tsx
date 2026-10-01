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
  fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem para Nexo' }), {
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
  expect(calls).toHaveLength(1)
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
  await waitFor(() => expect(calls).toHaveLength(1))
  type('E agora?')
  expect(within(log()).getByText('E agora?')).toBeTruthy()
  expect(await within(log()).findByText('Siga com as hordas.')).toBeTruthy()
  expect(calls[1].body).toEqual({ text: 'E agora?' })
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
  const cache: Record<string, unknown> = { chat: [], chatSending: true }
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
