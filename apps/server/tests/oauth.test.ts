import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import type { IncomingMessage } from 'node:http'
import * as auth from '../src/auth.ts'
import { config } from '../src/config.ts'
import { assistantKey, bearer, decide, origin } from '../src/oauth.ts'
import { resetRateLimits } from '../src/rate-limit.ts'
import { makeUser } from './api-fixtures.ts'
import { challengeOf, connect, fakeOauthStore, REDIRECT, send } from './oauth-store.ts'

const me = makeUser()
const other = makeUser({ id: 'user:2', psn_online_id: 'Atreus', psn_account_id: 'acc-2' })
let store: ReturnType<typeof fakeOauthStore>
const form = { 'content-type': 'application/x-www-form-urlencoded' }
const verifier = 'v'.repeat(50)

beforeEach(() => {
  resetRateLimits()
  store = fakeOauthStore([me, other])
  spyOn(auth, 'authenticate').mockResolvedValue(me)
})

afterEach(() => mock.restore())

const register = (body: unknown = { client_name: 'Claude', redirect_uris: [REDIRECT] }) =>
  send('POST', '/oauth/register', body)

test('the two metadata documents point an assistant to sign-in and to /mcp', async () => {
  const res = await send('GET', '/.well-known/oauth-protected-resource/mcp', undefined, {
    'x-forwarded-proto': 'https',
  })
  expect(res.body).toEqual({
    resource: 'https://app.test/mcp',
    authorization_servers: ['https://app.test'],
    scopes_supported: ['read'],
    bearer_methods_supported: ['header'],
  })
  expect(res.headers['access-control-allow-origin']).toBe('*')
  const server = (await send('GET', '/.well-known/oauth-authorization-server')).body
  expect(server).toMatchObject({
    issuer: 'http://app.test',
    authorization_endpoint: 'http://app.test/oauth/authorize',
    token_endpoint: 'http://app.test/oauth/token',
    registration_endpoint: 'http://app.test/oauth/register',
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint: 'http://app.test/oauth/revoke',
  })
  expect((await send('OPTIONS', '/oauth/token')).status).toBe(204)
  expect((await send('GET', '/oauth/nothing')).status).toBe(404)
})

test('the address falls back to the local port when the Host header is not a host name', () => {
  const req = { headers: { host: 'evil.test/<x>' } } as unknown as IncomingMessage
  expect(origin(req)).toBe(`http://localhost:${config.port}`)
})

test('an assistant registers itself; only https or local return addresses are taken', async () => {
  const res = await register()
  expect(res.status).toBe(201)
  expect(res.body).toMatchObject({
    client_name: 'Claude',
    redirect_uris: [REDIRECT],
    token_endpoint_auth_method: 'none',
  })
  expect(res.body.client_id).toMatch(/^[a-f0-9]{32}$/)
  // Without a name, the return address's host names it.
  const unnamed = await register({ redirect_uris: ['http://localhost:6274/cb'] })
  expect(unnamed.body.client_name).toBe('localhost')
  for (const uris of [[], ['http://assistant.example/cb'], ['https://a.example/#x'], ['nope'], 'x'])
    expect((await register({ redirect_uris: uris })).body).toEqual({
      error: 'invalid_redirect_uri',
    })
  expect((await send('POST', '/oauth/register', '{not json')).status).toBe(400)
})

test('registering is limited per address', async () => {
  for (let i = 0; i < 10; i++) await register()
  expect((await register()).status).toBe(429)
})

test('authorize sends a good request to the consent page and never to an unknown address', async () => {
  const { client_id } = (await register()).body
  const q = (over: Record<string, string> = {}) =>
    `/oauth/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id,
      redirect_uri: REDIRECT,
      code_challenge: challengeOf(verifier),
      code_challenge_method: 'S256',
      state: 'xyz',
      ...over,
    })}`
  const ok = await send('GET', q())
  expect(ok.status).toBe(302)
  const page = new URL(ok.headers.location, 'http://app.test')
  expect(page.pathname + page.hash.slice(0, 10)).toBe('/#/connect?')
  expect(new URLSearchParams(page.hash.split('?')[1]).get('state')).toBe('xyz')
  // An address the client never registered is answered here, not followed.
  const unknown = await send('GET', q({ redirect_uri: 'https://evil.example/cb' }))
  expect(unknown.status).toBe(400)
  expect((await send('GET', q({ client_id: 'nobody' }))).status).toBe(400)
  // Other mistakes go back to the assistant.
  const plain = await send('GET', q({ code_challenge_method: 'plain' }))
  expect(plain.headers.location).toBe(`${REDIRECT}?error=invalid_request&state=xyz`)
  const token = await send('GET', q({ response_type: 'token' }))
  expect(token.headers.location).toContain('error=unsupported_response_type')
})

