import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { createHash } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import {
  type AuthError,
  accountStatus,
  authenticate,
  changePassword,
  deleteAccount,
  finishClaim,
  login,
  logout,
  newLinkCode,
  register,
  sessionCookie,
  startClaim,
} from '../src/auth.ts'
import { config } from '../src/config.ts'
import * as psn from '../src/psn.ts'
import * as accesses from '../src/repository/access.ts'
import * as sessions from '../src/repository/auth.ts'
import * as calls from '../src/repository/llm-call.ts'
import * as oauth from '../src/repository/oauth.ts'
import * as pushSubs from '../src/repository/push-subscription.ts'
import * as users from '../src/repository/user.ts'
import { makeUser } from './api-fixtures.ts'

const TOKEN = 'a'.repeat(64)
const sha = (t: string) => createHash('sha256').update(t).digest('hex')
const withCookie = (cookie?: string) => ({ headers: { cookie } }) as IncomingMessage
const profile = (accountId = 'acc-1', onlineId = 'Kratos') => ({
  accountId,
  onlineId,
  avatarUrl: 'avatar.png',
})
const code = (e: unknown) => (e as AuthError).code
const savedSkip = config.auth.skipVerification

let createSession: ReturnType<typeof spyOn>
let updateUser: ReturnType<typeof spyOn>
let createUser: ReturnType<typeof spyOn>

beforeEach(() => {
  config.auth.skipVerification = false
  spyOn(console, 'log').mockImplementation(() => {})
  spyOn(Bun.password, 'hash').mockImplementation(async (p) => `hash:${p}`)
  spyOn(Bun.password, 'verify').mockImplementation(async (p, h) => h === `hash:${p}`)
  spyOn(psn, 'lookupProfile').mockImplementation(async (id) => profile('acc-1', id))
  spyOn(psn, 'trophiesVisible').mockResolvedValue(true)
  spyOn(psn, 'aboutMe').mockResolvedValue('')
  createSession = spyOn(sessions, 'createSession').mockResolvedValue()
  spyOn(sessions, 'deleteSession').mockResolvedValue()
  spyOn(sessions, 'deleteSessionsExcept').mockResolvedValue()
  spyOn(sessions, 'deleteSessionsOf').mockResolvedValue()
  spyOn(oauth, 'deleteConnectionsOf').mockResolvedValue()
  spyOn(sessions, 'deleteVerification').mockResolvedValue()
  spyOn(sessions, 'getVerification').mockResolvedValue(undefined)
  spyOn(sessions, 'saveVerification').mockResolvedValue(true)
  spyOn(sessions, 'sessionUser').mockResolvedValue(undefined)
  spyOn(calls, 'detachCalls').mockResolvedValue()
  spyOn(accesses, 'deleteAccesses').mockResolvedValue()
  spyOn(pushSubs, 'deletePushSubscriptions').mockResolvedValue()
  createUser = spyOn(users, 'createUser').mockImplementation(async (u) =>
    makeUser({ id: 'user:new', ...u, password_hash: u.password_hash ?? null }),
  )
  spyOn(users, 'deleteUser').mockResolvedValue()
  spyOn(users, 'getUser').mockResolvedValue(undefined)
  spyOn(users, 'touchUser').mockResolvedValue()
  updateUser = spyOn(users, 'updateUser').mockResolvedValue()
  spyOn(users, 'userByAccount').mockResolvedValue(undefined)
  spyOn(users, 'wipeUserData').mockResolvedValue()
})

afterEach(() => {
  config.auth.skipVerification = savedSkip
  mock.restore()
})

test('lookup says whether a PSN id is free and if its trophies are public', async () => {
  spyOn(psn, 'trophiesVisible').mockResolvedValue(false)
  expect(await accountStatus(' Kratos ')).toEqual({
    onlineId: 'Kratos',
    avatarUrl: 'avatar.png',
    status: 'new',
    trophiesPrivate: true,
  })
  spyOn(users, 'userByAccount').mockResolvedValue(makeUser({ password_hash: 'x' }))
  expect(await accountStatus('Kratos')).toMatchObject({
    status: 'registered',
    trophiesPrivate: false,
  })
})

