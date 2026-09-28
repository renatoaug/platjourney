import { q } from '../db.ts'
import { userRef } from './user.ts'

export async function recordAccess(user: string, ipHash: string): Promise<void> {
  await q(
    `UPSERT access SET user = $user, ip_hash = $ip, count = (count ?? 0) + 1
     WHERE user = $user AND ip_hash = $ip`,
    { user: userRef(user), ip: ipHash },
  )
}

export async function deleteAccesses(user: string): Promise<void> {
  await q('DELETE access WHERE user = $user', { user: userRef(user) })
}

export async function deleteAccessesBefore(days: number): Promise<void> {
  await q('DELETE access WHERE updated_at < time::now() - type::duration($age)', {
    age: `${days}d`,
  })
}
