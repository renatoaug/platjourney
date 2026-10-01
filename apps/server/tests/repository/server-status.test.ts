import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import { listServerStatuses, saveServerStatus } from '../../src/repository/server-status.ts'

const game = new db.RecordId('game', 7)

afterEach(() => mock.restore())

test('statuses are listed for every game or only the ones asked', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([{ game: { id: game }, status: 'closed' }])
  expect(await listServerStatuses()).toEqual([
    { game: { id: 'game:7' }, status: 'closed' },
  ] as never)
  expect(q.mock.calls[0]).toEqual([
    'SELECT *, shutdown_at AS date, updated_at AS checked_at, game.* AS game FROM server_status  ORDER BY game.name',
    undefined,
  ])
  await listServerStatuses(['game:7'])
  expect(q.mock.calls[1]).toEqual([
    'SELECT *, shutdown_at AS date, updated_at AS checked_at, game.* AS game FROM server_status WHERE game IN $games ORDER BY game.name',
    { games: [game] },
  ])
})

test('an empty list of games reads nothing', async () => {
  const q = spyOn(db, 'q')
  expect(await listServerStatuses([])).toEqual([])
  expect(q).not.toHaveBeenCalled()
})

test('a status is upserted per game, dropping empty fields', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await saveServerStatus({ game: 'game:7', status: 'announced', date: null, note: 'fim' })
  expect(q.mock.calls[0][0]).toContain('UPSERT server_status')
  expect(q.mock.calls[0][0]).toContain('WHERE game = $game')
  expect(q.mock.calls[0][1]).toEqual({ game, status: 'announced', date: undefined, note: 'fim' })
})
