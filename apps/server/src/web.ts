import { existsSync, readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname } from 'node:path'
import { clientIp, noteAccess } from './access.ts'
import { AuthError, authenticate, MIN_PASSWORD } from './auth.ts'
import { config } from './config.ts'
import { tagged } from './costs.ts'
import { DemoReadOnly, isDemo } from './demo.ts'
import { BadBody, json, SECURITY_HEADERS } from './http.ts'
import { defineMessages, Language, type MessageKey, translator } from './i18n.ts'
import { library } from './library.ts'
import { mcpRoute } from './mcp.ts'
import { oauthRoute } from './oauth.ts'
import { interceptsFor, pluginPagePolicy, pluginRoute, Refused } from './plugins.ts'
import { PrivateProfile } from './psn.ts'
import { allow } from './rate-limit.ts'
import type { User } from './repository/user.ts'
import { ACCOUNT_ROUTES } from './routes/account.ts'
import { type ApiHandler, apiMessages, requestLocale } from './routes/api.ts'
import { authRoutes } from './routes/auth.ts'
import { CHAT_ROUTES } from './routes/chat.ts'
import { demoAnswered } from './routes/demo.ts'
import { EVENT_ROUTES } from './routes/events.ts'
import { GAME_ROUTES } from './routes/games.ts'
import { HOME_ROUTES } from './routes/home.ts'
import { INTEREST_ROUTES } from './routes/interests.ts'
import { PLAN_ROUTES } from './routes/plan.ts'

// What a failed request says, whichever route threw it.
const messages = defineMessages({
  [Language.PtBR]: {
    psnNotFound: 'Não achamos esse PSN ID. Por favor, confere se digitou certo.',
    weakPassword: 'A senha precisa ter pelo menos {min} caracteres.',
    taken: 'Esse PSN ID já tem conta. Entre com a senha.',
    wrongPassword: 'Senha incorreta.',
    tooManyAttempts: 'Muitas tentativas. Espere 15 minutos ou recupere o acesso.',
    claimPending:
      'Já existe uma recuperação em andamento para este PSN ID. Termine no navegador onde ela começou ou espere ela expirar.',
    confirmationMismatch: 'O PSN ID digitado não confere.',
    trophiesPrivate:
      'Seus troféus estão privados na PSN. Deixe "Troféus" visível para "Qualquer pessoa" nas configurações de privacidade e tente de novo.',
    noPendingVerification: 'O código expirou. Comece de novo.',
    codeNotFound:
      'Ainda não encontramos o código no seu "Sobre mim". Salve o perfil na PSN e tente de novo em alguns segundos.',
    profilePrivate:
      'Não conseguimos ler seu perfil. Deixe o perfil visível para "Todos" nas configurações de privacidade da PSN.',
    demoReadOnly:
      'Isto é uma demonstração: dá para ver tudo, mas nada é salvo. Conecte sua conta da PSN para usar de verdade.',
  },
  [Language.En]: {
    psnNotFound: "We couldn't find this PSN ID. Please check the spelling.",
    weakPassword: 'The password needs at least {min} characters.',
    taken: 'This PSN ID already has an account. Sign in with the password.',
    wrongPassword: 'Wrong password.',
    tooManyAttempts: 'Too many attempts. Wait 15 minutes or recover access.',
    claimPending:
      'A recovery is already under way for this PSN ID. Finish it in the browser where it started or wait for it to expire.',
    confirmationMismatch: "The PSN ID you typed doesn't match.",
    trophiesPrivate:
      'Your trophies are private on PSN. Set "Trophies" to "Anyone" in the privacy settings and try again.',
    noPendingVerification: 'The code has expired. Start over.',
    codeNotFound:
      'We haven\'t found the code in your "About me" yet. Save the profile on PSN and try again in a few seconds.',
    profilePrivate:
      'We couldn\'t read your profile. Make the profile visible to "Anyone" in the PSN privacy settings.',
    demoReadOnly:
      'This is a demo: you can look at everything, but nothing is saved. Connect your PSN account to use it for real.',
  },
})

