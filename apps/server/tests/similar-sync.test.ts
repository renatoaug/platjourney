import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../src/db.ts'
import * as igdb from '../src/igdb.ts'
import * as repo from '../src/repository/similar.ts'
import { syncSimilar } from '../src/similar-sync.ts'

afterEach(() => mock.restore())

const games = [
  { id: 'game:1', igdb_id: 10 },
  { id: 'game:2', igdb_id: 20 },
]

function fakeDb(alreadyLinked: string[]) {
  return spyOn(db, 'q').mockImplementation((async (sql: string) => {
    if (sql.startsWith('SELECT id, igdb_id')) return games
    if (sql.startsWith('SELECT VALUE in FROM similar_to')) return alreadyLinked
    return []
  }) as never)
}

test('the nightly run links only the games without links yet, holding updated_at', async () => {
  const q = fakeDb(['game:1'])
  const asked = spyOn(igdb, 'relationsByIds').mockResolvedValue(
    new Map([[20, { similar: [10], parent: null, series: [7] }]]),
  )
  const written = spyOn(repo, 'writeRelations').mockResolvedValue(undefined)
  const c = await syncSimilar(true)
  expect(asked).toHaveBeenCalledWith([20])
  expect(written.mock.calls).toEqual([
    ['game:2', { similar: [{ game: 'game:1', rank: 0 }], base: null, series: [7] }],
  ])
  expect(c).toEqual({ games: 1, linked: 1, similar: 1, expansions: 0, inSeries: 1 })
  const sql = q.mock.calls.map((x) => String(x[0]))
  expect(sql.some((s) => s.includes('DEFAULT time::now()') && !s.includes('VALUE'))).toBe(true)
  expect(sql.at(-1)).toContain('VALUE time::now()')
})

test('the weekly run writes every game again, and nothing new means no IGDB call', async () => {
  fakeDb(['game:1', 'game:2'])
  const asked = spyOn(igdb, 'relationsByIds').mockResolvedValue(new Map())
  spyOn(repo, 'writeRelations').mockResolvedValue(undefined)
  expect((await syncSimilar(true)).games).toBe(0)
  expect(asked).not.toHaveBeenCalled()
  await syncSimilar(false)
  expect(asked).toHaveBeenCalledWith([10, 20])
})
