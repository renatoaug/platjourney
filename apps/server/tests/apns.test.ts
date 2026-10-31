import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { generateKeyPairSync, verify } from 'node:crypto'
import { EventEmitter } from 'node:events'
import * as http2 from 'node:http2'
import { apnsAuthorization, apnsEnabled, apnsPayload, nativePushTo, sendApns } from '../src/apns.ts'
import { config } from '../src/config.ts'
import * as devices from '../src/repository/native-push.ts'

const original = { ...config.apns }
const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const device = {
  installation: 'a'.repeat(64),
  token: 'b'.repeat(64),
  environment: 'production' as const,
}
const message = { title: 'Nexo', body: 'Before the next chapter', url: '/history?tip=tip%3Aone' }
const requests: { headers: http2.OutgoingHttpHeaders; body?: string }[] = []
let responses: { status: number; reason?: string }[] = []
let sessions: EventEmitter[] = []

beforeEach(() => {
  Object.assign(config.apns, {
    keyId: 'test-key',
    teamId: 'test-team',
    privateKey: key.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  })
  requests.length = 0
  responses = [{ status: 200 }]
  sessions = []
  spyOn(http2, 'connect').mockImplementation((() => {
    const session = Object.assign(new EventEmitter(), {
      closed: false,
      destroyed: false,
      unref() {},
      setTimeout() {},
      destroy() {
        this.destroyed = true
      },
      request(headers: http2.OutgoingHttpHeaders) {
        const record = { headers, body: '' }
        requests.push(record)
        const result = responses.shift() ?? { status: 200 }
        return Object.assign(new EventEmitter(), {
          setEncoding() {},
          setTimeout() {},
          end(this: EventEmitter, body: string) {
            record.body = body
            queueMicrotask(() => {
              this.emit('response', { ':status': result.status })
              this.emit('data', JSON.stringify({ reason: result.reason }))
              this.emit('end')
            })
          },
        })
      },
    })
    sessions.push(session)
    return session
  }) as unknown as typeof http2.connect)
  spyOn(console, 'warn').mockImplementation(() => {})
  spyOn(devices, 'nativeDeviceActive').mockResolvedValue(true)
})
afterEach(() => {
  for (const session of sessions) session.emit('goaway')
  Object.assign(config.apns, original)
  mock.restore()
})

test('provider tokens are valid ES256, cached and rotated before one hour', () => {
  const token = apnsAuthorization(1_000_000)
  const [head, body, signature] = token.split('.')
  expect(JSON.parse(Buffer.from(head, 'base64url').toString())).toEqual({
    alg: 'ES256',
    kid: 'test-key',
  })
  expect(JSON.parse(Buffer.from(body, 'base64url').toString())).toEqual({
    iss: 'test-team',
    iat: 1000,
  })
  expect(
    verify(
      'sha256',
      Buffer.from(`${head}.${body}`),
      { key: key.publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signature, 'base64url'),
    ),
  ).toBe(true)
  expect(apnsAuthorization(1_000_001)).toBe(token)
  expect(apnsAuthorization(1_000_000 + 51 * 60_000)).not.toBe(token)
})

test('disabled APNs never loads devices or signs tokens', async () => {
  config.apns.privateKey = ''
  const list = spyOn(devices, 'nativeDevices')
  expect(apnsEnabled()).toBe(false)
  expect(() => apnsAuthorization()).toThrow()
  expect(await nativePushTo({ id: 'user:one' }, message)).toBe(0)
  expect(list).not.toHaveBeenCalled()
})

test('payload stays within the byte limit with emoji and JSON escapes', () => {
  const payload = apnsPayload({ ...message, body: '🏆"\n'.repeat(1500) })
  expect(Buffer.byteLength(payload)).toBeLessThanOrEqual(4096)
  expect(JSON.parse(payload).url).toBe(message.url)
  expect(() => apnsPayload({ ...message, url: 'x'.repeat(5000) })).toThrow()
})

test('HTTP/2 sends the token to Apple with topic, expiry and stable collapse id', async () => {
  expect(await sendApns(device, message)).toEqual({ status: 200, reason: undefined })
  expect(http2.connect).toHaveBeenCalledWith('https://api.push.apple.com')
  expect(requests[0].headers[':path']).toBe(`/3/device/${device.token}`)
  expect(requests[0].headers['apns-topic']).toBe('com.platjourney.app')
  expect(requests[0].headers['apns-expiration']).toBe('0')
  expect(requests[0].headers['apns-push-type']).toBe('alert')
  expect(String(requests[0].headers['apns-collapse-id']).length).toBe(64)
  expect(JSON.parse(requests[0].body ?? '{}').aps.alert.body).toBe(message.body)
  await sendApns({ ...device, environment: 'sandbox' }, message)
  expect(http2.connect).toHaveBeenCalledWith('https://api.sandbox.push.apple.com')
})

test('delivery deduplicates tokens, removes invalid devices and retains temporary failures', async () => {
  const gone = { ...device, token: 'c'.repeat(64) }
  const retry = { ...device, token: 'd'.repeat(64) }
  spyOn(devices, 'nativeDevices').mockResolvedValue([device, device, gone, retry])
  const drop = spyOn(devices, 'expireNativeDevice').mockResolvedValue()
  responses = [{ status: 200 }, { status: 410 }, { status: 503 }]
  expect(await nativePushTo({ id: 'user:one' }, message)).toBe(1)
  expect(requests).toHaveLength(3)
  expect(drop).toHaveBeenCalledTimes(1)
  expect(drop).toHaveBeenCalledWith(gone)
})

test('an account switch or logout during delivery skips the stale device', async () => {
  spyOn(devices, 'nativeDevices').mockResolvedValue([device])
  spyOn(devices, 'nativeDeviceActive').mockResolvedValue(false)
  expect(await nativePushTo({ id: 'user:one' }, message)).toBe(0)
  expect(requests).toHaveLength(0)
})