// The built web app (bun run build). Hashed assets under /assets never change, so they cache for good.
const PUBLIC_DIR = new URL('../../web/dist/', import.meta.url)
// Set by `bun run dev`: pages come from the Vite dev server instead of the build.
const DEV_WEB = process.env.WEB_DEV_URL
const STATIC_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  // Browsers and the services that show a site's icon (an assistant's list of connectors) ask for it.
  '.ico': 'image/x-icon',
  // The install manifest: without its type the app shell would be served in its place.
  '.webmanifest': 'application/manifest+json',
}

const AUTH_MESSAGES: Record<AuthError['code'], [number, MessageKey<typeof messages>]> = {
  psn_not_found: [404, 'psnNotFound'],
  weak_password: [400, 'weakPassword'],
  taken: [409, 'taken'],
  wrong_password: [401, 'wrongPassword'],
  too_many_attempts: [429, 'tooManyAttempts'],
  claim_pending: [409, 'claimPending'],
  confirmation_mismatch: [400, 'confirmationMismatch'],
  trophies_private: [422, 'trophiesPrivate'],
  no_pending_verification: [409, 'noPendingVerification'],
  code_not_found: [422, 'codeNotFound'],
  profile_private: [422, 'profilePrivate'],
}

// The app's own routes, by method and path, gathered from each area.
const API_ROUTES: Record<string, ApiHandler> = {
  ...ACCOUNT_ROUTES,
  ...HOME_ROUTES,
  ...GAME_ROUTES,
  ...CHAT_ROUTES,
  ...PLAN_ROUTES,
  ...EVENT_ROUTES,
  ...INTEREST_ROUTES,
}

async function api(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  method: string,
  me: User,
): Promise<void> {
  const titles = () => library(me.psn_account_id)
  const locale = requestLocale(req, me)
  if (isDemo(me) && (await demoAnswered(req, res, url, method, me))) return
  const key = `${method} ${url.pathname}`
  const handler = Object.hasOwn(API_ROUTES, key) ? API_ROUTES[key] : undefined
  if (handler) return handler({ req, res, url, me, locale, titles })
  json(res, 404, { error: 'not found' })
}

/** The app shell, with the share-preview image as a full URL: link previews (WhatsApp, Telegram)
 * skip a relative one. The address is the one the visitor used, so any instance gets its own. */
