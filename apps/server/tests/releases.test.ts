import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as igdb from '../src/igdb.ts'
import { syncReleases } from '../src/releases.ts'
import * as games from '../src/repository/game.ts'
import { makeGame } from './fixtures.ts'

afterEach(() => mock.restore())

test('the calendar window goes two weeks back and six ahead, and every game joins the catalog', async () => {
  const now = Date.UTC(2026, 9, 13)
  const fetch = spyOn(igdb, 'releasingGames').mockResolvedValue([
    { id: 1, name: 'Out Soon', slug: 'out-soon', game_type: 0 },
    { id: 2, name: 'Just Out', slug: 'just-out', game_type: 0 },
  ])
  const upsert = spyOn(games, 'upsertFromCatalog').mockResolvedValue(makeGame())
  expect(await syncReleases(now)).toBe(2)
  const [from, to] = fetch.mock.calls[0] as [Date, Date]
  expect(from.toISOString()).toBe('2026-09-29T00:00:00.000Z')
  expect(to.toISOString()).toBe('2026-11-24T00:00:00.000Z')
  expect(upsert.mock.calls.map((c) => c[1])).toEqual(['Out Soon', 'Just Out'])
})
