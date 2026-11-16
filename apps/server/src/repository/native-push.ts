import { q } from '../db.ts'
import { userRef } from './user.ts'

/** A native app's device: the iPhone app through APNs, or the Android app through FCM. */
export type NativeDevice =
  | {
      /** The iPhone app; rows written before Android had no transport and are APNs. */
      transport?: 'apns'
      installation: string
      token: string
      environment: 'sandbox' | 'production'
    }
  | { transport: 'fcm'; installation: string; token: string }

const APNS_TOKEN = /^[a-f0-9]{32,512}$/
// An FCM registration token: letters, digits, colon, dash and underscore.
const FCM_TOKEN = /^[A-Za-z0-9:_-]{32,4096}$/

// Installation is a random, unguessable device secret. Never accept an owner or session from the body.
export async function saveNativeDevice(
  user: string,
  session: string,
  device: NativeDevice,
): Promise<void> {
  const valid =
    !!session &&
    /^[a-f0-9]{64}$/.test(device.installation) &&
    (device.transport !== 'fcm'
      ? APNS_TOKEN.test(device.token) &&
        !(device.token.length % 2) &&
        ['sandbox', 'production'].includes(device.environment)
      : FCM_TOKEN.test(device.token))
  if (!valid) throw new Error('Invalid native push registration')
  await q(
    `BEGIN TRANSACTION;
     DELETE push_subscription WHERE transport = $transport AND token = $deviceToken
       AND environment = $environment AND installation != $installation;
     UPSERT push_subscription SET transport = $transport, user = $user, session_hash = $sessionHash,
       installation = $installation, token = $deviceToken, environment = $environment
       WHERE transport = $transport AND installation = $installation;
     COMMIT TRANSACTION;`,
    {
      user: userRef(user),
      sessionHash: session,
      transport: device.transport ?? 'apns',
      installation: device.installation,
      deviceToken: device.token,
      environment: device.transport !== 'fcm' ? device.environment : undefined,
    },
  )
}

type Row = {
  transport: 'apns' | 'fcm'
  installation: string
  token: string
  environment?: 'sandbox' | 'production'
}

const fromRow = (r: Row): NativeDevice =>
  r.transport === 'fcm'
    ? { transport: 'fcm', installation: r.installation, token: r.token }
    : {
        transport: 'apns',
        installation: r.installation,
        token: r.token,
        environment: r.environment ?? 'production',
      }

// A revoked/expired session immediately stops delivery, including password changes and account deletion.
export async function nativeDevices(user: string): Promise<NativeDevice[]> {
  const rows =
    (await q<Row[]>(
      `SELECT transport, installation, token, environment FROM push_subscription
       WHERE transport IN ['apns', 'fcm'] AND user = $user
       AND session_hash IN (SELECT VALUE token_hash FROM auth_session WHERE user = $user AND expires_at > time::now())`,
      { user: userRef(user) },
    )) ?? []
  return rows.map(fromRow)
}

/** Recheck immediately before each send: a previous device may have taken time to answer. */
export async function nativeDeviceActive(user: string, device: NativeDevice): Promise<boolean> {
  const rows = await q<{ installation: string }[]>(
    `SELECT installation FROM push_subscription WHERE transport = $transport AND user = $user
      AND installation = $installation AND token = $deviceToken AND environment = $environment
      AND session_hash IN (SELECT VALUE token_hash FROM auth_session WHERE user = $user AND expires_at > time::now()) LIMIT 1`,
    {
      user: userRef(user),
      transport: device.transport ?? 'apns',
      installation: device.installation,
      deviceToken: device.token,
      environment: device.transport !== 'fcm' ? device.environment : undefined,
    },
  )
  return !!rows?.length
}

export async function deleteNativeDevice(user: string, installation: string): Promise<void> {
  await q(
    "DELETE push_subscription WHERE transport IN ['apns', 'fcm'] AND user = $user AND installation = $installation",
    {
      user: userRef(user),
      installation,
    },
  )
}

// Match the token too: a provider's answer for an old token must not remove a concurrent renewal.
export async function expireNativeDevice(device: NativeDevice): Promise<void> {
  await q(
    'DELETE push_subscription WHERE transport = $transport AND installation = $installation AND token = $deviceToken AND environment = $environment',
    {
      transport: device.transport ?? 'apns',
      installation: device.installation,
      deviceToken: device.token,
      environment: device.transport !== 'fcm' ? device.environment : undefined,
    },
  )
}

export async function deleteNativeDevices(user: string): Promise<void> {
  await q("DELETE push_subscription WHERE transport IN ['apns', 'fcm'] AND user = $user", {
    user: userRef(user),
  })
}
