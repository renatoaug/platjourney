import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import {
  connectionsOf,
  createClient,
  createToken,
  deleteConnection,
  deleteConnectionsOf,
  getClient,
  pruneOauth,
  replaceConnections,
  revokeToken,
  rotateToken,
  saveCode,
  takeCode,
  tokenOwner,
} from '../../src/repository/oauth.ts'

const user = new db.RecordId('user', 'u1')
const hashes = { access_hash: 'a', refresh_hash: 'r', access_minutes: 60, refresh_days: 30 }

afterEach(() => mock.restore())

test('a client is created and found by its client id', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([
    { id: 'oauth_client:1', client_id: 'c', name: 'Claude', redirect_uris: [] },
  ])
  await createClient({ client_id: 'c', name: 'Claude', redirect_uris: ['https://x'] })
  expect(q.mock.calls[0][1]).toEqual({
    c: { client_id: 'c', name: 'Claude', redirect_uris: ['https://x'] },
  })
  expect((await getClient('c'))?.name).toBe('Claude')
  expect(q.mock.calls[1][1]).toEqual({ id: 'c' })
})

test('a code lives ten minutes and is deleted as it is read', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await saveCode({
    code_hash: 'h',
    client: 'oauth_client:1',
    user: 'user:u1',
    redirect_uri: 'https://x',
    challenge: 'c',
    minutes: 10,
  })
  expect(q.mock.calls[0][1]).toMatchObject({ hash: 'h', user, ttl: '10m' })
  const future = new Date(Date.now() + 60_000).toISOString()
  q.mockResolvedValue([
    {
      client: 'oauth_client:1',
      user: 'user:u1',
      redirect_uri: 'https://x',
      challenge: 'c',
      expires_at: future,
    },
  ])
  expect(await takeCode('h')).toMatchObject({ user: 'user:u1' })
  expect(q.mock.calls[1][0]).toContain('DELETE oauth_code WHERE code_hash = $hash RETURN BEFORE')
  q.mockResolvedValue([{ expires_at: '2020-01-01T00:00:00Z' }])
  expect(await takeCode('h')).toBeUndefined()
  q.mockResolvedValue([])
  expect(await takeCode('h')).toBeUndefined()
})

test('tokens are created, rotated only while the refresh token lives, and read back by hash', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await createToken('oauth_client:1', 'user:u1', hashes)
  expect(q.mock.calls[0][1]).toMatchObject({
    user,
    access_hash: 'a',
    refresh_hash: 'r',
    attl: '60m',
    rttl: '30d',
  })
  q.mockResolvedValue([{}])
  expect(await rotateToken('old', 'oauth_client:1', hashes)).toBe(true)
  expect(q.mock.calls[1][0]).toContain('refresh_expires_at > time::now()')
  q.mockResolvedValue([])
  expect(await rotateToken('old', 'oauth_client:1', hashes)).toBe(false)
  q.mockResolvedValue([{ id: 'oauth_token:1', user: 'user:u1' }])
  expect(await tokenOwner('a')).toEqual({ id: 'oauth_token:1', user: 'user:u1' })
  expect(q.mock.calls[3][0]).toContain('access_expires_at > time::now()')
})

test('a player lists, ends one or all of their connections', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([
    { id: 'oauth_token:1', name: 'Claude', created_at: 'x', used_at: undefined },
  ])
  expect(await connectionsOf('user:u1')).toEqual([
    { id: 'oauth_token:1', name: 'Claude', created_at: 'x', used_at: null },
  ])
  expect(q.mock.calls[0][1]).toEqual({ user })
  q.mockResolvedValue([{}])
  expect(await deleteConnection('user:u1', 'oauth_token:1')).toBe(true)
  expect(q.mock.calls[1][1]).toEqual({ id: 'oauth_token:1', user })
  q.mockResolvedValue([])
  expect(await deleteConnection('user:u1', 'oauth_token:2')).toBe(false)
  await deleteConnectionsOf('user:u1')
  expect(q.mock.calls[3][0]).toContain('DELETE oauth_token WHERE user = $user')
  await pruneOauth()
  expect(q.mock.calls[4][0]).toContain('refresh_expires_at < time::now()')
})

test('a token revoked by its client, and the same assistant connected again, end their rows', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  q.mockResolvedValue([{}])
  expect(await revokeToken('h')).toBe(true)
  expect(q.mock.calls[0][0]).toContain('access_hash = $hash OR refresh_hash = $hash')
  expect(q.mock.calls[0][1]).toEqual({ hash: 'h' })
  q.mockResolvedValue([])
  expect(await revokeToken('h')).toBe(false)
  q.mockResolvedValue(undefined)
  await replaceConnections('user:u1', 'Claude')
  expect(q.mock.calls[2]).toEqual([
    'DELETE oauth_token WHERE user = $user AND client.name = $name',
    { user, name: 'Claude' },
  ])
})
