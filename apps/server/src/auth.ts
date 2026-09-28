import { createHash, randomBytes } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { config } from './config.ts'
import { demoUser } from './demo.ts'
import { emit } from './plugins.ts'
import { aboutMe, lookupProfile, trophiesVisible } from './psn.ts'
import { deleteAccesses } from './repository/access.ts'
import {
  createSession,
  deleteSession,
  deleteSessionsExcept,
  deleteSessionsOf,
  deleteVerification,
  getVerification,
  saveVerification,
  sessionUser,
} from './repository/auth.ts'
import { detachCalls } from './repository/llm-call.ts'
import {
  createUser,
  deleteUser,
  getUser,
  touchUser,
  type User,
  updateUser,
  userByAccount,
  wipeUserData,
} from './repository/user.ts'

const COOKIE = 'platjourney_session'
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

export class AuthError extends Error {
  constructor(
    public readonly code:
      | 'psn_not_found'
      | 'weak_password'
      | 'taken'
      | 'wrong_password'
      | 'too_many_attempts'
      | 'confirmation_mismatch'
      | 'trophies_private'
      | 'no_pending_verification'
      | 'code_not_found'
      | 'profile_private',
  ) {
    super(code)
  }
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

function newCode(): string {
  const bytes = randomBytes(6)
  return `TC-${[...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')}`
}

export const MIN_PASSWORD = 8
const checkPassword = (password: string) => {
  if (password.length < MIN_PASSWORD || password.length > 200) throw new AuthError('weak_password')
}

async function openSession(user: User): Promise<{ user: User; token: string }> {
  const token = randomBytes(32).toString('hex')
  await createSession(user.id, hash(token), config.auth.sessionDays)
  return { user, token }
}

// Wrong passwords per PSN id, in memory: enough to make guessing pointless.
const MAX_ATTEMPTS = 8
const ATTEMPT_WINDOW_MS = 15 * 60_000
const attempts = new Map<string, { count: number; since: number }>()
function countAttempt(key: string): void {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || now - entry.since > ATTEMPT_WINDOW_MS) attempts.set(key, { count: 1, since: now })
  else entry.count++
}
function blocked(key: string): boolean {
  const entry = attempts.get(key)
  return !!entry && Date.now() - entry.since <= ATTEMPT_WINDOW_MS && entry.count >= MAX_ATTEMPTS
}

export interface AccountStatus {
  onlineId: string
  avatarUrl: string | null
  // 'new': nobody holds it yet, which includes an account loaded from the seed
  // that has no password. 'registered': has a password.
  status: 'new' | 'registered'
  // A new account needs a public trophy list; Nexo has nothing to work with otherwise.
  trophiesPrivate: boolean
}

export async function accountStatus(onlineId: string): Promise<AccountStatus> {
  const profile = await lookupProfile(onlineId.trim())
  if (!profile) throw new AuthError('psn_not_found')
  const user = await userByAccount(profile.accountId)
  return {
    onlineId: profile.onlineId,
    avatarUrl: profile.avatarUrl,
    status: user?.password_hash ? 'registered' : 'new',
    trophiesPrivate: user?.password_hash ? false : !(await trophiesVisible(profile.accountId)),
  }
}

// First come, first served: no proof is asked to register a PSN id. Whoever owns
// the profile can take the account over later with claim().
export async function register(
  onlineId: string,
  password: string,
): Promise<{ user: User; token: string }> {
  checkPassword(password)
  const profile = await lookupProfile(onlineId.trim())
  if (!profile) throw new AuthError('psn_not_found')
  const existing = await userByAccount(profile.accountId)
  if (existing?.password_hash) throw new AuthError('taken')
  if (!(await trophiesVisible(profile.accountId))) throw new AuthError('trophies_private')
  if (existing) {
    // Loaded from the seed, never signed in: the first password makes it theirs.
    await updateUser(existing.id, {
      password_hash: await Bun.password.hash(password),
      psn_online_id: profile.onlineId,
      avatar_url: profile.avatarUrl,
    })
    return openSession((await getUser(existing.id)) as User)
  }
  const user = await createUser({
    psn_online_id: profile.onlineId,
    psn_account_id: profile.accountId,
    password_hash: await Bun.password.hash(password),
    avatar_url: profile.avatarUrl,
  })
  await emit('user:created', user)
  console.log(`new user: ${user.psn_online_id}`)
  return openSession(user)
}

export async function login(
  onlineId: string,
  password: string,
): Promise<{ user: User; token: string }> {
  const profile = await lookupProfile(onlineId.trim())
  if (!profile) throw new AuthError('psn_not_found')
  const key = profile.accountId
  if (blocked(key)) throw new AuthError('too_many_attempts')
  const user = await userByAccount(profile.accountId)
  const ok = !!user?.password_hash && (await Bun.password.verify(password, user.password_hash))
  if (!user || !ok) {
    countAttempt(key)
    throw new AuthError('wrong_password')
  }
  attempts.delete(key)
  if (user.psn_online_id !== profile.onlineId || user.avatar_url !== profile.avatarUrl) {
    // PSN ids can be renamed; the account id is the identity.
    await updateUser(user.id, { psn_online_id: profile.onlineId, avatar_url: profile.avatarUrl })
  }
  return openSession(user)
}

