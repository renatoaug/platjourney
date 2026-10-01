import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import { detachCalls } from '../../src/repository/llm-call.ts'

const user = new db.RecordId('user', 'u1')

afterEach(() => mock.restore())

test('detaching calls keeps them without the user', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await detachCalls('user:u1')
  expect(q.mock.calls[0]).toEqual(['UPDATE llm_call SET user = NONE WHERE user = $user', { user }])
})
