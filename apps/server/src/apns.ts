import { createHash, createPrivateKey, sign } from 'node:crypto'
import { type ClientHttp2Session, connect } from 'node:http2'
import { config } from './config.ts'
import { fcmEnabled, sendFcm } from './fcm.ts'
import type { PushMessage } from './push.ts'
import {
  expireNativeDevice,
  type NativeDevice,
  nativeDeviceActive,
  nativeDevices,
} from './repository/native-push.ts'

export const apnsEnabled = (): boolean =>
  !!(config.apns.keyId && config.apns.teamId && config.apns.privateKey)
let jwt: { key: string; at: number; value: string } | undefined

export function apnsAuthorization(now = Date.now()): string {
  const { keyId, teamId, privateKey } = config.apns
  if (!apnsEnabled()) throw new Error('APNs is disabled')
  const key = createHash('sha256').update(`${keyId}|${teamId}|${privateKey}`).digest('hex')
  if (jwt?.key === key && now >= jwt.at && now - jwt.at < 50 * 60_000) return jwt.value
  const part = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const unsigned = `${part({ alg: 'ES256', kid: keyId })}.${part({ iss: teamId, iat: Math.floor(now / 1000) })}`
  const signature = sign('sha256', Buffer.from(unsigned), {
    key: createPrivateKey(privateKey),
    dsaEncoding: 'ieee-p1363',
  })
  jwt = { key, at: now, value: `${unsigned}.${signature.toString('base64url')}` }
  return jwt.value
}

const connections = new Map<string, ClientHttp2Session>()
function connection(environment: 'sandbox' | 'production'): ClientHttp2Session {
  const host =
    environment === 'sandbox' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com'
  let session = connections.get(host)
  if (session && !session.closed && !session.destroyed) return session
  session = connect(host)
  connections.set(host, session)
  const close = () => {
    if (connections.get(host) === session) connections.delete(host)
    session?.destroy()
  }
  session.on('error', close)
  session.on('goaway', close)
  session.setTimeout(60_000, close)
  session.unref()
  return session
}

export function apnsPayload(message: PushMessage): string {
  // JSON escaping and multibyte text count towards Apple's 4096-byte limit.
  let body = message.body
  const payload = () =>
    JSON.stringify({
      aps: { alert: { title: message.title, body }, sound: 'default' },
      url: message.url,
    })
  while (Buffer.byteLength(payload()) > 4096 && body.length) body = body.slice(0, -32)
  const result = payload()
  if (Buffer.byteLength(result) > 4096) throw new Error('APNs payload too large')
  return result
}

export async function sendApns(
  device: Exclude<NativeDevice, { transport: 'fcm' }>,
  message: PushMessage,
): Promise<{ status: number; reason?: string }> {
  const payload = apnsPayload(message)
  const authorization = apnsAuthorization()
  return new Promise((resolve, reject) => {
    const stream = connection(device.environment).request({
      ':method': 'POST',
      ':path': `/3/device/${device.token}`,
      authorization: `bearer ${authorization}`,
      'apns-topic': config.apns.topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      // Do not queue a private notice for a logged-out/offline device at APNs.
      'apns-expiration': '0',
      ...(message.url.includes('?tip=')
        ? { 'apns-collapse-id': createHash('sha256').update(message.url).digest('hex') }
        : {}),
    })
    let status = 0
    let data = ''
    stream.setEncoding('utf8')
    stream.on('response', (headers) => {
      status = Number(headers[':status'])
    })
    stream.on('data', (chunk: string) => {
      if (data.length < 4096) data += chunk
    })
    stream.on('error', reject)
    stream.setTimeout(10_000, () => {
      stream.destroy(new Error('APNs timeout'))
    })
    stream.on('end', () => {
      let reason: string | undefined
      try {
        reason = JSON.parse(data).reason
      } catch {
        /* Success has no body. */
      }
      resolve({ status, reason })
    })
    stream.end(payload)
  })
}

/** One iPhone: sent, or the device forgotten when APNs no longer knows its token. */
async function toIphone(
  device: Exclude<NativeDevice, { transport: 'fcm' }>,
  message: PushMessage,
): Promise<boolean> {
  const result = await sendApns(device, message)
  if (result.status === 200) return true
  const gone =
    result.status === 410 ||
    (result.status === 400 &&
      ['BadDeviceToken', 'DeviceTokenNotForTopic'].includes(result.reason ?? ''))
  if (gone) await expireNativeDevice(device)
  // Never log tokens, keys, message bodies or error strings from network libraries.
  else console.warn(`APNs refused: ${result.status}`)
  return false
}

/** One Android phone: sent, or the device forgotten when FCM no longer knows its token. */
async function toAndroid(
  device: Extract<NativeDevice, { transport: 'fcm' }>,
  message: PushMessage,
): Promise<boolean> {
  const result = await sendFcm(device.token, message)
  if (result.status === 200) return true
  if (result.gone) await expireNativeDevice(device)
  else console.warn(`FCM refused: ${result.status}`)
  return false
}

/** Sends to every native device of the player: the iPhone app through APNs, the Android app through
 * FCM. A device the provider no longer knows is forgotten; any other failure is only logged. */
export async function nativePushTo(user: { id: string }, message: PushMessage): Promise<number> {
  const on = { apns: apnsEnabled(), fcm: fcmEnabled() }
  if (!on.apns && !on.fcm) return 0
  // One send per destination, and only through a provider that is set up.
  const seen = new Set<string>()
  const targets = (await nativeDevices(user.id)).filter((device) => {
    const key =
      device.transport === 'fcm' ? `fcm:${device.token}` : `${device.environment}:${device.token}`
    if (seen.has(key) || !(device.transport === 'fcm' ? on.fcm : on.apns)) return false
    seen.add(key)
    return true
  })
  let sent = 0
  for (const device of targets) if (await deliver(user.id, device, message)) sent++
  return sent
}

/** One device, rechecked right before the send: true when the provider accepted it. */
async function deliver(user: string, device: NativeDevice, message: PushMessage): Promise<boolean> {
  try {
    if (!(await nativeDeviceActive(user, device))) return false
    return device.transport === 'fcm'
      ? await toAndroid(device, message)
      : await toIphone(device, message)
  } catch {
    console.warn(`${device.transport === 'fcm' ? 'FCM' : 'APNs'} delivery failed`)
    return false
  }
}
