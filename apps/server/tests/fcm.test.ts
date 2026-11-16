import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { generateKeyPairSync, verify } from 'node:crypto'
import * as apns from '../src/apns.ts'
import { config } from '../src/config.ts'
import { fcmAssertion, fcmEnabled, fcmMessage, sendFcm } from '../src/fcm.ts'
import * as devices from '../src/repository/native-push.ts'

const original = { ...config.fcm }
const key = generateKeyPairSync('rsa', { modulusLength: 2048 })
const message = { title: 'Nexo', body: 'Before the next chapter', url: '/history?tip=tip%3Aone' }
const token = `dXk:APA91b${'x'.repeat(140)}`

beforeEach(() => {
  Object.assign(config.fcm, {
    projectId: 'platjourney-test',
    clientEmail: 'push@platjourney-test.iam.gserviceaccount.com',
    privateKey: key.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  })
})
afterEach(() => {
  Object.assign(config.fcm, original)
  mock.restore()
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

test('enabled only with a whole service account', () => {
  expect(fcmEnabled()).toBe(true)
  Object.assign(config.fcm, { privateKey: '' })
  expect(fcmEnabled()).toBe(false)
})

test('the assertion is an RS256 JWT for the messaging scope, signed by the service account', () => {
  const now = Date.UTC(2026, 10, 16, 12)
  const [header, claims, signature] = fcmAssertion(now).split('.')
  expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({
    alg: 'RS256',
    typ: 'JWT',
  })
  expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toEqual({
    iss: config.fcm.clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now / 1000,
    exp: now / 1000 + 3600,
  })
  expect(
    verify(
      'sha256',
      Buffer.from(`${header}.${claims}`),
      key.publicKey,
      Buffer.from(signature, 'base64url'),
    ),
  ).toBe(true)
})

test('a message shows by itself, carries only the notice route and is not kept offline', () => {
  const { message: m } = fcmMessage(token, message)
  expect(m.token).toBe(token)
  expect(m.notification).toEqual({ title: 'Nexo', body: 'Before the next chapter' })
  expect(m.data).toEqual({ url: message.url })
  expect(m.android.ttl).toBe('0s')
  // A notice for the same tip replaces the earlier one.
  expect(m.android.notification.tag).toHaveLength(32)
})

test('a send trades the assertion for a token once, and a vanished device reads as gone', async () => {
  const fetch = spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json({ access_token: 'ya29.test', expires_in: 3600 }))
    .mockResolvedValueOnce(json({ name: 'projects/platjourney-test/messages/1' }))
    .mockResolvedValueOnce(
      json(
        {
          error: {
            status: 'NOT_FOUND',
            details: [
              {
                '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
                errorCode: 'UNREGISTERED',
              },
            ],
          },
        },
        404,
      ),
    )
  expect(await sendFcm(token, message)).toEqual({ status: 200, gone: false })
  expect(await sendFcm(token, message)).toEqual({ status: 404, gone: true })
  // One token request, then two sends that reuse it.
  expect(fetch).toHaveBeenCalledTimes(3)
  const [, send] = fetch.mock.calls[1] as [string, RequestInit]
  expect(fetch.mock.calls[1][0]).toBe(
    'https://fcm.googleapis.com/v1/projects/platjourney-test/messages:send',
  )
  expect((send.headers as Record<string, string>).authorization).toBe('Bearer ya29.test')
})

test('native delivery sends Android devices through FCM and forgets a vanished one', async () => {
  const android = { transport: 'fcm' as const, installation: 'c'.repeat(64), token }
  spyOn(apns, 'apnsEnabled').mockReturnValue(false)
  spyOn(devices, 'nativeDevices').mockResolvedValue([android])
  spyOn(devices, 'nativeDeviceActive').mockResolvedValue(true)
  const expire = spyOn(devices, 'expireNativeDevice').mockResolvedValue()
  spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json({ access_token: 'ya29.test2', expires_in: 3600 }))
    .mockResolvedValueOnce(json({ error: { status: 'NOT_FOUND' } }, 404))
  // A fresh token key: a different client email.
  Object.assign(config.fcm, { clientEmail: 'other@platjourney-test.iam.gserviceaccount.com' })
  expect(await apns.nativePushTo({ id: 'user:one' }, message)).toBe(0)
  expect(expire).toHaveBeenCalledWith(android)
})
