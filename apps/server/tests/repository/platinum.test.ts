import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import { listPlatinums, savePlatinum } from '../../src/repository/platinum.ts'

const user = new db.RecordId('user', 'u1')
const game = new db.RecordId('game', 7)

afterEach(() => mock.restore())

test('platinums are listed newest first with their game', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([{ game: { id: game } }])
  expect(await listPlatinums('user:u1')).toEqual([{ game: { id: 'game:7' } }] as never)
  expect(q.mock.calls[0][0]).toContain('ORDER BY earned_at DESC')
  expect(q.mock.calls[0][1]).toEqual({ user })
})

test('a platinum is upserted per list with its date as a date', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await savePlatinum('user:u1', {
    game: 'game:7',
    np_communication_id: 'NP',
    trophy_name: 'Plat',
    earned_at: '2026-01-02T00:00:00.000Z',
    rarity_rate: 3.5,
  })
  expect(q.mock.calls[0][0]).toContain('WHERE user = $user AND np_communication_id = $np')
  expect(q.mock.calls[0][1]).toEqual({
    user,
    game,
    np: 'NP',
    trophy: 'Plat',
    at: new Date('2026-01-02T00:00:00.000Z'),
    rate: 3.5,
  })
})
