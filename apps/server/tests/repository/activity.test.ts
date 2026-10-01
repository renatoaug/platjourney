import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import {
  appendMessage,
  logTip,
  markNotificationsRead,
  notificationsPage,
  recentMessages,
  recentNotifications,
  recentTips,
  serverWarnedGames,
  unreadNotifications,
} from '../../src/repository/activity.ts'

const user = new db.RecordId('user', 'u1')
const game = new db.RecordId('game', 7)

afterEach(() => mock.restore())

test('a tip is created with its user and game, and becomes a notification unless it is chat', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await logTip('user:u1', 'unlock', 'Boa!', 'game:7')
  const [sql, vars] = q.mock.calls[0]
  expect(sql).toContain('CREATE ONLY tip CONTENT $data')
  expect(sql).toContain("IF $tip.kind != 'chat'")
  expect(vars).toEqual({ data: { user, kind: 'unlock', content: 'Boa!', game } })
})

test('a tip without a game leaves the game out', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await logTip('u1', 'chat', 'Oi')
  expect(q.mock.calls[0][1]).toEqual({ data: { user, kind: 'chat', content: 'Oi' } })
})

test('recent tips come newest first with record ids as plain strings', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([
    { id: new db.RecordId('tip', 'a'), game: { id: game, name: 'X' } },
  ])
  const tips = await recentTips('user:u1')
  expect(q.mock.calls[0]).toEqual([
    'SELECT *, game.* AS game FROM tip WHERE user = $user ORDER BY created_at DESC LIMIT $limit',
    { user, limit: 30 },
  ])
  expect(tips).toEqual([{ id: 'tip:a', game: { id: 'game:7', name: 'X' } }] as never)
})

test('recent notifications take the limit asked', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([])
  expect(await recentNotifications('user:u1', 3)).toEqual([])
  expect(q.mock.calls[0][0]).toContain('FROM notification WHERE user = $user')
  expect(q.mock.calls[0][1]).toEqual({ user, limit: 3 })
})

test('a notifications page reads its slice and the totals', async () => {
  const q = spyOn(db, 'q').mockImplementation((async (sql: string) =>
    sql.includes('count()')
      ? [{ total: 12, unread: 4 }]
      : [{ id: new db.RecordId('notification', 'n1') }]) as never)
  const page = await notificationsPage('user:u1', 3, 5)
  expect(page).toEqual({ items: [{ id: 'notification:n1' }] as never, total: 12, unread: 4 })
  expect(q.mock.calls[0][0]).toContain('LIMIT $size START $start')
  expect(q.mock.calls[0][1]).toEqual({ user, size: 5, start: 10 })
  expect(q.mock.calls[1][0]).toContain('GROUP ALL')
})

test('an empty notifications page counts zero', async () => {
  spyOn(db, 'q').mockResolvedValue([])
  expect(await notificationsPage('user:u1', 1, 5)).toEqual({ items: [], total: 0, unread: 0 })
})

test('unread notifications are counted, zero when there are none', async () => {
  const q = spyOn(db, 'q')
    .mockResolvedValueOnce([{ n: 2 }])
    .mockResolvedValueOnce([])
  expect(await unreadNotifications('user:u1')).toBe(2)
  expect(await unreadNotifications('user:u1')).toBe(0)
  expect(q.mock.calls[0][0]).toContain('read_at = NONE')
})

test('marking notifications read touches only the unread ones', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await markNotificationsRead('user:u1')
  expect(q.mock.calls[0]).toEqual([
    'UPDATE notification SET read_at = time::now() WHERE user = $user AND read_at = NONE',
    { user },
  ])
})

test('server warnings already sent come back as a set of game ids', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([game, new db.RecordId('game', 9)])
  const games = await serverWarnedGames('user:u1')
  expect([...games]).toEqual(['game:7', 'game:9'])
  expect(q.mock.calls[0][0]).toContain("kind = 'server'")
})

test('a chat message is stored with its role and optional game', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await appendMessage('user:u1', 'user', 'Oi', 'game:7')
  await appendMessage('user:u1', 'assistant', 'Olá')
  expect(q.mock.calls[0]).toEqual([
    'CREATE message SET user = $user, role = $role, content = $content, game = $game',
    { user, role: 'user', content: 'Oi', game },
  ])
  expect(q.mock.calls[1][1]).toEqual({ user, role: 'assistant', content: 'Olá', game: undefined })
})

test('recent messages come back oldest first', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([{ content: 'b' }, { content: 'a' }])
  expect(await recentMessages('user:u1', 2)).toEqual([{ content: 'a' }, { content: 'b' }] as never)
  expect(q.mock.calls[0][1]).toEqual({ user, limit: 2 })
})