test('lookup of an unknown PSN id fails', async () => {
  spyOn(psn, 'lookupProfile').mockResolvedValue(null)
  expect(code(await accountStatus('nobody').catch((e) => e))).toBe('psn_not_found')
})

test('register creates the user and opens a session', async () => {
  const { user, token } = await register('Kratos', 'long enough')
  expect(user.id).toBe('user:new')
  expect(createUser.mock.calls[0][0]).toEqual({
    psn_online_id: 'Kratos',
    psn_account_id: 'acc-1',
    password_hash: 'hash:long enough',
    avatar_url: 'avatar.png',
  })
  expect(token).toMatch(/^[a-f0-9]{64}$/)
  expect(createSession).toHaveBeenCalledWith('user:new', sha(token), config.auth.sessionDays)
})

test('register rejects short passwords, unknown ids, taken ids and private trophies', async () => {
  expect(code(await register('Kratos', 'short').catch((e) => e))).toBe('weak_password')
  expect(code(await register('Kratos', 'x'.repeat(201)).catch((e) => e))).toBe('weak_password')

  spyOn(psn, 'lookupProfile').mockResolvedValueOnce(null)
  expect(code(await register('Kratos', 'long enough').catch((e) => e))).toBe('psn_not_found')

  spyOn(users, 'userByAccount').mockResolvedValueOnce(makeUser({ password_hash: 'x' }))
  expect(code(await register('Kratos', 'long enough').catch((e) => e))).toBe('taken')

  spyOn(psn, 'trophiesVisible').mockResolvedValueOnce(false)
  expect(code(await register('Kratos', 'long enough').catch((e) => e))).toBe('trophies_private')
})

test('register takes over a seeded account without a password', async () => {
  const seeded = makeUser({ id: 'user:seed' })
  spyOn(users, 'userByAccount').mockResolvedValue(seeded)
  spyOn(users, 'getUser').mockResolvedValue(seeded)
  const { user } = await register('Kratos', 'long enough')
  expect(user).toBe(seeded)
  expect(updateUser).toHaveBeenCalledWith('user:seed', {
    password_hash: 'hash:long enough',
    psn_online_id: 'Kratos',
    avatar_url: 'avatar.png',
  })
  expect(createUser).not.toHaveBeenCalled()
})

test('login with the right password opens a session and follows renames', async () => {
  const stored = makeUser({ psn_online_id: 'OldName', password_hash: 'hash:secret12' })
  spyOn(users, 'userByAccount').mockResolvedValue(stored)
  const { user } = await login('Kratos', 'secret12')
  expect(user).toBe(stored)
  expect(updateUser).toHaveBeenCalledWith(stored.id, {
    psn_online_id: 'Kratos',
    avatar_url: 'avatar.png',
  })
})

test('login with an unchanged profile does not touch the user', async () => {
  spyOn(users, 'userByAccount').mockResolvedValue(
    makeUser({ avatar_url: 'avatar.png', password_hash: 'hash:secret12' }),
  )
  await login('Kratos', 'secret12')
  expect(updateUser).not.toHaveBeenCalled()
})

test('login fails for unknown ids and accounts without a password', async () => {
  spyOn(psn, 'lookupProfile').mockResolvedValueOnce(null)
  expect(code(await login('Kratos', 'secret12').catch((e) => e))).toBe('psn_not_found')
  spyOn(psn, 'lookupProfile').mockResolvedValue(profile('acc-nopass'))
  expect(code(await login('Kratos', 'secret12').catch((e) => e))).toBe('wrong_password')
})

test('too many wrong passwords block the account for a while', async () => {
  spyOn(psn, 'lookupProfile').mockResolvedValue(profile('acc-guessed'))
  spyOn(users, 'userByAccount').mockResolvedValue(makeUser({ password_hash: 'hash:right-one' }))
  for (let i = 0; i < 8; i++)
    expect(code(await login('Kratos', `guess-${i}`).catch((e) => e))).toBe('wrong_password')
  expect(code(await login('Kratos', 'right-one').catch((e) => e))).toBe('too_many_attempts')
})

