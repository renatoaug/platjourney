import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import {
  dismiss,
  listDismissed,
  listRecommendations,
  replaceRecommendations,
  seenGames,
} from '../../src/repository/recommendation.ts'

const user = new db.RecordId('user', 'u1')
const game = new db.RecordId('game', 7)

afterEach(() => mock.restore())

test('recommendations leave out dismissed games', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([{ game: { id: game }, why: 'x' }])
  expect(await listRecommendations('user:u1')).toEqual([
    { game: { id: 'game:7' }, why: 'x' },
  ] as never)
  expect(q.mock.calls[0][0]).toContain('game NOT IN (SELECT VALUE game FROM dismissal')
  expect(q.mock.calls[0][1]).toEqual({ user })
})

test('replacing recommendations deletes the old ones and creates each new one', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  const row = {
    game: 'game:7',
    platform: 'PS5',
    difficulty: 3,
    hours: 20,
    has_missables: false,
    why: 'porque',
    similar_to: ['A'],
  }
  await replaceRecommendations('user:u1', [row])
  expect(q.mock.calls).toEqual([
    ['DELETE recommendation WHERE user = $user', { user }],
    ['CREATE recommendation CONTENT $data', { data: { ...row, user, game } }],
    ['CREATE recommendation_seen CONTENT $data', { data: { user, game } }],
  ])
})

test('seen games drop old marks and come back the one shown longest ago first', async () => {
  const q = spyOn(db, 'q')
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce([
      { game: new db.RecordId('game', 1), at: '2026-09-01T00:00:00Z' },
      { game, at: '2026-08-01T00:00:00Z' },
    ])
    .mockResolvedValueOnce([{ game: new db.RecordId('game', 1), at: '2026-10-01T00:00:00Z' }])
  expect(await seenGames('user:u1', 365)).toEqual(['game:7', 'game:1'])
  expect(q.mock.calls[0][0]).toContain('DELETE recommendation_seen')
  expect(q.mock.calls[0][1]).toEqual({ user, ttl: '365d' })
})

test('dismissing upserts one dismissal per game, with the reason when given', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await dismiss('user:u1', 'game:7')
  expect(q.mock.calls[0][0]).toContain('UPSERT dismissal')
  expect(q.mock.calls[0][1]).toEqual({ user, game, reason: null })
  await dismiss('user:u1', 'game:7', 'too_hard')
  expect(q.mock.calls[1][1]).toEqual({ user, game, reason: 'too_hard' })
})

test('dismissed games come back with their reason', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([{ game: { id: game, name: 'X' }, reason: 'genre' }])
  expect(await listDismissed('user:u1')).toEqual([
    { game: { id: 'game:7', name: 'X' }, reason: 'genre' },
  ] as never)
  expect(q.mock.calls[0]).toEqual([
    'SELECT game.* AS game, reason FROM dismissal WHERE user = $user',
    { user },
  ])
})
