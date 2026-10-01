import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import { AiError, ai } from '../src/ai.ts'
import { config } from '../src/config.ts'
import { tagged } from '../src/costs.ts'

afterEach(() => mock.restore())

test('posts the body with the token and the cost tag as headers', async () => {
  const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ text: 'oi' }))
  const out = await tagged({ user: 'user:1', action: 'chat' }, () =>
    ai<{ text: string }>('/chat', { q: 1 }),
  )
  expect(out).toEqual({ text: 'oi' })
  const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
  expect(url).toBe(`${config.ai.url}/chat`)
  expect(init.body).toBe('{"q":1}')
  expect(init.headers).toEqual({
    'content-type': 'application/json',
    'x-internal-token': config.ai.token,
    'x-cost-user': 'user:1',
    'x-cost-action': 'chat',
  })
})

test('untagged work sends no cost headers', async () => {
  const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({}))
  await ai('/tip', {})
  const headers = (fetch.mock.calls[0] as [string, RequestInit])[1].headers
  expect(Object.keys(headers as object)).toEqual(['content-type', 'x-internal-token'])
})

test('a failed call throws with the status and the body', async () => {
  spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 503 }))
  const error = (await ai('/plan', {}).catch((e) => e)) as AiError
  expect(error).toBeInstanceOf(AiError)
  expect(error.status).toBe(503)
  expect(error.message).toBe('ai /plan: 503 boom')
})