test('wrong passwords lock one address out, not the owner elsewhere', async () => {
  spyOn(psn, 'lookupProfile').mockResolvedValue(profile('acc-targeted'))
  spyOn(users, 'userByAccount').mockResolvedValue(
    makeUser({ avatar_url: 'avatar.png', password_hash: 'hash:owner-pass' }),
  )
  for (let i = 0; i < 8; i++) await login('Kratos', 'guess-guess', '198.51.100.1').catch(() => {})
  expect(code(await login('Kratos', 'owner-pass', '198.51.100.1').catch((e) => e))).toBe(
    'too_many_attempts',
  )
  expect((await login('Kratos', 'owner-pass', '203.0.113.5')).user).toBeDefined()
})

test('a right password clears the wrong attempts', async () => {
  spyOn(psn, 'lookupProfile').mockResolvedValue(profile('acc-forgetful'))
  spyOn(users, 'userByAccount').mockResolvedValue(
    makeUser({ avatar_url: 'avatar.png', password_hash: 'hash:right-one' }),
  )
  for (let i = 0; i < 7; i++) await login('Kratos', 'nope-nope').catch(() => {})
  await login('Kratos', 'right-one')
  expect(code(await login('Kratos', 'nope-nope').catch((e) => e))).toBe('wrong_password')
  await login('Kratos', 'right-one')
})

test('a claim gives a fresh code and secret, and the same code to whoever holds that secret', async () => {
  const save = spyOn(sessions, 'saveVerification')
  const fresh = await startClaim(' Kratos ')
  expect(fresh.code).toMatch(/^TC-[A-HJ-NP-Z2-9]{6}$/)
  expect(fresh.secret).toMatch(/^[0-9a-f]{64}$/)
  expect(fresh).toMatchObject({ onlineId: 'Kratos', minutes: config.auth.verificationMinutes })
  expect(save.mock.calls[0][0]).toMatchObject({
    psn_account_id: 'acc-1',
    code: fresh.code,
    secret_hash: sha(fresh.secret),
  })

  save.mockClear()
  spyOn(sessions, 'getVerification').mockResolvedValue({
    psn_online_id: 'Kratos',
    psn_account_id: 'acc-1',
    avatar_url: null,
    code: 'TC-ABCDEF',
    secret_hash: sha('mine'),
    expires_at: new Date(Date.now() + 10 * 60_000 - 1000).toISOString(),
  })
  // Asking again from the same browser: same code, and the time left, not a fresh expiry.
  expect(await startClaim('Kratos', 'mine')).toMatchObject({
    code: 'TC-ABCDEF',
    secret: 'mine',
    minutes: 10,
  })
  expect(save).not.toHaveBeenCalled()
})

test('nobody else can replace a pending claim, with or without a cookie', async () => {
  const save = spyOn(sessions, 'saveVerification')
  spyOn(sessions, 'getVerification').mockResolvedValue({
    psn_online_id: 'Kratos',
    psn_account_id: 'acc-1',
    avatar_url: null,
    code: 'TC-ABCDEF',
    secret_hash: sha('mine'),
    expires_at: '',
  })
  for (const secret of [undefined, '', 'someone-else'])
    expect(code(await startClaim('Kratos', secret).catch((e) => e))).toBe('claim_pending')
  expect(save).not.toHaveBeenCalled()
})

test('a claim started by someone else between the read and the write is not replaced', async () => {
  spyOn(sessions, 'saveVerification').mockResolvedValue(false)
  expect(code(await startClaim('Kratos').catch((e) => e))).toBe('claim_pending')
})

test('once a claim expires, anyone can start a new one', async () => {
  // getVerification only returns live claims: an expired one reads as none.
  const save = spyOn(sessions, 'saveVerification')
  const next = await startClaim('Kratos', 'mine')
  expect(next.secret).not.toBe('mine')
  expect(save).toHaveBeenCalled()
})

