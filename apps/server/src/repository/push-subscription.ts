import { q } from '../db.ts'
import { userRef } from './user.ts'

/** A device that receives notices as Web Push: where to send and the keys that encrypt for it. */
export interface PushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

/** Saves a device for the user. The same endpoint signed in to another account moves to it. */
export async function savePushSubscription(user: string, sub: PushSubscription): Promise<void> {
  await q(
    // $auth is SurrealDB's own variable (the signed-in record), so the secret travels as $secret.
    `UPSERT push_subscription SET user = $user, endpoint = $endpoint, p256dh = $p256dh, auth = $secret
     WHERE endpoint = $endpoint`,
    { user: userRef(user), endpoint: sub.endpoint, p256dh: sub.p256dh, secret: sub.auth },
  )
}

export async function pushSubscriptions(user: string): Promise<PushSubscription[]> {
  return (
    (await q<PushSubscription[]>(
      'SELECT endpoint, p256dh, auth FROM push_subscription WHERE user = $user',
      { user: userRef(user) },
    )) ?? []
  )
}

/**
 * Drops one device: its push service forgot it, or (with the user) the player turned push off there,
 * which only removes a device of their own.
 */
export async function deletePushSubscription(endpoint: string, user?: string): Promise<void> {
  if (user)
    await q('DELETE push_subscription WHERE endpoint = $endpoint AND user = $user', {
      endpoint,
      user: userRef(user),
    })
  else await q('DELETE push_subscription WHERE endpoint = $endpoint', { endpoint })
}

export async function deletePushSubscriptions(user: string): Promise<void> {
  await q('DELETE push_subscription WHERE user = $user', { user: userRef(user) })
}
