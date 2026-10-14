import { afterEach, expect, mock, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import { ApiError, api, del } from '../../src/lib/api'
import { plugins } from '../../src/plugins'
import { ToastHost } from '../../src/ui/toast'
import { mockApi, reply } from '../support/web'

afterEach(() => mock.restore())

const failure = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e as ApiError,
  )

test('a GET returns the JSON body', async () => {
  const calls = mockApi({ '/api/me': { user: { onlineId: 'jogador' } } })
  expect(await api<{ user: { onlineId: string } }>('/api/me')).toEqual({
    user: { onlineId: 'jogador' },
  })
  expect(calls).toEqual([{ path: '/api/me', method: 'GET', body: undefined }])
})

test('a body makes it a JSON POST', async () => {
  const calls = mockApi({ 'POST /api/goals': { ok: true } })
  await api('/api/goals', { command: 'set 12' })
  expect(calls[0]).toEqual({ path: '/api/goals', method: 'POST', body: { command: 'set 12' } })
})

test('del sends a DELETE, with or without a body', async () => {
  const calls = mockApi({ 'DELETE /api/plan': {}, 'DELETE /api/account': {} })
  await del('/api/plan')
  await del('/api/account', { onlineId: 'jogador' })
  expect(calls.map((c) => [c.method, c.path, c.body])).toEqual([
    ['DELETE', '/api/plan', undefined],
    ['DELETE', '/api/account', { onlineId: 'jogador' }],
  ])
})

test('a failure carries the status and the server message', async () => {
  mockApi({ '/api/title': reply(404, { error: 'not_found', message: 'Não achamos.' }) })
  const e = await failure(api('/api/title'))
  expect(e).toBeInstanceOf(ApiError)
  expect(e?.status).toBe(404)
  expect(e?.code).toBe('not_found')
  expect(e?.friendly).toBe('Não achamos.')
  expect(e?.message).toBe('Não achamos.')
  expect(e?.handled).toBe(false)
})

test('a failure without a JSON body still has a message', async () => {
  mockApi({ '/api/state': () => new Response('oops', { status: 500 }) })
  const e = await failure(api('/api/state'))
  expect(e?.message).toBe('HTTP 500')
  expect(e?.friendly).toBeUndefined()
})

test('401 tells the shell the session ended', async () => {
  mockApi({ '/api/state': reply(401) })
  let fired = 0
  const on = () => fired++
  document.addEventListener('api:unauthorized', on)
  await failure(api('/api/state'))
  document.removeEventListener('api:unauthorized', on)
  expect(fired).toBe(1)
})

test('private trophies raise the notice and count as handled', async () => {
  mockApi({ '/api/state': reply(409, { error: 'trophies_private' }) })
  let fired = 0
  const on = () => fired++
  document.addEventListener('api:private-profile', on)
  const e = await failure(api('/api/state'))
  document.removeEventListener('api:private-profile', on)
  expect(fired).toBe(1)
  expect(e?.handled).toBe(true)
})

test('another 409 is left to the caller', async () => {
  mockApi({ '/api/goals': reply(409, { error: 'conflict' }) })
  const e = await failure(api('/api/goals', {}))
  expect(e?.handled).toBe(false)
})

test('a 402 without a message says the action is not available', async () => {
  render(<ToastHost />)
  mockApi({ '/api/chat': reply(402) })
  let e: ApiError | null = null
  await act(async () => {
    e = await failure(api('/api/chat', { text: 'oi' }))
  })
  expect((e as ApiError | null)?.handled).toBe(true)
  expect(screen.getByRole('alert').textContent).toContain('Isso não está disponível agora.')
  expect(screen.queryByRole('link')).toBeNull()
})

test("a plugin's refusal shows its message with the action the plugin offers", async () => {
  render(<ToastHost />)
  plugins.push({
    refusalAction: ({ code }) =>
      code === 'hello_blocked' ? { href: '#/hello', label: 'Saiba mais' } : undefined,
  })
  mockApi({
    '/api/chat': reply(402, {
      error: 'hello_blocked',
      message: 'Recomendações estão desligadas para esta conta.',
    }),
  })
  try {
    await act(async () => {
      await failure(api('/api/chat', { text: 'oi' }))
    })
    expect(screen.getByRole('alert').textContent).toContain(
      'Recomendações estão desligadas para esta conta.',
    )
    expect(screen.getByRole('link', { name: /Saiba mais/ }).getAttribute('href')).toBe('#/hello')
  } finally {
    plugins.pop()
  }
})
