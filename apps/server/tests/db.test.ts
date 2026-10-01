import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { readdirSync } from 'node:fs'
import { Surreal } from 'surrealdb'
import { config } from '../src/config.ts'
import {
  camelKeys,
  closeDb,
  db,
  gameId,
  migrate,
  one,
  plain,
  q,
  RecordId,
  reset,
  rid,
  snakeKeys,
} from '../src/db.ts'

let connect: ReturnType<typeof spyOn>
let query: ReturnType<typeof spyOn>
let use: ReturnType<typeof spyOn>

beforeEach(() => {
  connect = spyOn(Surreal.prototype, 'connect').mockResolvedValue(true as never)
  query = spyOn(Surreal.prototype, 'query').mockResolvedValue([] as never)
  use = spyOn(Surreal.prototype, 'use').mockResolvedValue({} as never)
  spyOn(Surreal.prototype, 'close').mockResolvedValue(true as never)
})

afterEach(async () => {
  await closeDb()
  mock.restore()
})

test('concurrent callers share one connection', async () => {
  const [a, b] = await Promise.all([db(), db()])
  expect(a).toBe(b)
  expect(await db()).toBe(a)
  expect(connect).toHaveBeenCalledTimes(1)
  const [url, options] = connect.mock.calls[0] as [string, { authentication: () => unknown }]
  expect(url).toBe(config.surreal.url)
  expect(options.authentication()).toEqual({
    username: config.surreal.user,
    password: config.surreal.pass,
  })
  expect(String(query.mock.calls[0][0])).toContain('DEFINE NAMESPACE IF NOT EXISTS')
  expect(use).toHaveBeenCalledWith({
    namespace: config.surreal.namespace,
    database: config.surreal.database,
  })
})

test('a query answers with its last statement', async () => {
  await db()
  query.mockResolvedValue([[1], [2, 3]] as never)
  expect(await q<number[]>('SELECT 1; SELECT 2', { a: 1 })).toEqual([2, 3])
  expect(query).toHaveBeenLastCalledWith('SELECT 1; SELECT 2', { a: 1 })
})

test('a write conflict is retried once', async () => {
  await db()
  query.mockRejectedValueOnce(new Error('Transaction conflict: can be retried'))
  query.mockResolvedValueOnce([['ok']] as never)
  expect(await q<string[]>('UPDATE x')).toEqual(['ok'])
})

test('a lost session reconnects and runs the query again', async () => {
  await db()
  spyOn(console, 'warn').mockImplementation(() => {})
  query.mockRejectedValueOnce(new Error('The token has expired'))
  query.mockResolvedValue([['again']] as never)
  expect(await q<string[]>('SELECT 1')).toEqual(['again'])
  expect(connect).toHaveBeenCalledTimes(2)
})

test('any other error reaches the caller', async () => {
  await db()
  query.mockRejectedValueOnce(new Error('Parse error'))
  await expect(q('SELEC')).rejects.toThrow('Parse error')
})

test('one returns the first row, or the value itself', async () => {
  await db()
  query.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }]] as never)
  expect(await one<{ id: number }>('SELECT')).toEqual({ id: 1 })
  query.mockResolvedValueOnce([{ id: 3 }] as never)
  expect(await one<{ id: number }>('CREATE')).toEqual({ id: 3 })
})

test('migrate runs every migration file in order', async () => {
  const files = await migrate()
  const expected = readdirSync(new URL('../../../db/migrations/', import.meta.url))
    .filter((f) => f.endsWith('.surql'))
    .sort()
  expect(files).toEqual(expected)
  expect(query).toHaveBeenCalledTimes(1 + files.length)
})

test('reset drops and recreates the database', async () => {
  await reset()
  const sql = query.mock.calls.slice(1).map((c: unknown[]) => String(c[0]))
  expect(sql).toEqual([
    `REMOVE DATABASE IF EXISTS ${config.surreal.database};`,
    `DEFINE DATABASE IF NOT EXISTS ${config.surreal.database};`,
  ])
  expect(use).toHaveBeenCalledTimes(2)
})

test('numeric ids become numbers so they match the seed', () => {
  expect(rid('user', '42').id).toBe(42)
  expect(rid('user', 'abc').id).toBe('abc')
  expect(gameId(7)).toEqual(new RecordId('game', 7))
})

test('plain turns record ids into strings and bigints into numbers', () => {
  const row = { id: new RecordId('game', 3048), other: new RecordId('user', 'abc'), n: 5n }
  expect(plain(row)).toEqual({ id: 'game:3048', other: 'user:abc', n: 5 } as never)
  expect(plain(null)).toBeNull()
  expect(plain(undefined)).toBeUndefined()
})

test('stored objects swap camelCase and snake_case keys at any depth', () => {
  const when = new Date('2026-10-02T00:00:00Z')
  const id = new RecordId('game', 1)
  const app = {
    hasMissables: true,
    earlyTips: ['keep camelCase values', 'and snake_case ones'],
    hardest: { trophyName: 'x' },
    steps: [{ trophyId: 3, at: when, game: id }],
    2026: 4,
  }
  const stored = {
    has_missables: true,
    early_tips: ['keep camelCase values', 'and snake_case ones'],
    hardest: { trophy_name: 'x' },
    steps: [{ trophy_id: 3, at: when, game: id }],
    2026: 4,
  }
  expect(snakeKeys(app) as unknown).toEqual(stored)
  expect(camelKeys(stored) as unknown).toEqual(app)
  expect(snakeKeys(null)).toBeNull()
  expect(camelKeys('plain_text')).toBe('plain_text')
})
