import { q } from '../db.ts'
import { userRef } from './user.ts'

// Cost rows are kept when an account is deleted, without the link to it.
export async function detachCalls(user: string): Promise<void> {
  await q('UPDATE llm_call SET user = NONE WHERE user = $user', { user: userRef(user) })
}