function withShareImage(req: IncomingMessage, file: URL): string {
  const html = readFileSync(file, 'utf8')
  const host = req.headers.host
  // A Host header is client data: only a plain host name (and port) goes into the page.
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return html
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
  return html.replace('content="/og.png"', `content="${proto}://${host}/og.png"`)
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// The request's Origin, when it has one, names this same host.
function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

// Plugins step in first: one that answers ends the request (another sign-in, a file of its own);
// the others let it through to the app. One that takes longer than HOOK_TIMEOUT_MS fails the request
// (500). True when the request was answered here.
async function intercepted(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  method: string,
): Promise<boolean> {
  const path = url.pathname
  const intercepts = interceptsFor(path, method)
  if (!intercepts.length) return false
  if (path.startsWith('/api/') && !READ_METHODS.has(method) && !sameOrigin(req)) {
    json(res, 403, { error: 'cross_origin' })
    return true
  }
  const me = await authenticate(req)
  // The demo account is shared: as on plugin routes, a plugin's interceptor only sees it read. Sign-in
  // and sign-out stay open to it, as the app's own auth routes are.
  if (me && isDemo(me) && method !== 'GET' && !path.startsWith('/api/auth/'))
    throw new DemoReadOnly()
  for (const handler of intercepts) {
    await handler({ req, res, url, method, me })
    if (res.headersSent || res.writableEnded) return true
  }
  return false
}

async function apiRoute(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  method: string,
): Promise<void> {
  const path = url.pathname
  // One address shares one budget across every route (API_RATE_LIMIT a minute), sign-in or not.
  const limit = config.api.perMinute
  if (limit && !allow(`api|${clientIp(req) ?? ''}`, limit, 60_000))
    return json(
      res,
      429,
      {
        error: 'too_many_requests',
        message: translator(apiMessages, requestLocale(req))('tooManyRequests'),
      },
      { 'retry-after': '60' },
    )
  // A browser always says where a request comes from; a change asked by another site's page
  // is refused. Server-to-server calls (a payment provider's webhook) send no Origin.
  if (!READ_METHODS.has(method) && !sameOrigin(req))
    return json(res, 403, { error: 'cross_origin' })
  // Plugin routes (/api/ext/…) answer only their own method; public ones, like a payment
  // provider's webhook, skip sign-in.
  const ext = pluginRoute(path)
  if (ext && ext.method !== method)
    return json(res, 405, { error: 'method_not_allowed' }, { allow: ext.method })
  if (ext?.public) return ext.handler({ req, res, url, method })
  if (await authRoutes(req, res, path, method)) return
  const me = await authenticate(req)
  if (!me) return json(res, 401, { error: 'unauthenticated' })
  noteAccess(req, me).catch((e) => console.warn('access not noted:', (e as Error).message))
  const tag = isDemo(me) ? { user: me.id, demo: true } : { user: me.id }
  if (ext) {
    // The demo account is shared: like the app's own routes, plugin routes only read for it.
    if (isDemo(me) && ext.method !== 'GET') throw new DemoReadOnly()
    return tagged(tag, () => ext.handler({ req, res, url, method, me }))
  }
  return tagged(tag, () => api(req, res, url, method, me))
}

// Development: the page comes from Vite, which rebuilds on save; /api stays here.
async function devPage(req: IncomingMessage, res: ServerResponse, devWeb: string): Promise<void> {
  const r = await fetch(new URL(req.url ?? '/', devWeb))
  const headers = Object.fromEntries(
    [...r.headers].filter(
      ([k]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(k),
    ),
  )
  res.writeHead(r.status, headers).end(Buffer.from(await r.arrayBuffer()))
}

function staticHeaders(path: string, type: string) {
  return {
    'content-type': type,
    'cache-control': path.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
    ...SECURITY_HEADERS,
    ...(type === STATIC_TYPES['.html'] ? { 'content-security-policy': pluginPagePolicy() } : {}),
    ...(config.auth.secureCookie
      ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' }
      : {}),
  }
}

// Static files from the built app; anything unknown falls back to the app shell, which routes the address.
// False when not even the shell is there.
function servedStatic(req: IncomingMessage, res: ServerResponse, path: string): boolean {
  const file = path === '/' ? 'index.html' : path.slice(1)
  const safe = !file.includes('..') && STATIC_TYPES[extname(file)]
  const target = new URL(safe ? file : 'index.html', PUBLIC_DIR)
  if (!existsSync(target)) return false
  const type = STATIC_TYPES[extname(target.pathname)] ?? STATIC_TYPES['.html']
  res
    .writeHead(200, staticHeaders(path, type))
    .end(
      target.pathname.endsWith('/index.html') ? withShareImage(req, target) : readFileSync(target),
    )
  return true
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  const method = req.method ?? 'GET'

  if (await intercepted(req, res, url, method)) return
  if (await oauthRoute(req, res, url, method)) return
  if (await mcpRoute(req, res, url, method)) return
  if (path.startsWith('/api/')) return apiRoute(req, res, url, method)
  if (method === 'GET' && DEV_WEB) return devPage(req, res, DEV_WEB)
  if (method === 'GET' && servedStatic(req, res, path)) return
  res.writeHead(404).end('not found')
}

export function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return route(req, res).catch(async (e) => {
    if (res.headersSent) return
    const locale = requestLocale(req)
    if (e instanceof AuthError) {
      const [status, key] = AUTH_MESSAGES[e.code]
      return json(res, status, {
        error: e.code,
        message: translator(messages, locale)(key, { min: MIN_PASSWORD }),
      })
    }
    if (e instanceof PrivateProfile)
      return json(res, 409, {
        error: 'trophies_private',
        message: translator(messages, locale)('trophiesPrivate'),
      })
    if (e instanceof DemoReadOnly)
      return json(res, 403, {
        error: 'demo_read_only',
        message: translator(messages, locale)('demoReadOnly'),
      })
    if (e instanceof Refused) return json(res, e.status, { error: e.code, message: e.message })
    if (e instanceof BadBody)
      return json(res, e.status, { error: e.status === 413 ? 'body_too_large' : 'bad_json' })
    console.error('web failed:', (e as Error).message)
    json(res, 500, { error: 'internal error' })
  })
}

export function startWeb(): void {
  createServer((req, res) => {
    handle(req, res)
  }).listen(config.port, () => console.log(`web: http://localhost:${config.port}`))
}
