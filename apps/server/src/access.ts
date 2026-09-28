// Notes where each account is used from, so one person behind many accounts (to get around a
// per-account limit) can be found and limited. Only an HMAC of the IP address with ACCESS_HASH_SECRET is
// kept: the same address always gives the same hash, and the hash does not give the address back.
// Without the secret nothing is recorded.
import { createHmac } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { config } from './config.ts'
import { isDemo } from './demo.ts'
import { deleteAccessesBefore, recordAccess } from './repository/access.ts'
import type { User } from './repository/user.ts'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

// The client's address: the first X-Forwarded-For hop behind a proxy this instance trusts
// (TRUST_PROXY=1), the socket's address otherwise, since anyone can send that header.
export function clientIp(req: IncomingMessage): string | undefined {
  if (config.access.trustProxy) {
    const forwarded = req.headers['x-forwarded-for']
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
    if (first) return first
  }
  return req.socket.remoteAddress?.replace(/^::ffff:/, '')
}

export const hashIp = (ip: string, secret: string): string =>
  createHmac('sha256', secret).update(ip).digest('hex')

// One write per account and address an hour is enough to tell where an account is used from.
const noted = new Map<string, number>()

export async function noteAccess(req: IncomingMessage, user: User): Promise<void> {
  const secret = config.access.secret
  if (!secret || isDemo(user)) return
  const ip = clientIp(req)
  if (!ip) return
  const ipHash = hashIp(ip, secret)
  const key = `${user.id}/${ipHash}`
  const now = Date.now()
  if (now - (noted.get(key) ?? 0) < HOUR_MS) return
  noted.set(key, now)
  if (noted.size > 10_000) for (const [k, at] of noted) if (now - at >= HOUR_MS) noted.delete(k)
  await recordAccess(user.id, ipHash)
}

// Rows not seen for ACCESS_KEEP_DAYS are deleted at start and once a day.
export function startAccessCleanup(): void {
  if (!config.access.secret) return
  const clean = () =>
    deleteAccessesBefore(config.access.keepDays).catch((e) =>
      console.warn('access cleanup failed:', (e as Error).message),
    )
  clean()
  setInterval(clean, DAY_MS).unref()
}
