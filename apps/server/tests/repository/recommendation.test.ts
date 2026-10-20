import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import {
  assistantPicks,
  dismiss,
  dropAssistantPick,
  lastRecommended,
  listDismissed,
  listPicks,
  listRecommendations,
  recentPickGames,
  saveAssistantPick,
  savePick,
  saveRecommendations,
  seenGames,
} from '../../src/repository/recommendation.ts'
import * as storePrice from '../../src/repository/store-price.ts'

const user = new db.RecordId('user', 'u1')
const game = new db.RecordId('game', 7)

afterEach(() => mock.restore())

test('recommendations are the latest batch, without dismissed games', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([{ game: { id: game }, why: 'x' }])
  expect(await listRecommendations('user:u1')).toEqual([
    { game: { id: 'game:7' }, why: 'x' },
  ] as never)
  expect(q.mock.calls[0][0]).toContain('game NOT IN (SELECT VALUE game FROM dismissal')
  expect(q.mock.calls[0][0]).toContain('LET $last = array::max(SELECT VALUE batch_at')
  expect(q.mock.calls[0][0]).toContain('AND batch_at = $last')
  // The picks asked for one at a time are no batch.
  expect(q.mock.calls[0][0].match(/source != 'pick'/g)).toHaveLength(2)
  expect(q.mock.calls[0][1]).toEqual({ user })
})

test('a new batch keeps the old ones and stamps each row with the same batch time', async () => {
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
  await saveRecommendations('user:u1', [row, { ...row, game: 'game:8' }])
  expect(q.mock.calls).toHaveLength(2)
  const [first, second] = q.mock.calls.map((c) => (c[1] as { data: Record<string, unknown> }).data)
  expect(q.mock.calls[0][0]).toBe('CREATE recommendation CONTENT $data')
  expect(first).toEqual({ ...row, user, game, batch_at: expect.any(Date), source: 'discover' })
  expect(second.batch_at).toBe(first.batch_at)
})

test('seen games drop old batches and come back the one shown longest ago first', async () => {
  const q = spyOn(db, 'q')
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce([
      { game: new db.RecordId('game', 1), at: '2026-09-01T00:00:00Z' },
      { game, at: '2026-08-01T00:00:00Z' },
      { game: new db.RecordId('game', 1), at: '2026-10-01T00:00:00Z' },
    ])
  expect(await seenGames('user:u1', 365)).toEqual(['game:7', 'game:1'])
  expect(q.mock.calls[0][0]).toContain('DELETE recommendation WHERE user = $user AND created_at <')
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

test('a pick is kept as a recommendation of source pick, read back with its game', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([{ id: 'recommendation:1', game: { id: game } }])
  const pick = { game: 'game:7', why: 'w', first_step: 'f', scope: 'any' as const, fits: true }
  expect(await savePick('user:u1', pick)).toEqual({
    id: 'recommendation:1',
    game: { id: 'game:7' },
  } as never)
  expect(q.mock.calls[0][0]).toBe('CREATE recommendation CONTENT $data RETURN *, game.* AS game')
  expect(q.mock.calls[0][1]).toEqual({
    data: { ...pick, user, game, source: 'pick', similar_to: [] },
  })
})

test('the picks, the latest first, and the games picked lately in one scope', async () => {
  const q = spyOn(db, 'q').mockResolvedValueOnce([]).mockResolvedValueOnce([game, game])
  expect(await listPicks('user:u1')).toEqual([])
  expect(q.mock.calls[0][0]).toContain("source = 'pick' AND recommender = 'Nexo'")
  expect(q.mock.calls[0][0]).toContain('ORDER BY created_at DESC LIMIT $limit')
  expect(q.mock.calls[0][1]).toEqual({ user, limit: 30 })
  expect(await recentPickGames('user:u1', 'interests', 24)).toEqual(['game:7'])
  expect(q.mock.calls[1][1]).toEqual({ user, scope: 'interests', since: '24h' })
})

test('the latest time a game was recommended, in a batch or as a pick', async () => {
  const q = spyOn(db, 'q')
    .mockResolvedValueOnce([{ at: '2026-10-10T00:00:00Z', why: 'w' }])
    .mockResolvedValueOnce([{ at: '2026-10-11T00:00:00Z', source: 'pick', why: 'p' }])
    .mockResolvedValueOnce([])
  expect(await lastRecommended('user:u1', 'game:7', 30)).toEqual({
    at: '2026-10-10T00:00:00Z',
    source: 'discover',
    why: 'w',
  })
  expect(q.mock.calls[0][1]).toEqual({ user, game, since: '30d' })
  // A game an assistant suggested is not Nexo's.
  expect(q.mock.calls[0][0]).toContain("recommender = 'Nexo'")
  expect((await lastRecommended('user:u1', 'game:7', 30))?.source).toBe('pick')
  expect(await lastRecommended('user:u1', 'game:7', 30)).toBeNull()
})

test('the PS Plus catalog is the games the store put in those tiers', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([game])
  expect(await storePrice.plusCatalog(['essential', 'extra'])).toEqual(['game:7'])
  expect(q.mock.calls[0][1]).toEqual({ tiers: ['essential', 'extra'], region: 'BR' })
  expect(await storePrice.plusCatalog([])).toEqual([])
  expect(q).toHaveBeenCalledTimes(1)
})

test("an assistant's suggestion replaces its last one for the game, with the new reason", async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await saveAssistantPick('user:u1', 'game:7', 'Short and fun.', 'Claude')
  const [sql, vars] = q.mock.calls[0]
  expect(sql).toContain("AND source = 'pick'\n       AND recommender != 'Nexo'")
  expect(sql).toContain("source: 'pick', why: $why,\n       recommender: $assistant")
  expect(vars).toEqual({ user, game, why: 'Short and fun.', assistant: 'Claude' })
})

test('the suggestions shown leave out old ones, saved games and dismissed ones', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([
    { id: new db.RecordId('recommendation', 'a'), game: { id: game, name: 'X' }, why: 'r' },
  ])
  const picks = await assistantPicks('user:u1', 2026)
  const [sql, vars] = q.mock.calls[0]
  expect(sql).toContain("source = 'pick' AND recommender != 'Nexo'")
  expect(sql).toContain('created_at > time::now() - 30d')
  expect(sql).toContain('game NOTINSIDE $saved AND game NOTINSIDE $dismissed')
  expect(vars).toEqual({ user, year: 2026 })
  expect(picks[0]).toMatchObject({ id: 'recommendation:a', game: { id: 'game:7' } })
  await dropAssistantPick('user:u1', 'game:7')
  expect(q.mock.calls[1]).toEqual([
    "DELETE recommendation WHERE user = $user AND game = $game AND source = 'pick' AND recommender != 'Nexo'",
    { user, game },
  ])
})
