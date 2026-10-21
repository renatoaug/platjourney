import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { createDecipheriv, createECDH, createHmac, createPublicKey, verify } from 'node:crypto'
import { config } from '../src/config.ts'
import { encryptPayload, pushEnabled, pushTo, sendPush, vapidAuthorization } from '../src/push.ts'
import * as subs from '../src/repository/push-subscription.ts'

const saved = { ...config.push }
const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest()

// A device: its key pair and auth secret, as a browser makes them.
function device() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = Buffer.from('0123456789abcdef')
  return {
    ecdh,
    auth,
    sub: {
      endpoint: 'https://push.example/send/abc',
      p256dh: ecdh.getPublicKey().toString('base64url'),
      auth: auth.toString('base64url'),
    },
  }
}

// What the browser does on arrival (RFC 8291): read the header, derive the same keys, open the record.
function decrypt(ua: ReturnType<typeof device>, message: Buffer): string {
  const salt = message.subarray(0, 16)
  const idlen = message.readUInt8(20)
  const asPublic = message.subarray(21, 21 + idlen)
  const body = message.subarray(21 + idlen)
  const shared = ua.ecdh.computeSecret(asPublic)
  const prkKey = hmac(ua.auth, shared)
  const info = Buffer.concat([
    Buffer.from('WebPush: info\0'),
    ua.ecdh.getPublicKey(),
    asPublic,
    Buffer.from([1]),
  ])
  const prk = hmac(salt, hmac(prkKey, info))
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16)
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12)
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce)
  decipher.setAuthTag(body.subarray(body.length - 16))
  const plain = Buffer.concat([
    decipher.update(body.subarray(0, body.length - 16)),
    decipher.final(),
  ])
  expect(plain[plain.length - 1]).toBe(2)
  return plain.subarray(0, plain.length - 1).toString()
}

function keys() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  config.push.publicKey = ecdh.getPublicKey().toString('base64url')
  config.push.privateKey = ecdh.getPrivateKey().toString('base64url')
  config.push.contact = 'mailto:dev@example.com'
}

beforeEach(keys)

afterEach(() => {
  Object.assign(config.push, saved)
  mock.restore()
})

test('a message is encrypted so only the device can read it', () => {
  const ua = device()
  const message = encryptPayload(ua.sub, Buffer.from('{"title":"Nexo"}'))
  expect(message.readUInt32BE(16)).toBe(4096)
  expect(decrypt(ua, message)).toBe('{"title":"Nexo"}')
  expect(() => decrypt(device(), message)).toThrow()
})

test('the VAPID header is a JWT for the push service, signed with the instance key', () => {
  const header = vapidAuthorization('https://push.example/send/abc', 1_000_000)
  const [, token, key] = /^vapid t=([^,]+), k=(.+)$/.exec(header) ?? []
  expect(key).toBe(config.push.publicKey as string)
  const [head, body, sig] = token.split('.')
  expect(JSON.parse(Buffer.from(body, 'base64url').toString())).toEqual({
    aud: 'https://push.example',
    exp: 1000 + 12 * 3600,
    sub: 'mailto:dev@example.com',
  })
  const pub = Buffer.from(key, 'base64url')
  const publicKey = createPublicKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: pub.subarray(1, 33).toString('base64url'),
      y: pub.subarray(33).toString('base64url'),
    },
    format: 'jwk',
  })
  const ok = verify(
    'sha256',
    Buffer.from(`${head}.${body}`),
    { key: publicKey, dsaEncoding: 'ieee-p1363' },
    Buffer.from(sig, 'base64url'),
  )
  expect(ok).toBe(true)
})

test('push is off without both keys, and the header refuses to sign', () => {
  expect(pushEnabled()).toBe(true)
  config.push.privateKey = null
  expect(pushEnabled()).toBe(false)
  expect(() => vapidAuthorization('https://push.example/x')).toThrow('no VAPID keys')
})

test('a send posts the encrypted message with the push headers', async () => {
  const ua = device()
  const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }))
  const status = await sendPush(ua.sub, { title: 'Nexo', body: 'Oi', url: '/history' })
  expect(status).toBe(201)
  const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
  expect(url).toBe(ua.sub.endpoint)
  const headers = init.headers as Record<string, string>
  expect(headers['Content-Encoding']).toBe('aes128gcm')
  expect(headers.TTL).toBe('86400')
  expect(headers.Authorization).toStartWith('vapid t=')
  expect(JSON.parse(decrypt(ua, Buffer.from(init.body as Uint8Array)))).toEqual({
    title: 'Nexo',
    body: 'Oi',
    url: '/history',
  })
})

test('pushTo reaches every device and forgets the ones the push service dropped', async () => {
  const a = device().sub
  const b = { ...device().sub, endpoint: 'https://push.example/send/gone' }
  const c = { ...device().sub, endpoint: 'https://push.example/send/down' }
  spyOn(subs, 'pushSubscriptions').mockResolvedValue([a, b, c])
  const drop = spyOn(subs, 'deletePushSubscription').mockResolvedValue()
  spyOn(console, 'warn').mockImplementation(() => {})
  spyOn(globalThis, 'fetch').mockImplementation((async (url: string) => {
    if (url.endsWith('gone')) return new Response(null, { status: 410 })
    if (url.endsWith('down')) throw new Error('network')
    return new Response(null, { status: 201 })
  }) as unknown as typeof fetch)
  const sent = await pushTo({ id: 'user:u1' }, { title: 'Nexo', body: 'x', url: '/' })
  expect(sent).toBe(1)
  expect(drop).toHaveBeenCalledTimes(1)
  expect(drop).toHaveBeenCalledWith('https://push.example/send/gone')
})

test('pushTo does nothing when the instance has push off', async () => {
  config.push.publicKey = null
  const list = spyOn(subs, 'pushSubscriptions').mockResolvedValue([])
  expect(await pushTo({ id: 'user:u1' }, { title: 'Nexo', body: 'x', url: '/' })).toBe(0)
  expect(list).not.toHaveBeenCalled()
})
