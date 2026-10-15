import { one, plain, q } from '../db.ts'
import { userRef } from './user.ts'

interface Verification {
  psn_online_id: string
  psn_account_id: string
  avatar_url: string | null
  code: string
  secret_hash?: string
  expires_at: string
}

/**
 * Starts a claim, unless one is still pending for that PSN id: only a missing or expired row is
 * replaced, so nobody can swap the code and secret of someone else's claim. False when one is pending.
 */
export async function saveVerification(v: {
  psn_online_id: string
  psn_account_id: string
  avatar_url: string | null
  code: string
  secret_hash: string
  minutes: number
}): Promise<boolean> {
  try {
    const rows = await q<unknown[]>(
      `UPSERT verification SET psn_online_id_lower = $lower, psn_online_id = $id, psn_account_id = $account,
         avatar_url = $avatar, code = $code, secret_hash = $secret, expires_at = time::now() + <duration> $ttl
       WHERE psn_online_id_lower = $lower AND expires_at <= time::now()`,
      {
        lower: v.psn_online_id.toLowerCase(),
        id: v.psn_online_id,
        account: v.psn_account_id,
        avatar: v.avatar_url ?? undefined,
        code: v.code,
        secret: v.secret_hash,
        ttl: `${v.minutes}m`,
      },
    )
    return Array.isArray(rows) && rows.length > 0
  } catch (e) {
    // A pending row the WHERE skipped: creating a second one hits the unique index.
    if (/already contains/i.test((e as Error).message ?? '')) return false
    throw e
  }
}

export async function getVerification(onlineId: string): Promise<Verification | undefined> {
  return plain(
    await one<Verification>(
      'SELECT * FROM verification WHERE psn_online_id_lower = $lower AND expires_at > time::now() LIMIT 1',
      { lower: onlineId.toLowerCase() },
    ),
  )
}

/** Sessions and claim codes past their expiry: nothing reads them, so they go. */
export async function pruneExpired(): Promise<void> {
  await q(
    'DELETE auth_session WHERE expires_at < time::now(); DELETE verification WHERE expires_at < time::now();',
  )
}

export async function deleteVerification(onlineId: string): Promise<void> {
  await q('DELETE verification WHERE psn_online_id_lower = $lower', {
    lower: onlineId.toLowerCase(),
  })
}

export async function createSession(user: string, tokenHash: string, days: number): Promise<void> {
  await q(
    'CREATE auth_session SET user = $user, token_hash = $hash, expires_at = time::now() + <duration> $ttl',
    { user: userRef(user), hash: tokenHash, ttl: `${days}d` },
  )
}

export async function sessionUser(tokenHash: string): Promise<string | undefined> {
  const row = plain(
    await one<{ user: string }>(
      'SELECT user FROM auth_session WHERE token_hash = $hash AND expires_at > time::now() LIMIT 1',
      { hash: tokenHash },
    ),
  )
  return row?.user
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await q('DELETE auth_session WHERE token_hash = $hash', { hash: tokenHash })
}

export async function deleteSessionsExcept(user: string, keepHash: string): Promise<void> {
  await q('DELETE auth_session WHERE user = $user AND token_hash != $keep', {
    user: userRef(user),
    keep: keepHash,
  })
}

export async function deleteSessionsOf(user: string): Promise<void> {
  await q('DELETE auth_session WHERE user = $user', { user: userRef(user) })
}
