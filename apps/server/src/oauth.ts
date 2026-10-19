/** OAuth 2.1 for assistants connected through MCP (Claude, ChatGPT and others): they find how to
 * sign in from the two metadata documents, register themselves, send the player to the consent
 * page (/#/connect) and trade the code for tokens with PKCE. The player allows from their own
 * session; the assistant then reaches /mcp with a bearer token that reads only that player's data.
 * Only hashes of codes and tokens are stored. */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { clientIp } from './access.ts'
import { config } from './config.ts'
import { BadBody, json } from './http.ts'
import { allow } from './rate-limit.ts'
import {
  createClient,
  createToken,
  getClient,
  type OauthClient,
  rotateToken,
  saveCode,
  takeCode,
  tokenOwner,
} from './repository/oauth.ts'
import { getUser, type User } from './repository/user.ts'

const CODE_MINUTES = 10
const SCOPE = 'read'
const MAX_REDIRECTS = 5
const MAX_FORM = 10_000

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const secret = () => randomBytes(32).toString('hex')

// Assistants call from their own servers, and tools such as an MCP inspector from a browser page:
// nothing here rides on a cookie, so any origin may read the answers.
const OPEN = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version',
  'access-control-expose-headers': 'www-authenticate',
}

/** The address the instance was reached at, as a base for the documents' links. */
export function origin(req: IncomingMessage): string {
  const host = req.headers.host
  const safe = host && /^[a-z0-9.-]+(:\d{1,5})?$/i.test(host) ? host : `localhost:${config.port}`
  const proto =
    req.headers['x-forwarded-proto'] === 'https' || config.auth.secureCookie ? 'https' : 'http'
  return `${proto}://${safe}`
}

/** Where an assistant reads how to sign in, sent with a 401 from /mcp. */
export const resourceMetadataUrl = (req: IncomingMessage) =>
  `${origin(req)}/.well-known/oauth-protected-resource`

function protectedResource(req: IncomingMessage) {
  return {
    resource: `${origin(req)}/mcp`,
    authorization_servers: [origin(req)],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ['header'],
  }
}

function authorizationServer(req: IncomingMessage) {
  const base = origin(req)
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [SCOPE],
  }
}

// An assistant's return address: https anywhere, plain http only back to the same machine (a
// desktop app or a tool run locally). No fragments, which the code could not ride on.
function validRedirect(uri: unknown): uri is string {
  if (typeof uri !== 'string' || uri.length > 500) return false
  try {
    const u = new URL(uri)
    if (u.hash) return false
    if (u.protocol === 'https:') return true
    return u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
  } catch {
    return false
  }
}

function readText(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > MAX_FORM) {
        reject(new BadBody(413))
        req.destroy()
      }
    })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

// The token endpoint takes a form, as OAuth says; JSON is read too, for clients that send it.
async function readParams(req: IncomingMessage): Promise<Record<string, string>> {
  const raw = await readText(req)
  if ((req.headers['content-type'] ?? '').includes('application/json')) {
    try {
      const body = JSON.parse(raw || '{}') as Record<string, unknown>
      return Object.fromEntries(
        Object.entries(body).filter((e): e is [string, string] => typeof e[1] === 'string'),
      )
    } catch {
      throw new BadBody(400)
    }
  }
  return Object.fromEntries(new URLSearchParams(raw))
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  try {
    return JSON.parse((await readText(req)) || '{}')
  } catch {
    throw new BadBody(400)
  }
}

async function register(req: IncomingMessage, res: ServerResponse) {
  if (!allow(`oauth-register|${clientIp(req) ?? ''}`, 10, 60 * 60_000))
    return json(res, 429, { error: 'too_many_requests' }, OPEN)
  const body = await readJson(req)
  const uris = body.redirect_uris
  if (
    !Array.isArray(uris) ||
    !uris.length ||
    uris.length > MAX_REDIRECTS ||
    !uris.every(validRedirect)
  )
    return json(res, 400, { error: 'invalid_redirect_uri' }, OPEN)
  const name =
    typeof body.client_name === 'string' && body.client_name.trim()
      ? body.client_name.trim().slice(0, 80)
      : new URL(uris[0]).hostname
  const client_id = secret().slice(0, 32)
  await createClient({ client_id, name, redirect_uris: uris })
  return json(
    res,
    201,
    {
      client_id,
      client_name: name,
      redirect_uris: uris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: SCOPE,
    },
    OPEN,
  )
}

/** What the consent page sends back: the assistant, where it returns and its PKCE challenge. */
export interface ConsentRequest {
  clientId: string
  redirectUri: string
  challenge: string
  state: string | null
}

/** The registered client behind a consent request, when the return address is one it registered. */
export async function consentClient(c: Pick<ConsentRequest, 'clientId' | 'redirectUri'>) {
  const client = c.clientId ? await getClient(c.clientId) : undefined
  return client?.redirect_uris.includes(c.redirectUri) ? client : undefined
}

const returnTo = (redirect: string, params: Record<string, string | null>) => {
  const u = new URL(redirect)
  for (const [k, v] of Object.entries(params)) if (v !== null) u.searchParams.set(k, v)
  return u.toString()
}

