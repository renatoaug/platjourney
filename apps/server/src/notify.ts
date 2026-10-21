// Where a notice goes once it is written: the linked Telegram chat, when the player kept it on, and
// every device that turned push on. The web history already has it (logTip) before this runs.
import { pushTo } from './push.ts'
import type { User } from './repository/user.ts'
import { sendMessage } from './telegram.ts'

/** The screen a tapped notification opens: the history, where every notice is kept. */
const HISTORY = '/history'

/** Notices are written in markdown for Telegram; a push notification shows plain text. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-*] /gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// A push message travels encrypted in about 4 KB; the notification shows a few lines anyway.
const PUSH_CHARS = 900

/**
 * Sends a notice to every channel the player has. A channel that fails is logged and never stops
 * the others, nor the sweep that wrote the notice.
 */
export async function deliver(
  user: Pick<User, 'id' | 'psn_online_id' | 'telegram_chat_id' | 'notify_telegram'>,
  text: string,
): Promise<void> {
  if (user.telegram_chat_id && user.notify_telegram !== false)
    await sendMessage(user.telegram_chat_id, text).catch((e) =>
      console.warn(
        `${user.psn_online_id}: telegram send failed:`,
        (e as Error).message.slice(0, 80),
      ),
    )
  const body = plainText(text)
  await pushTo(user, {
    title: 'Nexo',
    body: body.length > PUSH_CHARS ? `${body.slice(0, PUSH_CHARS - 1)}…` : body,
    url: HISTORY,
  }).catch((e) =>
    console.warn(`${user.psn_online_id}: push failed:`, (e as Error).message.slice(0, 80)),
  )
}
