import { startAccessCleanup } from './access.ts'
import { commandMenu, handleCommand, help } from './commands.ts'
import { config } from './config.ts'
import { migrate } from './db.ts'
import {
  DEFAULT_LOCALE,
  fromLanguage,
  Language,
  type Locale,
  translator,
  userLocale,
} from './i18n.ts'
import { reply } from './nexo.ts'
import { loadPlugins, Refused } from './plugins.ts'
import { updateUser, userByChat, userByLinkCode } from './repository/user.ts'
import {
  incomingMessages,
  sendMessage,
  sendTyping,
  setCommands,
  telegramMessages,
} from './telegram.ts'
import { getCurrent, startWatcher } from './watcher.ts'
import { startWeb } from './web.ts'

// "/start <code>" arrives when someone opens the link from their profile page.
async function link(chatId: string, code: string, fallback: Locale): Promise<string> {
  const user = await userByLinkCode(code)
  if (!user) {
    const linked = await userByChat(chatId)
    return linked
      ? translator(telegramMessages, linked)('alreadyLinked', { name: linked.psn_online_id })
      : translator(telegramMessages, fallback)('linkExpired')
  }
  await updateUser(user.id, { telegram_chat_id: chatId, telegram_link_code: null })
  const locale = userLocale(user)
  return `${translator(telegramMessages, locale)('linked', { name: user.psn_online_id })}\n\n${help(locale)}`
}

// pm2's Bun wrapper loads this file with require(), so no top-level await here.
async function main(): Promise<void> {
  await migrate()
  await loadPlugins()
  console.log(`platjourney up — sweeping users every ${config.pollMinutes} min`)
  startWatcher(config.pollMinutes)
  startWeb()
  startAccessCleanup()
  // English is the default menu; Portuguese apps get theirs.
  Promise.all([
    setCommands(commandMenu(Language.En)),
    setCommands(commandMenu(Language.PtBR), 'pt'),
  ]).catch((e) => console.warn('telegram commands not set:', (e as Error).message))

  for await (const { chatId, text, languageCode } of incomingMessages()) {
    // Before we know who it is, answer in the language of their Telegram app.
    let locale: Locale = languageCode ? fromLanguage(languageCode) : DEFAULT_LOCALE
    try {
      const startCode = /^\/start\s+(\S+)/.exec(text)?.[1]
      if (startCode) {
        await sendMessage(chatId, await link(chatId, startCode, locale))
        continue
      }
      const user = await userByChat(chatId)
      if (!user) {
        await sendMessage(chatId, translator(telegramMessages, locale)('notLinked'))
        continue
      }
      locale = userLocale(user)
      if (text.startsWith('/')) {
        const out = await handleCommand(user, text)
        await sendMessage(
          chatId,
          out ?? `${translator(telegramMessages, locale)('unknownCommand')}\n\n${help(locale)}`,
        )
        continue
      }
      await sendTyping(chatId)
      await sendMessage(
        chatId,
        await reply(user, text.slice(0, config.chat.maxChars), getCurrent(user)),
      )
    } catch (e) {
      // A plugin refused the model work: its message says why and what to do.
      if (e instanceof Refused) {
        await sendMessage(chatId, e.message)
        continue
      }
      console.error('handler failed:', e)
      await sendMessage(chatId, translator(telegramMessages, locale)('failed'))
    }
  }
}

main().catch((e) => {
  console.error('fatal:', e)
  process.exit(1)
})
