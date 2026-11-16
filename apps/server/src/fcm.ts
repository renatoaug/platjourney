/** Notices to the Android app through Firebase Cloud Messaging (HTTP v1). The server signs a short
 * JWT with the service account's key, trades it for an access token at Google and reuses that
 * token until shortly before it expires. Off without a service account (config.fcm). */
import { createHash, createPrivateKey, sign } from 'node:crypto'
import { config } from './config.ts'
import type { PushMessage } from './push.ts'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

export const fcmEnabled = (): boolean =>
  !!(config.fcm.projectId && config.fcm.clientEmail && config.fcm.privateKey)

/** The signed request for an access token (a JWT bearer assertion, RS256). */
export function fcmAssertion(now = Date.now()): string {
  const { clientEmail, privateKey } = config.fcm
  const at = Math.floor(now / 1000)
  const part = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: at,
    exp: at + 3600,
  })}`
  const signature = sign('sha256', Buffer.from(unsigned), createPrivateKey(privateKey))
  return `${unsigned}.${signature.toString('base64url')}`
}

let access: { key: string; until: number; value: string } | undefined

async function accessToken(now = Date.now()): Promise<string> {
  const key = createHash('sha256')
    .update(`${config.fcm.clientEmail}|${config.fcm.privateKey}`)
    .digest('hex')
  if (access?.key === key && now < access.until) return access.value
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: fcmAssertion(now),
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`FCM token refused: ${res.status}`)
  const body = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!body.access_token) throw new Error('FCM token missing')
  // Renew five minutes early.
  access = { key, until: now + ((body.expires_in ?? 3600) - 300) * 1000, value: body.access_token }
  return access.value
}

/** The message for one device: a notification Android shows by itself, and the notice's route. */
export function fcmMessage(token: string, message: PushMessage) {
  return {
    message: {
      token,
      notification: { title: message.title, body: message.body },
      data: { url: message.url },
      android: {
        priority: 'HIGH',
        // A private notice is not kept for a device that stays offline.
        ttl: '0s',
        notification: {
          sound: 'default',
          ...(message.url.includes('?tip=')
            ? { tag: createHash('sha256').update(message.url).digest('hex').slice(0, 32) }
            : {}),
        },
      },
    },
  }
}

/** Sends to one device. `gone` is true when FCM says the token no longer exists. */
export async function sendFcm(
  token: string,
  message: PushMessage,
): Promise<{ status: number; gone: boolean }> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.fcm.projectId)}/messages:send`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await accessToken()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(fcmMessage(token, message)),
      signal: AbortSignal.timeout(10_000),
    },
  )
  if (res.ok) return { status: res.status, gone: false }
  let code = ''
  try {
    const body = (await res.json()) as {
      error?: { status?: string; details?: { errorCode?: string }[] }
    }
    code = body.error?.details?.find((d) => d.errorCode)?.errorCode ?? body.error?.status ?? ''
  } catch {
    /* An error without a JSON body. */
  }
  return { status: res.status, gone: res.status === 404 || code === 'UNREGISTERED' }
}
