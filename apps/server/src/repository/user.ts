import { camelKeys, one, plain, q, type RecordId, rid, snakeKeys } from '../db.ts'
import type { Locale } from '../i18n.ts'

export interface User {
  id: string // "user:abc"
  psn_online_id: string
  psn_account_id: string
  password_hash: string | null
  avatar_url: string | null
  telegram_chat_id: string | null
  telegram_link_code: string | null
  telegram_link_expires_at?: string | Date | null
  goal_targets: Record<string, number>
  taste_profile: unknown | null
  // The player's own changes to the taste profile and their recommendation rules.
  taste_prefs?: unknown | null
  session_plan: unknown | null
  include_dlc_progress?: boolean
  ps_plus?: 'none' | 'essential' | 'extra' | 'deluxe' | null
  // Nexo's words in automatic notices; off, plain templates (no model).
  ai_notices?: boolean
  locale?: Locale | null
  // The shared, read-only demo player.
  demo?: boolean
  // When the first-visit introduction was finished or skipped.
  onboarded_at?: string | Date | null
  // When the last session-start notice went out.
  session_notice_at?: string | Date | null
  created_at: string
  last_seen_at: string
}

export const userRef = (id: string): RecordId => rid('user', id.replace(/^user:/, ''))

// Objects kept on the user, stored with snake_case keys (AGENTS.md, Database).
const OBJECTS = ['session_plan', 'taste_profile', 'taste_prefs'] as const
function fromRow<T extends User | undefined>(row: T): T {
  if (!row) return row
  const out = { ...row }
  for (const key of OBJECTS) if (out[key]) out[key] = camelKeys(out[key])
  return out
}

export async function getUser(id: string): Promise<User | undefined> {
  return fromRow(plain(await one<User>('SELECT * FROM $id', { id: userRef(id) })))
}

export async function listUsers(): Promise<User[]> {
  return plain(await q<User[]>('SELECT * FROM user ORDER BY created_at')).map(fromRow)
}

export async function userByAccount(accountId: string): Promise<User | undefined> {
  return fromRow(
    plain(
      await one<User>('SELECT * FROM user WHERE psn_account_id = $a LIMIT 1', { a: accountId }),
    ),
  )
}

export async function userByChat(chatId: string): Promise<User | undefined> {
  return fromRow(
    plain(await one<User>('SELECT * FROM user WHERE telegram_chat_id = $c LIMIT 1', { c: chatId })),
  )
}

export async function userByLinkCode(code: string): Promise<User | undefined> {
  return fromRow(
    plain(
      await one<User>(
        'SELECT * FROM user WHERE telegram_link_code = $c AND telegram_link_expires_at > time::now() LIMIT 1',
        { c: code },
      ),
    ),
  )
}

const LINK_CODE_MINUTES = 15

/** A fresh Telegram link code for the user, valid for LINK_CODE_MINUTES. */
export async function setLinkCode(id: string, code: string): Promise<void> {
  await q(
    'UPDATE $id SET telegram_link_code = $code, telegram_link_expires_at = time::now() + <duration> $ttl',
    { id: userRef(id), code, ttl: `${LINK_CODE_MINUTES}m` },
  )
}

/**
 * Links a Telegram chat to the user and spends the link code. A chat belongs to one account: the
 * same transaction takes it off any other user first (the unique index would refuse it otherwise).
 */
export async function linkChat(id: string, chatId: string): Promise<void> {
  await q(
    `BEGIN TRANSACTION;
     UPDATE user SET telegram_chat_id = NONE WHERE telegram_chat_id = $chat AND id != $id;
     UPDATE $id SET telegram_chat_id = $chat, telegram_link_code = NONE, telegram_link_expires_at = NONE;
     COMMIT TRANSACTION;`,
    { id: userRef(id), chat: chatId },
  )
}

export async function createUser(u: {
  psn_online_id: string
  psn_account_id: string
  password_hash?: string
  avatar_url?: string | null
}): Promise<User> {
  const row = await one<User>('CREATE user CONTENT $data RETURN AFTER', {
    data: {
      psn_online_id: u.psn_online_id,
      psn_online_id_lower: u.psn_online_id.toLowerCase(),
      psn_account_id: u.psn_account_id,
      ...(u.password_hash ? { password_hash: u.password_hash } : {}),
      ...(u.avatar_url ? { avatar_url: u.avatar_url } : {}),
    },
  })
  return plain(row as User)
}

// Sets fields on the user; `null` clears an optional field.
export async function updateUser(id: string, fields: Partial<Omit<User, 'id'>>): Promise<void> {
  const set: string[] = []
  const vars: Record<string, unknown> = { id: userRef(id) }
  // The unique index is on the lowercase id: a rename moves it too, or the old name stays taken.
  const all =
    typeof fields.psn_online_id === 'string'
      ? { ...fields, psn_online_id_lower: fields.psn_online_id.toLowerCase() }
      : fields
  for (const [key, value] of Object.entries(all)) {
    if (!/^[a-z_]+$/.test(key)) continue
    if (value === null) set.push(`${key} = NONE`)
    else {
      set.push(`${key} = $${key}`)
      vars[key] = (OBJECTS as readonly string[]).includes(key) ? snakeKeys(value) : value
    }
  }
  if (set.length) await q(`UPDATE $id SET ${set.join(', ')}`, vars)
}

export async function touchUser(id: string): Promise<void> {
  await q('UPDATE $id SET last_seen_at = time::now()', { id: userRef(id) })
}

// Everything personal the account has gathered. Used when the owner of the PSN
// profile takes the account over and asks for a clean start.
export async function wipeUserData(id: string): Promise<void> {
  const user = userRef(id)
  for (const table of [
    'title',
    'interest',
    'platinum',
    'recommendation',
    'dismissal',
    'tip',
    'message',
    'playtime',
  ])
    await q(`DELETE ${table} WHERE user = $user`, { user })
  await q('UPDATE $user SET goal_targets = {}, taste_profile = NONE, session_plan = NONE', { user })
}

export async function deleteUser(id: string): Promise<void> {
  await q('DELETE $user', { user: userRef(id) })
}
