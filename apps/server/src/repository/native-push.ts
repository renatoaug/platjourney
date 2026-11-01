import { q } from '../db.ts'
import { userRef } from './user.ts'

export interface NativeDevice {
  installation: string
  token: string
  environment: 'sandbox' | 'production'
}

// Installation is a random, unguessable device secret. Never accept an owner or session from the body.
export async function saveNativeDevice(
  user: string,
  session: string,
  device: NativeDevice,
): Promise<void> {
  if (
    !session ||
    !/^[a-f0-9]{64}$/.test(device.installation) ||
    !/^[a-f0-9]{32,512}$/.test(device.token) ||
    device.token.length % 2 ||
    !['sandbox', 'production'].includes(device.environment)
  )
    throw new Error('Invalid APNs registration')
  await q(
    `BEGIN TRANSACTION;
     DELETE push_subscription WHERE transport = 'apns' AND token = $deviceToken
       AND environment = $environment AND installation != $installation;
     UPSERT push_subscription SET transport = 'apns', user = $user, session_hash = $sessionHash,
       installation = $installation, token = $deviceToken, environment = $environment WHERE transport = 'apns' AND installation = $installation;
     COMMIT TRANSACTION;`,
    {
      user: userRef(user),
      sessionHash: session,
      installation: device.installation,
      deviceToken: device.token,
      environment: device.environment,
    },
  )
}

// A revoked/expired session immediately stops delivery, including password changes and account deletion.
export async function nativeDevices(user: string): Promise<NativeDevice[]> {
  return (
    (await q<NativeDevice[]>(
      `SELECT installation, token, environment FROM push_subscription WHERE transport = 'apns' AND user = $user
       AND session_hash IN (SELECT VALUE token_hash FROM auth_session WHERE user = $user AND expires_at > time::now())`,
      { user: userRef(user) },
    )) ?? []
  )
}

/** Recheck immediately before each send: a previous device may have taken time to answer. */
export async function nativeDeviceActive(user: string, device: NativeDevice): Promise<boolean> {
  const rows = await q<{ installation: string }[]>(
    `SELECT installation FROM push_subscription WHERE transport = 'apns' AND user = $user
      AND installation = $installation AND token = $deviceToken AND environment = $environment
      AND session_hash IN (SELECT VALUE token_hash FROM auth_session WHERE user = $user AND expires_at > time::now()) LIMIT 1`,
    {
      user: userRef(user),
      installation: device.installation,
      deviceToken: device.token,
      environment: device.environment,
    },
  )
  return !!rows?.length
}

export async function deleteNativeDevice(user: string, installation: string): Promise<void> {
  await q(
    "DELETE push_subscription WHERE transport = 'apns' AND user = $user AND installation = $installation",
    {
      user: userRef(user),
      installation,
    },
  )
}

// Match the token too: an APNs response for an old token must not remove a concurrent renewal.
export async function expireNativeDevice(device: NativeDevice): Promise<void> {
  await q(
    "DELETE push_subscription WHERE transport = 'apns' AND installation = $installation AND token = $deviceToken AND environment = $environment",
    {
      installation: device.installation,
      deviceToken: device.token,
      environment: device.environment,
    },
  )
}

export async function deleteNativeDevices(user: string): Promise<void> {
  await q("DELETE push_subscription WHERE transport = 'apns' AND user = $user", {
    user: userRef(user),
  })
}
