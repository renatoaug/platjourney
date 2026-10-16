// Web Push without a library: each message is encrypted for the device (RFC 8291, aes128gcm) and
// signed for the push service with the instance's VAPID key (RFC 8292). node:crypto does both.
import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  type ECDH,
  randomBytes,
  sign,
} from 'node:crypto'
import { config } from './config.ts'
import {
  deletePushSubscription,
  type PushSubscription,
  pushSubscriptions,
} from './repository/push-subscription.ts'

/** What a notification shows, and the screen a tap on it opens. */
export interface PushMessage {
  title: string
  body: string
  url: string
}

const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest()
const text = (s: string) => Buffer.from(s, 'utf8')

export const pushEnabled = (): boolean => !!(config.push.publicKey && config.push.privateKey)

function oneTimeKey(): ECDH {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return ecdh
}

/**
 * Encrypts one message for a device: its public key (p256dh) and auth secret come from the
 * subscription. The salt and the server's one-time key are random; tests pass their own.
 */
export function encryptPayload(
  sub: Pick<PushSubscription, 'p256dh' | 'auth'>,
  payload: Buffer,
  salt: Buffer = randomBytes(16),
  server: ECDH = oneTimeKey(),
): Buffer {
  const uaPublic = Buffer.from(sub.p256dh, 'base64url')
  const authSecret = Buffer.from(sub.auth, 'base64url')
  const asPublic = server.getPublicKey()
  const shared = server.computeSecret(uaPublic)
  // The device's auth secret and the shared secret make the input key (RFC 8291, section 3.4).
  const prkKey = hmac(authSecret, shared)
  const ikm = hmac(
    prkKey,
    Buffer.concat([text('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]),
  )
  const prk = hmac(salt, ikm)
  const cek = hmac(prk, Buffer.concat([text('Content-Encoding: aes128gcm\0'), Buffer.from([1])]))
  const nonce = hmac(prk, Buffer.concat([text('Content-Encoding: nonce\0'), Buffer.from([1])]))
  const cipher = createCipheriv('aes-128-gcm', cek.subarray(0, 16), nonce.subarray(0, 12))
  // One record: the message, then the delimiter that marks it as the last.
  const body = Buffer.concat([
    cipher.update(Buffer.concat([payload, Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ])
  const header = Buffer.alloc(21)
  salt.copy(header, 0)
  header.writeUInt32BE(4096, 16)
  header.writeUInt8(asPublic.length, 20)
  return Buffer.concat([header, asPublic, body])
}

/** The Authorization header that proves to the push service who sends (VAPID, ES256 JWT). */
export function vapidAuthorization(endpoint: string, now = Date.now()): string {
  const { publicKey, privateKey, contact } = config.push
  if (!publicKey || !privateKey) throw new Error('push is off: no VAPID keys')
  const pub = Buffer.from(publicKey, 'base64url')
  const key = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: privateKey,
      x: pub.subarray(1, 33).toString('base64url'),
      y: pub.subarray(33, 65).toString('base64url'),
    },
    format: 'jwk',
  })
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 3600,
    sub: contact,
  })}`
  const signature = sign('sha256', text(unsigned), { key, dsaEncoding: 'ieee-p1363' })
  return `vapid t=${unsigned}.${signature.toString('base64url')}, k=${publicKey}`
}

/** Sends one message to one device and answers the push service's status. */
export async function sendPush(sub: PushSubscription, message: PushMessage): Promise<number> {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidAuthorization(sub.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      // A notice a day old is no news anymore.
      TTL: '86400',
      Urgency: 'normal',
    },
    body: new Uint8Array(encryptPayload(sub, text(JSON.stringify(message)))),
  })
  return res.status
}

/**
 * Sends a message to every device of the user. A device the push service no longer knows (404,
 * 410) is forgotten; any other failure is logged and the rest still get it.
 */
export async function pushTo(user: { id: string }, message: PushMessage): Promise<number> {
  if (!pushEnabled()) return 0
  let sent = 0
  for (const sub of await pushSubscriptions(user.id)) {
    const status = await sendPush(sub, message).catch((e) => {
      console.warn('push failed:', (e as Error).message.slice(0, 80))
      return 0
    })
    if (status >= 200 && status < 300) sent++
    else if (status === 404 || status === 410) await deletePushSubscription(sub.endpoint)
    // A refusal that keeps the device (403: the key it subscribed with is not this instance's).
    if (status >= 300) console.warn(`push refused: ${status} from ${new URL(sub.endpoint).host}`)
  }
  return sent
}
