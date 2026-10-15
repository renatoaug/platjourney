import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import {
  createSession,
  deleteSession,
  deleteSessionsExcept,
  deleteSessionsOf,
  deleteVerification,
  getVerification,
  pruneExpired,
  saveVerification,
  sessionUser,
} from '../../src/repository/auth.ts'

const user = new db.RecordId('user', 'u1')

afterEach(() => mock.restore())

test('a verification is upserted by the lowercased online id with its ttl, only over an expired one', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([{ code: 'ABC' }])
  const saved = await saveVerification({
    psn_online_id: 'Player',
    psn_account_id: 'acc',
    avatar_url: null,
    code: 'ABC',
    secret_hash: 'h',
    minutes: 30,
  })
  expect(saved).toBe(true)
  const [sql, vars] = q.mock.calls[0]
  expect(sql).toContain('UPSERT verification')
  expect(sql).toContain('WHERE psn_online_id_lower = $lower AND expires_at <= time::now()')
  expect(vars).toEqual({
    lower: 'player',
    id: 'Player',
    account: 'acc',
    avatar: undefined,
    code: 'ABC',
    secret: 'h',
    ttl: '30m',
  })
})

test('a verification is not saved over a pending one', async () => {
  const v = {
    psn_online_id: 'Player',
    psn_account_id: 'acc',
    avatar_url: null,
    code: 'ABC',
    secret_hash: 'h',
    minutes: 30,
  }
  spyOn(db, 'q').mockResolvedValueOnce([])
  expect(await saveVerification(v)).toBe(false)
  spyOn(db, 'q').mockRejectedValueOnce(
    new Error("Database index `verification_online_id` already contains 'player'"),
  )
  expect(await saveVerification(v)).toBe(false)
  spyOn(db, 'q').mockRejectedValueOnce(new Error('boom'))
  await expect(saveVerification(v)).rejects.toThrow('boom')
})

test('a pending verification is looked up case-insensitively', async () => {
  const one = spyOn(db, 'one').mockResolvedValue({ code: 'ABC' })
  expect(await getVerification('PLAYER')).toEqual({ code: 'ABC' } as never)
  expect(one.mock.calls[0][0]).toContain('expires_at > time::now()')
  expect(one.mock.calls[0][1]).toEqual({ lower: 'player' })
})

test('a verification is deleted by the lowercased online id', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await deleteVerification('Player')
  expect(q.mock.calls[0]).toEqual([
    'DELETE verification WHERE psn_online_id_lower = $lower',
    { lower: 'player' },
  ])
})

test('a session is created for the user with its lifetime in days', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await createSession('user:u1', 'hash', 30)
  expect(q.mock.calls[0][0]).toContain('CREATE auth_session')
  expect(q.mock.calls[0][1]).toEqual({ user, hash: 'hash', ttl: '30d' })
})

test('a live session resolves to its user id', async () => {
  const one = spyOn(db, 'one').mockResolvedValueOnce({ user }).mockResolvedValueOnce(undefined)
  expect(await sessionUser('hash')).toBe('user:u1')
  expect(await sessionUser('gone')).toBeUndefined()
  expect(one.mock.calls[0][1]).toEqual({ hash: 'hash' })
})

test('sessions are deleted one, all but one, or all', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await deleteSession('h1')
  await deleteSessionsExcept('user:u1', 'keep')
  await deleteSessionsOf('user:u1')
  expect(q.mock.calls).toEqual([
    ['DELETE auth_session WHERE token_hash = $hash', { hash: 'h1' }],
    ['DELETE auth_session WHERE user = $user AND token_hash != $keep', { user, keep: 'keep' }],
    ['DELETE auth_session WHERE user = $user', { user }],
  ])
})

test('expired sessions and claim codes are pruned', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await pruneExpired()
  const [sql] = q.mock.calls[0]
  expect(sql).toContain('DELETE auth_session WHERE expires_at < time::now()')
  expect(sql).toContain('DELETE verification WHERE expires_at < time::now()')
})
