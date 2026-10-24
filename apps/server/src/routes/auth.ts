import type { IncomingMessage, ServerResponse } from 'node:http'
import { clientIp } from '../access.ts'
import {
  accountStatus,
  claimCookie,
  claimSecretFrom,
  demoSession,
  finishClaim,
  login,
  logout,
  register,
  sessionCookie,
  startClaim,
} from '../auth.ts'
import { config } from '../config.ts'
import { json, readBody } from '../http.ts'
import { defineMessages, Language, translator } from '../i18n.ts'
import { allow } from '../rate-limit.ts'
import { type User, updateUser } from '../repository/user.ts'
import { watchNow } from '../watcher.ts'
import { apiMessages, publicUser, requestLocale } from './api.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    invalidPsnId: 'PSN ID inválido.',
    demoUnavailable: 'A demonstração não está disponível neste servidor.',
  },
  [Language.En]: {
    invalidPsnId: 'Invalid PSN ID.',
    demoUnavailable: 'The demo is not available on this server.',
  },
})

const validId = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{3,16}$/.test(v.trim())

export async function authRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  method: string,
): Promise<boolean> {
  if (!path.startsWith('/api/auth/') || method !== 'POST') return false
  // Each of these asks PSN or opens a session: a loop from one address is cut short, so it can
  // neither wear out the instance's PSN account nor fill the database with demo sessions.
  const ip = clientIp(req) ?? ''
  const demo = path === '/api/auth/demo'
  if (!allow(`${demo ? 'demo' : 'auth'}|${ip}`, demo ? 5 : 30, 60_000)) {
    json(res, 429, {
      error: 'too_many_requests',
      message: translator(apiMessages, requestLocale(req))('tooManyRequests'),
    })
    return true
  }
  if (path === '/api/auth/logout') {
    await logout(req)
    json(res, 200, { ok: true }, { 'set-cookie': sessionCookie(null) })
    return true
  }
  if (demo) return demoSignIn(req, res)
  return accountRoutes(req, res, path, ip)
}

async function demoSignIn(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const session = await demoSession()
  if (!session) {
    json(res, 404, {
      error: 'demo_unavailable',
      message: translator(messages, requestLocale(req))('demoUnavailable'),
    })
    return true
  }
  watchNow(session.user)
  json(res, 200, { user: publicUser(session.user) }, { 'set-cookie': sessionCookie(session.token) })
  return true
}

// Looking an account up, creating it, signing in and claiming it: all name a PSN id.
async function accountRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  ip: string,
): Promise<boolean> {
  const { onlineId, password, fresh } = await readBody(req)
  if (!validId(onlineId)) {
    json(res, 400, {
      error: 'invalid_psn_id',
      message: translator(messages, requestLocale(req))('invalidPsnId'),
    })
    return true
  }
  const signIn = ({ user, token }: { user: User; token: string }) => {
    watchNow(user)
    json(res, 200, { user: publicUser(user) }, { 'set-cookie': sessionCookie(token) })
  }
  const secret = typeof password === 'string' ? password : ''
  switch (path) {
    case '/api/auth/lookup':
      json(res, 200, await accountStatus(onlineId))
      return true
    case '/api/auth/register': {
      // A new account keeps the language the page was showing.
      const session = await register(onlineId, secret)
      if (!session.user.locale) {
        session.user.locale = requestLocale(req)
        await updateUser(session.user.id, { locale: session.user.locale })
      }
      signIn(session)
      return true
    }
    case '/api/auth/login':
      signIn(await login(onlineId, secret, ip))
      return true
    case '/api/auth/claim': {
      const { secret: claimSecret, ...claim } = await startClaim(onlineId, claimSecretFrom(req))
      json(
        res,
        200,
        { ...claim, skipVerification: config.auth.skipVerification },
        { 'set-cookie': claimCookie(claimSecret) },
      )
      return true
    }
    case '/api/auth/claim/finish': {
      const { user, token } = await finishClaim(
        onlineId,
        secret,
        fresh === true,
        claimSecretFrom(req),
      )
      watchNow(user)
      json(
        res,
        200,
        { user: publicUser(user) },
        { 'set-cookie': [sessionCookie(token), claimCookie(null)] },
      )
      return true
    }
    default:
      return false
  }
}
