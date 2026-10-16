import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import {
  deletePushSubscription,
  deletePushSubscriptions,
  pushSubscriptions,
  savePushSubscription,
} from '../../src/repository/push-subscription.ts'

const user = new db.RecordId('user', 'u1')
const sub = { endpoint: 'https://push.example/a', p256dh: 'k', auth: 's' }

afterEach(() => mock.restore())

test('a device is saved once per endpoint, under the account that turned it on', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await savePushSubscription('user:u1', sub)
  expect(q.mock.calls[0][0]).toContain('WHERE endpoint = $endpoint')
  expect(q.mock.calls[0][1]).toEqual({ user, endpoint: sub.endpoint, p256dh: 'k', secret: 's' })
})

test('the devices of a user are listed, none when the query has nothing', async () => {
  spyOn(db, 'q').mockResolvedValueOnce([sub]).mockResolvedValueOnce(undefined)
  expect(await pushSubscriptions('user:u1')).toEqual([sub])
  expect(await pushSubscriptions('user:u1')).toEqual([])
})

test('a device is dropped by endpoint, only from its own account when the player asks', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await deletePushSubscription('https://push.example/a')
  await deletePushSubscription('https://push.example/a', 'user:u1')
  await deletePushSubscriptions('user:u1')
  expect(q.mock.calls[0]).toEqual([
    'DELETE push_subscription WHERE endpoint = $endpoint',
    { endpoint: 'https://push.example/a' },
  ])
  expect(q.mock.calls[1][1]).toEqual({ endpoint: 'https://push.example/a', user })
  expect(q.mock.calls[2]).toEqual(['DELETE push_subscription WHERE user = $user', { user }])
})
