import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import {
  addInterest,
  listInterests,
  removeInterest,
  setInterestOrder,
} from '../../src/repository/interest.ts'

const user = new db.RecordId('user', 'u1')
const game = new db.RecordId('game', 7)
const interest = (id: string) => new db.RecordId('interest', id)

afterEach(() => mock.restore())

test('interests of a year come in their manual order', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([{ id: interest('a'), game: { id: game } }])
  expect(await listInterests('user:u1', 2026)).toEqual([
    { id: 'interest:a', game: { id: 'game:7' } },
  ] as never)
  expect(q.mock.calls[0][0]).toContain('ORDER BY position, created_at')
  expect(q.mock.calls[0][1]).toEqual({ user, year: 2026 })
})

test('a new interest goes above the current top', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await addInterest('user:u1', 'game:7', 2026)
  expect(q.mock.calls[0][0]).toContain('position = $min - 1')
  expect(q.mock.calls[0][1]).toEqual({ user, game, year: 2026 })
})

test('an interest is removed only from its owner', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await removeInterest('user:u1', 'interest:a')
  expect(q.mock.calls[0]).toEqual([
    'DELETE interest WHERE id = $id AND user = $user',
    { id: interest('a'), user },
  ])
})

test('ordering puts the listed interests first and keeps the rest after them', async () => {
  const q = spyOn(db, 'q').mockImplementation((async (sql: string) =>
    sql.startsWith('SELECT')
      ? [{ id: interest('a') }, { id: interest('b') }, { id: interest('c') }]
      : undefined) as never)
  await setInterestOrder('user:u1', 2026, ['interest:c', 'interest:zzz'])
  const updates = q.mock.calls.slice(1).map(([, vars]) => vars)
  expect(updates).toEqual([
    { id: interest('c'), pos: 1 },
    { id: interest('a'), pos: 2 },
    { id: interest('b'), pos: 3 },
  ])
  expect(q.mock.calls[1][0]).toBe('UPDATE $id SET position = $pos')
})
