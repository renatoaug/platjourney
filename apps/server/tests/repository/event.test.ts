import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import { pruneEvents, saveEvents } from '../../src/repository/event.ts'

afterEach(() => mock.restore())

test('a batch of events goes in one insert, each with the player and its time', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  const at = new Date('2026-10-27T12:00:00Z')
  await saveEvents('user:u1', [{ name: 'screen', target: '/guides', path: '/guides', at }])
  expect(q.mock.calls[0]).toEqual([
    'INSERT INTO event $rows',
    {
      rows: [
        {
          user: new db.RecordId('user', 'u1'),
          name: 'screen',
          target: '/guides',
          path: '/guides',
          created_at: at,
        },
      ],
    },
  ])
})

test('an empty batch sends nothing, and old events are pruned', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await saveEvents('user:u1', [])
  expect(q).not.toHaveBeenCalled()
  await pruneEvents()
  expect(q.mock.calls[0][0]).toBe('DELETE event WHERE created_at < time::now() - 180d')
})