// The demo player opens without a password; null when this instance has no demo loaded.
export async function demoSession(): Promise<{ user: User; token: string } | null> {
  const user = await demoUser()
  return user ? openSession(user) : null
}

export interface PendingVerification {
  onlineId: string
  avatarUrl: string | null
  code: string
  minutes: number
}

// Claim, step 1: a code to place in the profile's "About me".
export async function startClaim(onlineId: string): Promise<PendingVerification> {
  const profile = await lookupProfile(onlineId.trim())
  if (!profile) throw new AuthError('psn_not_found')
  const pending = await getVerification(profile.onlineId)
  const code = pending?.code ?? newCode()
  await saveVerification({
    psn_online_id: profile.onlineId,
    psn_account_id: profile.accountId,
    avatar_url: profile.avatarUrl,
    code,
    minutes: config.auth.verificationMinutes,
  })
  return {
    onlineId: profile.onlineId,
    avatarUrl: profile.avatarUrl,
    code,
    minutes: config.auth.verificationMinutes,
  }
}

// Claim, step 2: the code is on the profile, so this person controls the PSN
// account. They get the account with a new password; every other session and the
// Telegram link are dropped, and the data too when they ask for a clean start.
export async function finishClaim(
  onlineId: string,
  password: string,
  fresh: boolean,
): Promise<{ user: User; token: string }> {
  checkPassword(password)
  const pending = await getVerification(onlineId.trim())
  if (!pending) throw new AuthError('no_pending_verification')
  if (!config.auth.skipVerification) {
    const about = await aboutMe(pending.psn_account_id)
    if (about === null) throw new AuthError('profile_private')
    if (!about.toUpperCase().includes(pending.code)) throw new AuthError('code_not_found')
  }
  const password_hash = await Bun.password.hash(password)
  let user = await userByAccount(pending.psn_account_id)
  if (!user) {
    user = await createUser({
      psn_online_id: pending.psn_online_id,
      psn_account_id: pending.psn_account_id,
      password_hash,
      avatar_url: pending.avatar_url,
    })
    await emit('user:created', user)
  } else {
    await deleteSessionsOf(user.id)
    if (fresh) await wipeUserData(user.id)
    await updateUser(user.id, {
      password_hash,
      psn_online_id: pending.psn_online_id,
      avatar_url: pending.avatar_url,
      telegram_link_code: null,
      // Someone else may have linked their chat.
      telegram_chat_id: null,
    })
    console.log(`account claimed: ${pending.psn_online_id}${fresh ? ' (clean start)' : ''}`)
  }
  await deleteVerification(pending.psn_online_id)
  attempts.delete(pending.psn_account_id)
  const current = (await userByAccount(pending.psn_account_id)) as User
  return openSession(current)
}

export function sessionCookie(token: string | null): string {
  const base = `${COOKIE}=${token ?? ''}; Path=/; HttpOnly; SameSite=Lax${config.auth.secureCookie ? '; Secure' : ''}`
  return token ? `${base}; Max-Age=${config.auth.sessionDays * 86_400}` : `${base}; Max-Age=0`
}

function tokenFrom(req: IncomingMessage): string | undefined {
  const header = req.headers.cookie ?? ''
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === COOKIE) return rest.join('=') || undefined
  }
  return undefined
}

export async function authenticate(req: IncomingMessage): Promise<User | undefined> {
  const token = tokenFrom(req)
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return undefined
  const id = await sessionUser(hash(token))
  if (!id) return undefined
  const user = await getUser(id)
  if (user) touchUser(user.id).catch(() => {})
  return user
}

export async function logout(req: IncomingMessage): Promise<void> {
  const token = tokenFrom(req)
  if (token) await deleteSession(hash(token))
}

// Keeps the session that asked for the change and ends every other one.
export async function changePassword(
  req: IncomingMessage,
  user: User,
  current: string,
  next: string,
): Promise<void> {
  checkPassword(next)
  const ok = !!user.password_hash && (await Bun.password.verify(current, user.password_hash))
  if (!ok) throw new AuthError('wrong_password')
  await updateUser(user.id, { password_hash: await Bun.password.hash(next) })
  await deleteSessionsExcept(user.id, hash(tokenFrom(req) ?? ''))
}

// Everything tied to the account goes. Cost records stay, without the link.
export async function deleteAccount(user: User, confirmOnlineId: string): Promise<void> {
  if (confirmOnlineId.trim().toLowerCase() !== user.psn_online_id.toLowerCase())
    throw new AuthError('confirmation_mismatch')
  await wipeUserData(user.id)
  // Plugins clean what they keep for the player before the account goes.
  await emit('user:deleted', user)
  await deleteAccesses(user.id)
  await detachCalls(user.id)
  await deleteVerification(user.psn_online_id)
  await deleteSessionsOf(user.id)
  await deleteUser(user.id)
  console.log(`account deleted: ${user.psn_online_id}`)
}

export function newLinkCode(): string {
  return randomBytes(9).toString('base64url')
}
