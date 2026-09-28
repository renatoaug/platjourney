import { plain, q } from '../db.ts'
import type { Game } from './game.ts'
import { gameRef } from './game.ts'
import { userRef } from './user.ts'

export type TipKind = 'start' | 'unlock' | 'chat' | 'session' | 'server' | 'route'
export interface Tip {
  id: string
  kind: TipKind
  content: string
  game: Game | null
  created_at: string
}

// Everything Nexo sends on its own (not a chat answer) is also a notification.
export async function logTip(
  user: string,
  kind: TipKind,
  content: string,
  game?: string,
): Promise<void> {
  await q(
    `LET $tip = (CREATE ONLY tip CONTENT $data);
     IF $tip.kind != 'chat' {
       CREATE notification CONTENT { user: $tip.user, kind: $tip.kind, content: $tip.content, game: $tip.game, tip: $tip.id };
     };`,
    { data: { user: userRef(user), kind, content, ...(game ? { game: gameRef(game) } : {}) } },
  )
}

export async function recentTips(user: string, limit = 30): Promise<Tip[]> {
  return plain(
    await q<Tip[]>(
      'SELECT *, game.* AS game FROM tip WHERE user = $user ORDER BY created_at DESC LIMIT $limit',
      { user: userRef(user), limit },
    ),
  )
}

export interface Notification {
  id: string
  kind: Exclude<TipKind, 'chat'>
  content: string
  game: Game | null
  read_at: string | null
  created_at: string
}

export async function recentNotifications(user: string, limit: number): Promise<Notification[]> {
  return plain(
    await q<Notification[]>(
      'SELECT *, game.* AS game FROM notification WHERE user = $user ORDER BY created_at DESC LIMIT $limit',
      { user: userRef(user), limit },
    ),
  )
}

export async function notificationsPage(
  user: string,
  page: number,
  size: number,
): Promise<{ items: Notification[]; total: number; unread: number }> {
  const [items, count] = await Promise.all([
    q<Notification[]>(
      'SELECT *, game.* AS game FROM notification WHERE user = $user ORDER BY created_at DESC LIMIT $size START $start',
      { user: userRef(user), size, start: (page - 1) * size },
    ).then(plain),
    q<{ total: number; unread: number }[]>(
      'SELECT count() AS total, math::sum(IF read_at = NONE { 1 } ELSE { 0 }) AS unread FROM notification WHERE user = $user GROUP ALL',
      { user: userRef(user) },
    ),
  ])
  return { items, total: count[0]?.total ?? 0, unread: count[0]?.unread ?? 0 }
}

export async function unreadNotifications(user: string): Promise<number> {
  const rows = await q<{ n: number }[]>(
    'SELECT count() AS n FROM notification WHERE user = $user AND read_at = NONE GROUP ALL',
    { user: userRef(user) },
  )
  return rows[0]?.n ?? 0
}

export async function markNotificationsRead(user: string): Promise<void> {
  await q('UPDATE notification SET read_at = time::now() WHERE user = $user AND read_at = NONE', {
    user: userRef(user),
  })
}

// Games whose server closing the user was already warned about.
export async function serverWarnedGames(user: string): Promise<Set<string>> {
  const rows = plain(
    await q<string[]>(
      "SELECT VALUE game FROM notification WHERE user = $user AND kind = 'server' AND game != NONE",
      { user: userRef(user) },
    ),
  )
  return new Set(rows)
}

export type ChatRole = 'user' | 'assistant'
export interface ChatMessage {
  game?: Game | null
  id: string
  role: ChatRole
  content: string
  created_at: string
}

export async function appendMessage(
  user: string,
  role: ChatRole,
  content: string,
  game?: string,
): Promise<void> {
  await q('CREATE message SET user = $user, role = $role, content = $content, game = $game', {
    user: userRef(user),
    role,
    content,
    game: game ? gameRef(game) : undefined,
  })
}

export async function recentMessages(user: string, limit = 20): Promise<ChatMessage[]> {
  const rows = plain(
    await q<ChatMessage[]>(
      'SELECT *, game.* AS game FROM message WHERE user = $user ORDER BY created_at DESC LIMIT $limit',
      { user: userRef(user), limit },
    ),
  )
  return rows.reverse()
}
