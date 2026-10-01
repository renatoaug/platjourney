import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import { listPlaytimes, savePlaytime } from '../../src/repository/playtime.ts'

const user = new db.RecordId('user', 'u1')
const game = new db.RecordId('game', 7)

afterEach(() => mock.restore())

test('playtimes are listed per game', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([{ game, seconds: 60 }])
  expect(await listPlaytimes('user:u1')).toEqual([{ game: 'game:7', seconds: 60 }] as never)
  expect(q.mock.calls[0][0]).toContain('FROM playtime WHERE user = $user')
  expect(q.mock.calls[0][1]).toEqual({ user })
})

test('a playtime is upserted with dates only when known', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await savePlaytime('user:u1', {
    game: 'game:7',
    seconds: 60,
    play_count: 2,
    first_played_at: '2026-01-01T00:00:00.000Z',
    last_played_at: null,
  })
  expect(q.mock.calls[0][0]).toContain('WHERE user = $user AND game = $game')
  expect(q.mock.calls[0][1]).toEqual({
    user,
    game,
    seconds: 60,
    count: 2,
    first: new Date('2026-01-01T00:00:00.000Z'),
    last: undefined,
  })
})
