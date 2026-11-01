import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import {
  deleteNativeDevice,
  deleteNativeDevices,
  expireNativeDevice,
  nativeDevices,
  saveNativeDevice,
} from '../../src/repository/native-push.ts'

const device = {
  installation: 'a'.repeat(64),
  token: 'b'.repeat(64),
  environment: 'production' as const,
}
afterEach(() => mock.restore())

test('rotation updates one installation and binds it to the server session', async () => {
  const query = spyOn(db, 'q').mockResolvedValue(undefined)
  await saveNativeDevice('user:one', 'hashed-session', device)
  expect(query.mock.calls[0][0]).toContain(
    "WHERE transport = 'apns' AND installation = $installation",
  )
  expect(query.mock.calls[0][1]).toEqual({
    user: new db.RecordId('user', 'one'),
    sessionHash: 'hashed-session',
    installation: device.installation,
    deviceToken: device.token,
    environment: device.environment,
  })
})

test('delivery excludes logged-out, expired and password-revoked sessions', async () => {
  const query = spyOn(db, 'q').mockResolvedValue([device])
  expect(await nativeDevices('user:one')).toEqual([device])
  expect(query.mock.calls[0][0]).toContain(
    'session_hash IN (SELECT VALUE token_hash FROM auth_session WHERE user = $user AND expires_at > time::now())',
  )
  query.mockResolvedValue(undefined)
  expect(await nativeDevices('user:one')).toEqual([])
})

test('revocation is owner scoped and invalid-token cleanup cannot remove a renewed token', async () => {
  const query = spyOn(db, 'q').mockResolvedValue(undefined)
  await deleteNativeDevice('user:one', device.installation)
  await expireNativeDevice(device)
  await deleteNativeDevices('user:one')
  expect(query.mock.calls[0][0]).toContain('user = $user AND installation = $installation')
  expect(query.mock.calls[1][0]).toContain('token = $deviceToken AND environment = $environment')
  expect(query.mock.calls[2][0]).toBe(
    "DELETE push_subscription WHERE transport = 'apns' AND user = $user",
  )
})

test('invalid transfers are rejected before touching an existing destination', async () => {
  const query = spyOn(db, 'q').mockResolvedValue(undefined)
  await expect(saveNativeDevice('user:one', '', device)).rejects.toThrow('Invalid APNs')
  for (const invalid of [
    { ...device, token: 'not-a-token' },
    { ...device, token: 'b'.repeat(33) },
    { ...device, installation: 'bad' },
    { ...device, environment: 'unknown' as 'production' },
  ])
    await expect(saveNativeDevice('user:one', 'session', invalid)).rejects.toThrow('Invalid APNs')
  expect(query).not.toHaveBeenCalled()
})