test('a claim of an unknown PSN id fails', async () => {
  spyOn(psn, 'lookupProfile').mockResolvedValue(null)
  expect(code(await startClaim('nobody').catch((e) => e))).toBe('psn_not_found')
})

const pending = {
  psn_online_id: 'Kratos',
  psn_account_id: 'acc-claim',
  avatar_url: 'avatar.png',
  code: 'TC-ABCDEF',
  secret_hash: sha('claim-secret'),
  expires_at: '',
}

test('only whoever started a claim can finish it, even with the code on the profile', async () => {
  spyOn(sessions, 'getVerification').mockResolvedValue(pending)
  spyOn(psn, 'aboutMe').mockResolvedValue('TC-ABCDEF')
  for (const secret of [undefined, '', 'someone-else'])
    expect(code(await finishClaim('Kratos', 'long enough', false, secret).catch((e) => e))).toBe(
      'no_pending_verification',
    )
  expect(updateUser).not.toHaveBeenCalled()
  expect(createUser).not.toHaveBeenCalled()
})

test('finishing a claim needs a pending code found in "About me"', async () => {
  expect(
    code(await finishClaim('Kratos', 'long enough', false, 'claim-secret').catch((e) => e)),
  ).toBe('no_pending_verification')
  spyOn(sessions, 'getVerification').mockResolvedValue(pending)
  spyOn(psn, 'aboutMe').mockResolvedValueOnce(null)
  expect(
    code(await finishClaim('Kratos', 'long enough', false, 'claim-secret').catch((e) => e)),
  ).toBe('profile_private')
  spyOn(psn, 'aboutMe').mockResolvedValueOnce('nothing here')
  expect(
    code(await finishClaim('Kratos', 'long enough', false, 'claim-secret').catch((e) => e)),
  ).toBe('code_not_found')
})

test('a claimed account nobody had is created', async () => {
  spyOn(sessions, 'getVerification').mockResolvedValue(pending)
  spyOn(psn, 'aboutMe').mockResolvedValue('meu código: tc-abcdef')
  const created = makeUser({ id: 'user:claimed' })
  spyOn(users, 'userByAccount').mockResolvedValueOnce(undefined).mockResolvedValueOnce(created)
  const { user } = await finishClaim('Kratos', 'long enough', false, 'claim-secret')
  expect(user).toBe(created)
  expect(createUser).toHaveBeenCalled()
  expect(sessions.deleteVerification).toHaveBeenCalledWith('Kratos')
})

test('a claimed account drops its sessions and Telegram, and its data on a clean start', async () => {
  config.auth.skipVerification = true
  spyOn(sessions, 'getVerification').mockResolvedValue(pending)
  const existing = makeUser({ id: 'user:old' })
  spyOn(users, 'userByAccount').mockResolvedValue(existing)
  await finishClaim('Kratos', 'long enough', true, 'claim-secret')
  expect(psn.aboutMe).not.toHaveBeenCalled()
  expect(sessions.deleteSessionsOf).toHaveBeenCalledWith('user:old')
  // Assistants the old owner connected lose their access too.
  expect(oauth.deleteConnectionsOf).toHaveBeenCalledWith('user:old')
  expect(users.wipeUserData).toHaveBeenCalledWith('user:old')
  expect(updateUser).toHaveBeenCalledWith('user:old', {
    password_hash: 'hash:long enough',
    psn_online_id: 'Kratos',
    avatar_url: 'avatar.png',
    telegram_link_code: null,
    telegram_chat_id: null,
  })
})

test('a claim without a clean start keeps the data', async () => {
  config.auth.skipVerification = true
  spyOn(sessions, 'getVerification').mockResolvedValue(pending)
  spyOn(users, 'userByAccount').mockResolvedValue(makeUser())
  await finishClaim('Kratos', 'long enough', false, 'claim-secret')
  expect(users.wipeUserData).not.toHaveBeenCalled()
})

