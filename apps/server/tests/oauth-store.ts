import { spyOn } from 'bun:test'
import { createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import * as repo from '../src/repository/oauth.ts'
import type { User } from '../src/repository/user.ts'
import * as users from '../src/repository/user.ts'
import { handle } from '../src/web.ts'

class FakeResponse {
  status = 0
  headers: Record<string, string> = {}
  body = ''
  headersSent = false
  setHeader(name: string, value: string) {
    this.headers[name] = value
  }
  writeHead(status: number, headers: Record<string, string> = {}) {
    this.status = status
    this.headers = { ...this.headers, ...headers }
    this.headersSent = true
    return this
  }
  end(body: unknown = '') {
    this.body = String(body)
    return this
  }
}

/** One request through the whole server, as the web tests send them. */
export async function send(
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const raw = body === undefined ? [] : [typeof body === 'string' ? body : JSON.stringify(body)]
  const req = Object.assign(Readable.from(raw), {
    method,
    url,
    headers: { host: 'app.test', ...headers },
  })
  const res = new FakeResponse()
  await handle(req as unknown as IncomingMessage, res as unknown as ServerResponse)
  const type = res.headers['content-type'] ?? ''
  return {
    status: res.status,
    headers: res.headers,
    body: type.startsWith('application/json') ? JSON.parse(res.body) : res.body,
  }
}

export const challengeOf = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url')

/** The OAuth tables in memory, behind the repository's functions. */
export function fakeOauthStore(people: User[]) {
  const clients: repo.OauthClient[] = []
  const codes = new Map<
    string,
    { client: string; user: string; redirect_uri: string; challenge: string; expires: number }
  >()
  const tokens: {
    id: string
    client: string
    user: string
    access_hash: string
    access_expires: number
    refresh_hash: string
    refresh_expires: number
    used_at: string | null
  }[] = []
  let n = 0
  spyOn(repo, 'createClient').mockImplementation(async (c) => {
    clients.push({ id: `oauth_client:${++n}`, ...c })
  })
  spyOn(repo, 'getClient').mockImplementation(async (id) => clients.find((c) => c.client_id === id))
  spyOn(repo, 'saveCode').mockImplementation(async (c) => {
    codes.set(c.code_hash, { ...c, expires: Date.now() + c.minutes * 60_000 })
  })
  spyOn(repo, 'takeCode').mockImplementation(async (hash) => {
    const c = codes.get(hash)
    codes.delete(hash)
    return c && c.expires > Date.now() ? c : undefined
  })
  const live = (h: { access_minutes: number; refresh_days: number }) => ({
    access_expires: Date.now() + h.access_minutes * 60_000,
    refresh_expires: Date.now() + h.refresh_days * 86_400_000,
  })
  spyOn(repo, 'createToken').mockImplementation(async (client, user, h) => {
    tokens.push({ id: `oauth_token:${++n}`, client, user, ...h, ...live(h), used_at: null })
  })
  spyOn(repo, 'rotateToken').mockImplementation(async (old, client, h) => {
    const t = tokens.find(
      (x) => x.refresh_hash === old && x.client === client && x.refresh_expires > Date.now(),
    )
    if (!t) return false
    Object.assign(t, h, live(h))
    return true
  })
  spyOn(repo, 'tokenOwner').mockImplementation(async (hash) => {
    const t = tokens.find((x) => x.access_hash === hash && x.access_expires > Date.now())
    if (!t) return undefined
    t.used_at = '2026-10-19T12:00:00Z'
    return { id: t.id, user: t.user }
  })
  spyOn(repo, 'connectionsOf').mockImplementation(async (user) =>
    tokens
      .filter((t) => t.user === user)
      .map((t) => ({
        id: t.id,
        name: clients.find((c) => c.id === t.client)?.name ?? '',
        created_at: '2026-10-19T10:00:00Z',
        used_at: t.used_at,
      })),
  )
  spyOn(repo, 'deleteConnection').mockImplementation(async (user, id) => {
    const i = tokens.findIndex((t) => t.id === id && t.user === user)
    if (i < 0) return false
    tokens.splice(i, 1)
    return true
  })
  spyOn(users, 'getUser').mockImplementation(async (id) => people.find((p) => p.id === id))
  return { clients, codes, tokens }
}

const REDIRECT = 'https://assistant.example/callback'

/** The whole dance for one player: register, consent, trade the code. Returns the tokens. */
export async function connect(user: User, verifier = 'v'.repeat(50)) {
  const reg = await send('POST', '/oauth/register', {
    client_name: 'Assistant',
    redirect_uris: [REDIRECT],
  })
  const { decide } = await import('../src/oauth.ts')
  const back = await decide(
    user,
    {
      clientId: reg.body.client_id,
      redirectUri: REDIRECT,
      challenge: challengeOf(verifier),
      state: 's',
    },
    true,
  )
  const code = new URL(back as string).searchParams.get('code') as string
  const res = await send(
    'POST',
    '/oauth/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      client_id: reg.body.client_id,
      code_verifier: verifier,
    }).toString(),
    { 'content-type': 'application/x-www-form-urlencoded' },
  )
  return {
    clientId: reg.body.client_id as string,
    ...(res.body as { access_token: string; refresh_token: string }),
  }
}

export { REDIRECT }