test('the consent page names the assistant and returns the browser with a code or a refusal', async () => {
  const { client_id } = (await register()).body
  const info = await send(
    'GET',
    `/api/oauth/client?${new URLSearchParams({ client_id, redirect_uri: REDIRECT })}`,
  )
  expect(info.body).toEqual({ name: 'Claude', redirectHost: 'assistant.example' })
  expect((await send('GET', '/api/oauth/client?client_id=x&redirect_uri=y')).status).toBe(404)

  const ask = {
    clientId: client_id,
    redirectUri: REDIRECT,
    challenge: challengeOf(verifier),
    state: 'st',
  }
  const allowed = await send('POST', '/api/oauth/authorize', { ...ask, allow: true })
  const back = new URL(allowed.body.redirect)
  expect(back.origin + back.pathname).toBe(REDIRECT)
  expect(back.searchParams.get('state')).toBe('st')
  expect(back.searchParams.get('code')).toMatch(/^[a-f0-9]{64}$/)
  expect([...store.codes.values()][0]).toMatchObject({ user: me.id })

  const denied = await send('POST', '/api/oauth/authorize', { ...ask, allow: false })
  expect(denied.body.redirect).toBe(`${REDIRECT}?error=access_denied&state=st`)
  const bad = await send('POST', '/api/oauth/authorize', {
    ...ask,
    challenge: 'short',
    allow: true,
  })
  expect(bad.status).toBe(400)
  expect(await decide(me, { ...ask, redirectUri: 'https://evil.example' }, true)).toBeNull()
})

test('the code buys tokens once, with the right verifier, client and address', async () => {
  const { client_id } = (await register()).body
  const ask = {
    clientId: client_id,
    redirectUri: REDIRECT,
    challenge: challengeOf(verifier),
    state: null,
  }
  const code = () =>
    decide(me, ask, true).then((u) => new URL(u as string).searchParams.get('code') as string)
  const trade = (c: string, over: Record<string, string> = {}) =>
    send(
      'POST',
      '/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: c,
        redirect_uri: REDIRECT,
        client_id,
        code_verifier: verifier,
        ...over,
      }).toString(),
      form,
    )
  expect((await trade(await code(), { code_verifier: 'w'.repeat(50) })).body).toEqual({
    error: 'invalid_grant',
  })
  expect(
    (await trade(await code(), { redirect_uri: 'https://assistant.example/other' })).status,
  ).toBe(400)
  expect((await trade(await code(), { client_id: 'nobody' })).body).toEqual({
    error: 'invalid_client',
  })
  const c = await code()
  const ok = await trade(c)
  expect(ok.status).toBe(200)
  expect(ok.headers['cache-control']).toBe('no-store')
  expect(ok.body).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'read' })
  expect(ok.body.access_token).toMatch(/^[a-f0-9]{64}$/)
  // A code is good once.
  expect((await trade(c)).body).toEqual({ error: 'invalid_grant' })
  expect(
    (
      await send(
        'POST',
        '/oauth/token',
        new URLSearchParams({ grant_type: 'password', client_id }).toString(),
        form,
      )
    ).body,
  ).toEqual({ error: 'unsupported_grant_type' })
})

test('the refresh token buys new tokens and stops working once used', async () => {
  const first = await connect(me)
  const refresh = (
    token: string,
    body = (t: string) =>
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: t,
        client_id: first.clientId,
      }).toString(),
  ) => send('POST', '/oauth/token', body(token), form)
  const next = await refresh(first.refresh_token)
  expect(next.status).toBe(200)
  expect(next.body.refresh_token).not.toBe(first.refresh_token)
  expect((await refresh(first.refresh_token)).body).toEqual({ error: 'invalid_grant' })
  // The same in JSON, which some clients send.
  const json = await send(
    'POST',
    '/oauth/token',
    {
      grant_type: 'refresh_token',
      refresh_token: next.body.refresh_token,
      client_id: first.clientId,
    },
    { 'content-type': 'application/json' },
  )
  expect(json.status).toBe(200)
  expect(
    (
      await refresh('', () =>
        new URLSearchParams({ grant_type: 'refresh_token', client_id: first.clientId }).toString(),
      )
    ).body,
  ).toEqual({ error: 'invalid_request' })
  expect(
    (await send('POST', '/oauth/token', '{bad', { 'content-type': 'application/json' })).status,
  ).toBe(400)
})

