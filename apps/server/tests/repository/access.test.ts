import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import { deleteAccesses, deleteAccessesBefore, recordAccess } from '../../src/repository/access.ts'

const user = new db.RecordId('user', 'u1')

afterEach(() => mock.restore())

test('an access is counted once per account and address', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await recordAccess('user:u1', 'abc')
  expect(q.mock.calls[0][0]).toContain('WHERE user = $user AND ip_hash = $ip')
  expect(q.mock.calls[0][1]).toEqual({ user, ip: 'abc' })
})

test('deleting accesses removes every row of the user', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await deleteAccesses('user:u1')
  expect(q.mock.calls[0]).toEqual(['DELETE access WHERE user = $user', { user }])
})

test('old accesses are deleted by age', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await deleteAccessesBefore(180)
  expect(q.mock.calls[0][1]).toEqual({ age: '180d' })
})
