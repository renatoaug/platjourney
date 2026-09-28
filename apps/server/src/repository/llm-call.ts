import { q } from '../db.ts'
import { userRef } from './user.ts'

export interface LlmCall {
  user: string | null
  action: string
  model: string
  input_tokens: number
  cached_tokens: number
  output_tokens: number
  web_searches: number
  cost_usd: number
  ms: number
  created_at: string
}

// Cost rows are kept when an account is deleted, without the link to it.
export async function detachCalls(user: string): Promise<void> {
  await q('UPDATE llm_call SET user = NONE WHERE user = $user', { user: userRef(user) })
}
