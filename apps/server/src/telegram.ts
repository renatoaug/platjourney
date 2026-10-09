import { config } from './config.ts'
import { defineMessages, Language } from './i18n.ts'

// What the bot answers in the chat itself (linking, unknown commands, failures); index.ts sends them.
export const telegramMessages = defineMessages({
  [Language.PtBR]: {
    notLinked:
      'Ainda não sei quem você é. Entre no PlatJourney pelo navegador, abra Meu perfil e toque em "Conectar Telegram".',
    alreadyLinked: 'Esta conversa já está ligada a {name}. Pode me mandar mensagem por aqui.',
    linkExpired: 'Esse link de conexão expirou. Gere outro em Meu perfil.',
    linked:
      'Tudo certo, {name}! Agora eu acompanho sua jornada por aqui: te aviso quando um troféu cair, quando você começar um jogo novo e quando tiver algo importante pra platina. E pode me chamar a qualquer hora pra tirar dúvida ou pedir uma dica.',
    unknownCommand: 'Não conheço esse comando.',
    failed: 'Deu erro aqui do meu lado. Tenta de novo em um minuto.',
  },
  [Language.En]: {
    notLinked:
      'I don\'t know who you are yet. Sign in to PlatJourney in the browser, open My profile and tap "Connect Telegram".',
    alreadyLinked: "You're already connected as {name}. You can message me here.",
    linkExpired: 'This connection link has expired. Create a new one in My profile.',
    linked:
      "All set, {name}! I'll follow your journey from here: I'll let you know when a trophy pops, when you start a new game and when something matters for the platinum. Message me any time with a question or for a tip.",
    unknownCommand: "I don't know that command.",
    failed: 'Something went wrong on my side. Try again in a minute.',
  },
})

const api = `https://api.telegram.org/bot${config.telegramToken}`

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const request = () =>
    fetch(`${api}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  // Telegram drops idle connections; a request on a stale one fails before it is
  // sent ("socket connection was closed"), so it is safe to try again.
  let res: Response
  try {
    res = await request()
  } catch {
    await new Promise((r) => setTimeout(r, 300))
    res = await request()
  }
  const json = (await res.json()) as { ok: boolean; result: T; description?: string }
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description}`)
  return json.result
}

// Nexo writes light markdown; Telegram wants HTML with escaped text.
function toTelegramHtml(text: string): string {
  return (
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // A cited source: the guide page or the video at its minute (https only, from the guide store).
      .replace(/\[([^\]<]+)\]\((https:\/\/[^\s)"<]+)\)/g, '<a href="$2">$1</a>')
  )
}

export async function sendMessage(chatId: string, text: string): Promise<void> {
  // Telegram caps messages at 4096 chars.
  for (let i = 0; i < text.length; i += 4000) {
    const chunk = text.slice(i, i + 4000)
    await call('sendMessage', {
      chat_id: chatId,
      text: toTelegramHtml(chunk),
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    }).catch(() =>
      // Unbalanced markup makes Telegram reject the message; fall back to plain text.
      call('sendMessage', {
        chat_id: chatId,
        text: chunk,
        link_preview_options: { is_disabled: true },
      }),
    )
  }
}

export async function sendTyping(chatId: string): Promise<void> {
  await call('sendChatAction', { chat_id: chatId, action: 'typing' })
}

let bot: { username: string; name: string } | undefined
export async function botInfo(): Promise<{ username: string; name: string }> {
  if (!bot) {
    const me = await call<{ username: string; first_name: string }>('getMe', {})
    bot = { username: me.username, name: me.first_name }
  }
  return bot
}
export const botUsername = async () => (await botInfo()).username

// The "/" menu. Without a language it is the default; with one, Telegram shows it to
// people whose app is in that language.
export async function setCommands(
  commands: { command: string; description: string }[],
  languageCode?: string,
): Promise<void> {
  await call('setMyCommands', {
    commands,
    ...(languageCode ? { language_code: languageCode } : {}),
  })
}

interface Update {
  update_id: number
  message?: { chat: { id: number }; text?: string; from?: { language_code?: string } }
}

export interface Incoming {
  chatId: string
  text: string
  // The Telegram app's language, for people the bot does not know yet.
  languageCode?: string
}

// Long-polls Telegram and yields every text message; the caller decides who it is from.
export async function* incomingMessages(): AsyncGenerator<Incoming> {
  let offset = 0
  while (true) {
    const updates = await call<Update[]>('getUpdates', { offset, timeout: 30 }).catch((e) => {
      console.error('getUpdates failed:', e.message)
      return [] as Update[]
    })
    for (const u of updates) {
      offset = u.update_id + 1
      const text = u.message?.text
      if (text && u.message)
        yield {
          chatId: String(u.message.chat.id),
          text,
          languageCode: u.message.from?.language_code,
        }
    }
  }
}