test('the session cookie expires with the session, or right away on logout', () => {
  expect(sessionCookie('tok')).toBe(
    `platjourney_session=tok; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.auth.sessionDays * 86_400}`,
  )
  expect(sessionCookie(null)).toBe(
    'platjourney_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  )
})

test('a secure instance marks the cookie Secure', () => {
  const saved = config.auth.secureCookie
  config.auth.secureCookie = true
  try {
    expect(sessionCookie(null)).toContain('; Secure;')
  } finally {
    config.auth.secureCookie = saved
  }
})

test('a valid session cookie authenticates its user', async () => {
  const me = makeUser()
  spyOn(sessions, 'sessionUser').mockResolvedValue(me.id)
  spyOn(users, 'getUser').mockResolvedValue(me)
  expect(await authenticate(withCookie(`theme=dark; platjourney_session=${TOKEN}`))).toBe(me)
  expect(sessions.sessionUser).toHaveBeenCalledWith(sha(TOKEN))
  expect(users.touchUser).toHaveBeenCalledWith(me.id)
})

test('missing, malformed or unknown cookies authenticate nobody', async () => {
  expect(await authenticate(withCookie())).toBeUndefined()
  expect(await authenticate(withCookie('platjourney_session='))).toBeUndefined()
  expect(await authenticate(withCookie('platjourney_session=nope'))).toBeUndefined()
  expect(await authenticate(withCookie(`platjourney_session=${TOKEN}`))).toBeUndefined()
  spyOn(sessions, 'sessionUser').mockResolvedValue('user:gone')
  expect(await authenticate(withCookie(`platjourney_session=${TOKEN}`))).toBeUndefined()
  expect(users.touchUser).not.toHaveBeenCalled()
})

test('logout deletes the session of the cookie, if any', async () => {
  await logout(withCookie())
  expect(sessions.deleteSession).not.toHaveBeenCalled()
  await logout(withCookie(`platjourney_session=${TOKEN}`))
  expect(sessions.deleteSession).toHaveBeenCalledWith(sha(TOKEN))
})

test('changing the password keeps only the current session', async () => {
  const me = makeUser({ password_hash: 'hash:old-password' })
  await changePassword(
    withCookie(`platjourney_session=${TOKEN}`),
    me,
    'old-password',
    'new-password',
  )
  expect(updateUser).toHaveBeenCalledWith(me.id, { password_hash: 'hash:new-password' })
  expect(sessions.deleteSessionsExcept).toHaveBeenCalledWith(me.id, sha(TOKEN))
})

test('changing the password needs the current one', async () => {
  const me = makeUser({ password_hash: 'hash:old-password' })
  const error = await changePassword(withCookie(), me, 'wrong', 'new-password').catch((e) => e)
  expect(code(error)).toBe('wrong_password')
  const none = await changePassword(withCookie(), makeUser(), 'x', 'new-password').catch((e) => e)
  expect(code(none)).toBe('wrong_password')
  expect(updateUser).not.toHaveBeenCalled()
})

test('deleting the account needs the PSN id typed back', async () => {
  const me = makeUser()
  expect(code(await deleteAccount(me, 'Atreus').catch((e) => e))).toBe('confirmation_mismatch')
  await deleteAccount(me, ' kratos ')
  expect(users.wipeUserData).toHaveBeenCalledWith(me.id)
  expect(accesses.deleteAccesses).toHaveBeenCalledWith(me.id)
  expect(pushSubs.deletePushSubscriptions).toHaveBeenCalledWith(me.id)
  expect(calls.detachCalls).toHaveBeenCalledWith(me.id)
  expect(sessions.deleteVerification).toHaveBeenCalledWith('Kratos')
  expect(sessions.deleteSessionsOf).toHaveBeenCalledWith(me.id)
  expect(oauth.deleteConnectionsOf).toHaveBeenCalledWith(me.id)
  expect(users.deleteUser).toHaveBeenCalledWith(me.id)
})

test('link codes are url-safe and unique', () => {
  const a = newLinkCode()
  expect(a).toMatch(/^[A-Za-z0-9_-]{12}$/)
  expect(newLinkCode()).not.toBe(a)
})
