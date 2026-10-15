import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import {
  expansionLinks,
  gamesByIds,
  guidedInSeries,
  guideFacts,
  peerPlatinums,
  seriesOf,
  similarEdges,
  similarOf,
  writeRelations,
} from '../../src/repository/similar.ts'

const g = (n: number) => new db.RecordId('game', n)

afterEach(() => mock.restore())

test('nothing to look up asks nothing', async () => {
  const q = spyOn(db, 'q')
  expect(await similarEdges([])).toEqual([])
  expect(await peerPlatinums('user:1', [], ['game:1'])).toEqual([])
  expect(await peerPlatinums('user:1', ['game:1'], [])).toEqual([])
  expect(await guideFacts([])).toEqual([])
  expect(await gamesByIds([])).toEqual([])
  expect(await expansionLinks([])).toEqual([])
  expect(await seriesOf([])).toEqual([])
  expect(await guidedInSeries([])).toEqual([])
  expect(q).not.toHaveBeenCalled()
})

test('edges, peers and links are read by game record', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([])
  await similarEdges(['game:1'])
  expect(q.mock.calls[0]).toEqual([
    'SELECT in AS seed, out AS game, rank FROM similar_to WHERE in IN $ids',
    { ids: [g(1)] },
  ])
  await peerPlatinums('user:1', ['game:1'], ['game:2'])
  expect(q.mock.calls[1][0]).toContain('user != $user')
  expect(q.mock.calls[1][1]).toEqual({
    user: new db.RecordId('user', '1'),
    seeds: [g(1)],
    candidates: [g(2)],
  })
  await expansionLinks(['game:3'])
  expect(q.mock.calls[2][0]).toContain('WHERE in IN $ids OR out IN $ids')
  await similarOf('game:4')
  expect(q.mock.calls[3]).toEqual([
    'SELECT out AS game, rank FROM similar_to WHERE in = $id ORDER BY rank',
    { id: g(4) },
  ])
  await gamesByIds(['game:5'])
  expect(q.mock.calls[4]).toEqual(['SELECT * OMIT embedding FROM $ids', { ids: [g(5)] }])
  await guidedInSeries([7])
  expect(q.mock.calls[5][1]).toEqual({ series: [7] })
})

test('guide facts come back in camelCase', async () => {
  spyOn(db, 'q').mockResolvedValue([
    { game: g(1), has_missables: true, online_trophies: 2, difficulty_trophy: null },
  ])
  expect(await guideFacts(['game:1'])).toEqual([
    { game: 'game:1', hasMissables: true, onlineTrophies: 2, difficultyTrophy: null },
  ])
})

test('series are read only for games that have some', async () => {
  spyOn(db, 'q').mockResolvedValue([
    { id: g(1), series: [3] },
    { id: g(2), series: null },
    { id: g(3), series: [] },
  ])
  expect(await seriesOf(['game:1', 'game:2', 'game:3'])).toEqual([{ id: 'game:1', series: [3] }])
})

test('a game links are replaced, and empty ones only delete', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await writeRelations('game:1', {
    similar: [{ game: 'game:2', rank: 0 }],
    base: 'game:3',
    series: [9],
  })
  expect(q.mock.calls[0][0]).toContain('DELETE similar_to WHERE in = $id;')
  expect(q.mock.calls[0][0]).toContain('INSERT RELATION INTO similar_to $similar')
  expect(q.mock.calls[0][0]).toContain('INSERT RELATION INTO expansion_of $base')
  expect(q.mock.calls[0][1]).toEqual({
    id: g(1),
    similar: [{ in: g(1), out: g(2), rank: 0 }],
    base: [{ in: g(1), out: g(3) }],
    series: [9],
  })
  await writeRelations('game:1', { similar: [], base: null, series: [] })
  expect(q.mock.calls[1][0]).not.toContain('INSERT')
  expect(q.mock.calls[1][0]).toContain('DELETE expansion_of WHERE in = $id;')
  expect(q.mock.calls[1][1]).toMatchObject({ series: undefined })
})