test('the token endpoint is limited per address', async () => {
  for (let i = 0; i < 30; i++) await send('POST', '/oauth/token', '', form)
  expect((await send('POST', '/oauth/token', '', form)).status).toBe(429)
})

test('a bearer token reads as its own player only', async () => {
  const mine = await connect(me)
  const theirs = await connect(other, 'x'.repeat(60))
  const who = (token: string) =>
    bearer({ headers: { authorization: `Bearer ${token}` } } as unknown as IncomingMessage)
  expect((await who(mine.access_token))?.user.id).toBe(me.id)
  expect((await who(theirs.access_token))?.user.id).toBe(other.id)
  expect(await who('f'.repeat(64))).toBeUndefined()
  expect(await bearer({ headers: {} } as unknown as IncomingMessage)).toBeUndefined()
})

test('the profile lists connected assistants and disconnecting one ends its token', async () => {
  const { access_token } = await connect(me)
  await connect(other, 'x'.repeat(60))
  const list = await send('GET', '/api/connections')
  expect(list.body.connections).toHaveLength(1)
  expect(list.body.connections[0]).toMatchObject({ name: 'Assistant' })
  const id = list.body.connections[0].id
  // Another player's connection is not theirs to end.
  const theirs = store.tokens.find((t) => t.user === other.id)?.id as string
  expect((await send('DELETE', '/api/connections', { id: theirs })).status).toBe(404)
  expect((await send('DELETE', '/api/connections', { id: 'user:1' })).status).toBe(404)
  const after = await send('DELETE', '/api/connections', { id })
  expect(after.body.connections).toEqual([])
  const gone = await bearer({
    headers: { authorization: `Bearer ${access_token}` },
  } as unknown as IncomingMessage)
  expect(gone).toBeUndefined()
})

test('the demo can connect an assistant but lists no connections', async () => {
  const demo = makeUser({ id: 'user:demo', psn_account_id: 'demo', demo: true })
  spyOn(auth, 'authenticate').mockResolvedValue(demo)
  const { client_id } = (await register()).body
  const res = await send('POST', '/api/oauth/authorize', {
    clientId: client_id,
    redirectUri: REDIRECT,
    challenge: challengeOf(verifier),
    allow: true,
  })
  expect(res.status).toBe(200)
  // Its code buys a token like anyone's, but the shared account lists none of them.
  await connect(demo)
  expect((await send('GET', '/api/connections')).body).toEqual({ connections: [] })
})

test('revoking a token ends its connection, from any client, and each request is logged', async () => {
  const log = spyOn(console, 'log').mockImplementation(() => {})
  const mine = await connect(me)
  const who = (token: string) =>
    bearer({ headers: { authorization: `Bearer ${token}` } } as unknown as IncomingMessage)
  const revoke = (body: Record<string, string>) =>
    send('POST', '/oauth/revoke', new URLSearchParams(body).toString(), form)
  // An unknown token is answered like a known one.
  expect((await revoke({ token: 'f'.repeat(64), client_id: 'nobody' })).status).toBe(200)
  expect((await who(mine.access_token))?.user.id).toBe(me.id)
  // Claude registers two clients and may revoke from the other one: it still ends.
  const { client_id: other } = (await register()).body
  expect((await revoke({ token: mine.refresh_token, client_id: other })).status).toBe(200)
  expect(await who(mine.access_token)).toBeUndefined()
  expect(log.mock.calls.map((c) => c[0])).toEqual([
    'oauth revoke from an unknown client: no live token',
    'oauth revoke from Claude: connection ended',
  ])
})

test('connecting the same assistant again replaces its earlier connection', async () => {
  await connect(me)
  await connect(me, 'x'.repeat(60))
  await connect(other, 'y'.repeat(60))
  const list = (await send('GET', '/api/connections')).body.connections
  expect(list).toHaveLength(1)
  expect(store.tokens.filter((t) => t.user === other.id)).toHaveLength(1)
})

test('an assistant is known by the name its client registered with', () => {
  expect(assistantKey('Claude')).toBe('claude')
  expect(assistantKey('claude-ai')).toBe('claude')
  expect(assistantKey('Codex')).toBe('chatgpt')
  expect(assistantKey('ChatGPT')).toBe('chatgpt')
  expect(assistantKey('Other app')).toBe('other')
  expect(assistantKey(null)).toBe('other')
})
