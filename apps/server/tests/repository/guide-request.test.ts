import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import { requestGuide } from '../../src/repository/guide-request.ts'

const game = new db.RecordId('game', 7)
const user = new db.RecordId('user', 'ana')

afterEach(() => mock.restore())

test('a request is one per player: the count is the players who asked', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await requestGuide('game:7', 'user:ana')
  expect(q.mock.calls[0][0]).toContain('users = array::union(users, [$user])')
  expect(q.mock.calls[0][0]).toContain('requests = array::len(array::union(users, [$user]))')
  expect(q.mock.calls[0][0]).toContain(
    'CREATE guide_request SET game = $game, users = [$user], requests = 1',
  )
  expect(q.mock.calls[0][1]).toEqual({ game, user })
})
