import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import { requestGuide } from '../../src/repository/guide-request.ts'

const game = new db.RecordId('game', 7)

afterEach(() => mock.restore())

test('requesting a guide counts one more request for the game', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await requestGuide('game:7')
  expect(q.mock.calls[0][0]).toContain('requests += 1')
  expect(q.mock.calls[0][0]).toContain('CREATE guide_request SET game = $game, requests = 1')
  expect(q.mock.calls[0][1]).toEqual({ game })
})