// The assistant opens this in the player's browser. A bad client or return address is answered here
// (sending the browser to an address nobody registered would make this an open redirect); anything
// else goes back to the assistant as an error, and a good request moves on to the consent page.
async function authorize(res: ServerResponse, url: URL) {
  const p = url.searchParams
  const ask = {
    clientId: p.get('client_id') ?? '',
    redirectUri: p.get('redirect_uri') ?? '',
    challenge: p.get('code_challenge') ?? '',
    state: p.get('state'),
  }
  if (!(await consentClient(ask)))
    return res
      .writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
      .end('invalid client or redirect_uri')
  const fail = (error: string) =>
    res.writeHead(302, { location: returnTo(ask.redirectUri, { error, state: ask.state }) }).end()
  if (p.get('response_type') !== 'code') return fail('unsupported_response_type')
  if (p.get('code_challenge_method') !== 'S256' || !/^[\w-]{43,128}$/.test(ask.challenge))
    return fail('invalid_request')
  const page = new URLSearchParams({
    client_id: ask.clientId,
    redirect_uri: ask.redirectUri,
    code_challenge: ask.challenge,
    ...(ask.state !== null ? { state: ask.state } : {}),
  })
  return res.writeHead(302, { location: `/#/connect?${page}` }).end()
}

/** The player's answer on the consent page: where to send the browser, with a code when allowed. */
export async function decide(
  user: User,
  ask: ConsentRequest,
  allowed: boolean,
): Promise<string | null> {
  const client = await consentClient(ask)
  if (!client || !/^[\w-]{43,128}$/.test(ask.challenge)) return null
  if (!allowed) return returnTo(ask.redirectUri, { error: 'access_denied', state: ask.state })
  const code = secret()
  await saveCode({
    code_hash: hash(code),
    client: client.id,
    user: user.id,
    redirect_uri: ask.redirectUri,
    challenge: ask.challenge,
    minutes: CODE_MINUTES,
  })
  return returnTo(ask.redirectUri, { code, state: ask.state })
}

const verifierMatches = (verifier: string, challenge: string) => {
  if (!/^[\w.~-]{43,128}$/.test(verifier)) return false
  const a = Buffer.from(createHash('sha256').update(verifier).digest('base64url'))
  const b = Buffer.from(challenge)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function issue(
  res: ServerResponse,
  client: OauthClient,
  refreshHash?: string,
  user?: string,
) {
  const access = secret()
  const refresh = secret()
  const hashes = {
    access_hash: hash(access),
    refresh_hash: hash(refresh),
    access_minutes: config.mcp.accessMinutes,
    refresh_days: config.mcp.refreshDays,
  }
  if (refreshHash) {
    if (!(await rotateToken(refreshHash, client.id, hashes)))
      return json(res, 400, { error: 'invalid_grant' }, OPEN)
  } else await createToken(client.id, user as string, hashes)
  return json(
    res,
    200,
    {
      access_token: access,
      token_type: 'Bearer',
      expires_in: config.mcp.accessMinutes * 60,
      refresh_token: refresh,
      scope: SCOPE,
    },
    { ...OPEN, 'cache-control': 'no-store' },
  )
}

async function token(req: IncomingMessage, res: ServerResponse) {
  if (!allow(`oauth-token|${clientIp(req) ?? ''}`, 30, 60_000))
    return json(res, 429, { error: 'too_many_requests' }, OPEN)
  const p = await readParams(req)
  const client = p.client_id ? await getClient(p.client_id) : undefined
  if (!client) return json(res, 401, { error: 'invalid_client' }, OPEN)
  if (p.grant_type === 'refresh_token') {
    if (!p.refresh_token) return json(res, 400, { error: 'invalid_request' }, OPEN)
    return issue(res, client, hash(p.refresh_token))
  }
  if (p.grant_type !== 'authorization_code')
    return json(res, 400, { error: 'unsupported_grant_type' }, OPEN)
  const code = p.code ? await takeCode(hash(p.code)) : undefined
  if (
    !code ||
    code.client !== client.id ||
    code.redirect_uri !== p.redirect_uri ||
    !verifierMatches(p.code_verifier ?? '', code.challenge)
  )
    return json(res, 400, { error: 'invalid_grant' }, OPEN)
  return issue(res, client, undefined, code.user)
}

/** The player and connection behind a request's bearer token; undefined without a live one. */
export async function bearer(
  req: IncomingMessage,
): Promise<{ user: User; connection: string } | undefined> {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')
  if (!m) return undefined
  const owner = await tokenOwner(hash(m[1]))
  const user = owner && (await getUser(owner.user))
  return user && owner ? { user, connection: owner.id } : undefined
}

/** Answers the OAuth documents and endpoints; false for any other request. */
export async function oauthRoute(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  method: string,
): Promise<boolean> {
  const path = url.pathname
  const ours = path.startsWith('/.well-known/oauth-') || path.startsWith('/oauth/')
  if (!ours) return false
  if (method === 'OPTIONS') {
    res.writeHead(204, { ...OPEN, 'access-control-allow-methods': 'GET, POST' }).end()
    return true
  }
  if (method === 'GET' && path.startsWith('/.well-known/oauth-protected-resource'))
    json(res, 200, protectedResource(req), OPEN)
  else if (method === 'GET' && path.startsWith('/.well-known/oauth-authorization-server'))
    json(res, 200, authorizationServer(req), OPEN)
  else if (method === 'POST' && path === '/oauth/register') await register(req, res)
  else if (method === 'GET' && path === '/oauth/authorize') await authorize(res, url)
  else if (method === 'POST' && path === '/oauth/token') await token(req, res)
  else json(res, 404, { error: 'not found' }, OPEN)
  return true
}
