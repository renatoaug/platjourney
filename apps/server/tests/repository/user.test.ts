import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import {
  createUser,
  deleteUser,
  getUser,
  linkChat,
  listUsers,
  setLinkCode,
  touchUser,
  updateUser,
  userByAccount,
  userByChat,
  userByLinkCode,
  userRef,
  wipeUserData,
} from '../../src/repository/user.ts'

const user = new db.RecordId('user', 'u1')

afterEach(() => mock.restore())

test('user ids work with or without the table prefix', () => {
  expect(userRef('user:u1')).toEqual(user)
  expect(userRef('u1')).toEqual(user)
})

test('a user is read by id with record ids as strings', async () => {
  const one = spyOn(db, 'one').mockResolvedValue({ id: user, psn_online_id: 'P' })
  expect(await getUser('user:u1')).toEqual({ id: 'user:u1', psn_online_id: 'P' } as never)
  expect(one.mock.calls[0]).toEqual(['SELECT * FROM $id', { id: user }])
})

test('users are listed oldest first', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([{ id: user }])
  expect(await listUsers()).toEqual([{ id: 'user:u1' }] as never)
  expect(q.mock.calls[0][0]).toBe('SELECT * FROM user ORDER BY created_at')
})

test('a user is found by account, chat or link code', async () => {
  const one = spyOn(db, 'one').mockResolvedValue(undefined)
  expect(await userByAccount('acc')).toBeUndefined()
  await userByChat('42')
  await userByLinkCode('CODE')
  expect(one.mock.calls).toEqual([
    ['SELECT * FROM user WHERE psn_account_id = $a LIMIT 1', { a: 'acc' }],
    ['SELECT * FROM user WHERE telegram_chat_id = $c LIMIT 1', { c: '42' }],
    [
      'SELECT * FROM user WHERE telegram_link_code = $c AND telegram_link_expires_at > time::now() LIMIT 1',
      { c: 'CODE' },
    ],
  ])
})

test('a new user stores the lowercased id and only the optional fields given', async () => {
  const one = spyOn(db, 'one').mockResolvedValue({ id: user })
  expect(await createUser({ psn_online_id: 'Player', psn_account_id: 'acc' })).toEqual({
    id: 'user:u1',
  } as never)
  await createUser({
    psn_online_id: 'Player',
    psn_account_id: 'acc',
    password_hash: 'h',
    avatar_url: 'a.png',
  })
  expect(one.mock.calls[0]).toEqual([
    'CREATE user CONTENT $data RETURN AFTER',
    { data: { psn_online_id: 'Player', psn_online_id_lower: 'player', psn_account_id: 'acc' } },
  ])
  expect(one.mock.calls[1][1]).toEqual({
    data: {
      psn_online_id: 'Player',
      psn_online_id_lower: 'player',
      psn_account_id: 'acc',
      password_hash: 'h',
      avatar_url: 'a.png',
    },
  })
})

test('updating sets values, clears nulls and ignores unsafe keys', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await updateUser('user:u1', {
    telegram_chat_id: '42',
    session_plan: null,
    ['bad key' as 'telegram_link_code']: 'x',
  })
  expect(q.mock.calls[0]).toEqual([
    'UPDATE $id SET telegram_chat_id = $telegram_chat_id, session_plan = NONE',
    { id: user, telegram_chat_id: '42' },
  ])
})

test('an update with nothing to set sends no query', async () => {
  const q = spyOn(db, 'q')
  await updateUser('user:u1', {})
  expect(q).not.toHaveBeenCalled()
})

test('touching a user records when it was last seen', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await touchUser('user:u1')
  expect(q.mock.calls[0]).toEqual(['UPDATE $id SET last_seen_at = time::now()', { id: user }])
})

test('wiping deletes every personal table and resets the profile fields', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await wipeUserData('user:u1')
  const sqls = q.mock.calls.map(([sql]) => sql)
  expect(sqls.slice(0, 8)).toEqual(
    [
      'title',
      'interest',
      'platinum',
      'recommendation',
      'dismissal',
      'tip',
      'message',
      'playtime',
    ].map((t) => `DELETE ${t} WHERE user = $user`),
  )
  expect(sqls[8]).toContain('goal_targets = {}')
  expect(q.mock.calls.map(([, vars]) => vars)).toEqual(Array(9).fill({ user }))
})

test('deleting a user removes its record', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await deleteUser('user:u1')
  expect(q.mock.calls[0]).toEqual(['DELETE $user', { user }])
})

test('objects kept on the user are stored in snake_case and read in camelCase', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await updateUser('user:u1', { session_plan: { totalMinutes: 60, ifTimeLeft: null } })
  expect(q.mock.calls[0][1]).toEqual({
    id: user,
    session_plan: { total_minutes: 60, if_time_left: null },
  })
  spyOn(db, 'one').mockResolvedValue({
    id: 'user:u1',
    session_plan: { total_minutes: 60, if_time_left: null },
    taste_profile: null,
  })
  expect(await getUser('user:u1')).toEqual({
    id: 'user:u1',
    session_plan: { totalMinutes: 60, ifTimeLeft: null },
    taste_profile: null,
  } as never)
})

test('the taste preferences are stored in snake_case and read in camelCase', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await updateUser('user:u1', {
    taste_prefs: { filters: { noMissables: true, maxHours: 40 } },
  })
  expect(q.mock.calls[0][1]).toEqual({
    id: user,
    taste_prefs: { filters: { no_missables: true, max_hours: 40 } },
  })
  spyOn(db, 'one').mockResolvedValue({
    id: 'user:u1',
    taste_prefs: { filters: { no_missables: true, max_hours: 40 } },
  })
  expect((await getUser('user:u1'))?.taste_prefs).toEqual({
    filters: { noMissables: true, maxHours: 40 },
  })
})

test('a Telegram link code is stored with its expiry', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await setLinkCode('user:u1', 'CODE')
  const [sql, vars] = q.mock.calls[0]
  expect(sql).toContain('telegram_link_expires_at = time::now() + <duration> $ttl')
  expect(vars).toMatchObject({ code: 'CODE', ttl: '15m' })
})

test('linking a chat takes it off any other user in the same transaction', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await linkChat('user:u1', '42')
  const [sql, vars] = q.mock.calls[0]
  expect(q).toHaveBeenCalledTimes(1)
  const clear = (sql as string).indexOf(
    'UPDATE user SET telegram_chat_id = NONE WHERE telegram_chat_id = $chat AND id != $id',
  )
  const set = (sql as string).indexOf('UPDATE $id SET telegram_chat_id = $chat')
  expect(sql).toStartWith('BEGIN TRANSACTION;')
  expect(sql).toContain('telegram_link_code = NONE, telegram_link_expires_at = NONE')
  expect(sql).toContain('COMMIT TRANSACTION;')
  expect(clear).toBeGreaterThan(-1)
  expect(set).toBeGreaterThan(clear)
  expect(vars).toEqual({ id: user, chat: '42' })
})

test('a rename moves the lowercase id with it', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await updateUser('user:u1', { psn_online_id: 'NewName' })
  const [sql, vars] = q.mock.calls[0]
  expect(sql).toContain('psn_online_id_lower = $psn_online_id_lower')
  expect(vars).toMatchObject({ psn_online_id: 'NewName', psn_online_id_lower: 'newname' })
})
