import { guideSummary } from './guide.ts'
import {
  defineMessages,
  fmtRate,
  Language,
  type Locale,
  type MessageKey,
  translator,
  userLocale,
} from './i18n.ts'
import { handleInterestCommand, yearProgress, yearReport } from './interests.ts'
import { library, ownedGames } from './library.ts'
import { nextPick } from './next-pick.ts'
import { planReport, planSession } from './planner.ts'
import { shownProgress } from './progress.ts'
import { rankNextPlatinum } from './ranking.ts'
import { recommendationReport, recommendations } from './recommend.ts'
import { type User, updateUser } from './repository/user.ts'
import { serverReport } from './servers.ts'
import { sendMessage } from './telegram.ts'
import { getChat, setChat } from './watcher.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    help: {
      title: 'Comandos:',
      status: '/status: progresso do jogo atual',
      guide: '/guide: resumo da platina (dificuldade, horas, missables, roadmap)',
      next: '/next: seus jogos mais perto da platina',
      plan: '/plan <minutos>: plano de troféus para a sessão de hoje (ex.: /plan 120)',
      game: '/game <nome>: muda o jogo da conversa',
      goals:
        '/goals: interesses e meta do ano (/goals set 12, /goals add <jogo>, /goals remove <n>, /goals move <n> up|down)',
      recommend: '/recommend: platinas novas pro seu gosto',
      pick: '/pick [o que você tá a fim]: o Nexo escolhe qual dos seus interesses platinar agora (ex.: /pick algo curto)',
      servers: '/servers: alertas de servidor online fechando',
      language: '/language <pt|en>: idioma das mensagens',
      ask: 'Ou só me pergunta qualquer coisa.',
    },
    menu: {
      status: 'Progresso do jogo atual',
      guide: 'Resumo da platina',
      next: 'Jogos mais perto da platina',
      plan: 'Plano de troféus para hoje',
      game: 'Muda o jogo da conversa',
      goals: 'Interesses e meta do ano',
      recommend: 'Platinas novas pro seu gosto',
      pick: 'Qual interesse platinar agora',
      servers: 'Alertas de servidor online',
      language: 'Idioma das mensagens',
      help: 'Comandos',
    },
    welcome:
      'Fala, {name}! Sou o Nexo, do PlatJourney. Fico de olho no que você joga e te ajudo a platinar.',
    notLoaded: 'Ainda não carreguei seu perfil. Tenta em 1 minuto.',
    statusMissing: {
      one: 'Falta {count}. Mais comuns entre os que faltam:',
      other: 'Faltam {count}. Mais comuns entre os que faltam:',
    },
    guideNotReady: 'Ainda não montei o guia de {name}. Tenta de novo em 1 minuto.',
    planUsage: 'Uso: /plan <minutos entre 15 e 600>',
    planBuilding: 'Montando o plano…',
    nextNone: 'Não achei jogo em andamento com platina.',
    pickNone:
      'Salve jogos nos seus interesses (/goals add <jogo>) e eu escolho qual platinar agora.',
    pickResult: '🎯 Sua próxima platina: {name}\n{why}\n\nPor onde começar: {first}',
    pickNoFit:
      'Nenhum dos seus interesses combina direito com isso, esse foi o mais perto. No app, em Descobrir, dá para procurar fora da lista.',
    nextTitle: 'Platinas mais perto (menos esforço restante primeiro):',
    nextItem: {
      one: '{n}. {name}: {progress}%, falta {count} troféu',
      other: '{n}. {name}: {progress}%, faltam {count} troféus',
    },
    nextHint: 'Manda /game <nome> para eu focar em um deles.',
    gameUsage: 'Uso: /game <parte do nome>',
    gameNotFound: 'Não achei "{query}" no seu perfil.',
    gameLoading: 'Carregando {name}…',
    gameGuideReady: 'Guia pronto: manda /guide.',
    gameSwitched: 'Agora falando de {name} ({progress}%).',
    researching: 'Pesquisando…',
    languageUsage: 'Uso: /language pt ou /language en',
    languageSet: 'Pronto, vou falar em português.',
  },
  [Language.En]: {
    help: {
      title: 'Commands:',
      status: '/status: progress in the current game',
      guide: '/guide: platinum summary (difficulty, hours, missables, roadmap)',
      next: '/next: your games closest to the platinum',
      plan: "/plan <minutes>: trophy plan for today's session (e.g. /plan 120)",
      game: '/game <name>: switch the game we talk about',
      goals:
        '/goals: interests and yearly goal (/goals set 12, /goals add <game>, /goals remove <n>, /goals move <n> up|down)',
      recommend: '/recommend: new platinums for your taste',
      pick: '/pick [what you feel like]: Nexo picks which of your interests to platinum now (e.g. /pick something short)',
      servers: '/servers: online servers shutting down',
      language: '/language <pt|en>: language of my messages',
      ask: 'Or just ask me anything.',
    },
    menu: {
      status: 'Progress in the current game',
      guide: 'Platinum summary',
      next: 'Games closest to the platinum',
      plan: 'Trophy plan for today',
      game: 'Switch the game we talk about',
      goals: 'Interests and yearly goal',
      recommend: 'New platinums for your taste',
      pick: 'Which interest to platinum now',
      servers: 'Online server alerts',
      language: 'Language of my messages',
      help: 'Commands',
    },
    welcome:
      "Hey, {name}! I'm Nexo, from PlatJourney. I keep an eye on what you play and help you get the platinum.",
    notLoaded: "I haven't loaded your profile yet. Try again in a minute.",
    statusMissing: {
      one: '{count} left. Most common among them:',
      other: '{count} left. Most common among them:',
    },
    guideNotReady: "I haven't built the guide for {name} yet. Try again in a minute.",
    planUsage: 'Usage: /plan <minutes between 15 and 600>',
    planBuilding: 'Building the plan…',
    nextNone: "I couldn't find a game in progress with a platinum.",
    pickNone:
      'Save games to your interests (/goals add <game>) and I will pick which to platinum now.',
    pickResult: '🎯 Your next platinum: {name}\n{why}\n\nWhere to start: {first}',
    pickNoFit:
      'None of your interests really matches that, this was the closest. In the app, Discover can look beyond your list.',
    nextTitle: 'Closest platinums (least effort left first):',
    nextItem: {
      one: '{n}. {name}: {progress}%, {count} trophy left',
      other: '{n}. {name}: {progress}%, {count} trophies left',
    },
    nextHint: 'Send /game <name> and I will focus on one of them.',
    gameUsage: 'Usage: /game <part of the name>',
    gameNotFound: 'I couldn\'t find "{query}" in your profile.',
    gameLoading: 'Loading {name}…',
    gameGuideReady: 'Guide ready: send /guide.',
    gameSwitched: 'Now talking about {name} ({progress}%).',
    researching: 'Researching…',
    languageUsage: 'Usage: /language pt or /language en',
    languageSet: "Done, I'll talk in English.",
  },
})

// The commands the bot knows, in the order /help lists them and Telegram's menu shows them.
const COMMANDS = [
  'status',
  'guide',
  'next',
  'plan',
  'game',
  'goals',
  'recommend',
  'pick',
  'servers',
  'language',
] as const

export function help(locale: Locale): string {
  const t = translator(messages, locale)
  return [
    t('help.title'),
    ...COMMANDS.map((c) => t(`help.${c}` as MessageKey<typeof messages>)),
    t('help.ask'),
  ].join('\n')
}

// Telegram's command menu, one per language (the client picks by the app's language).
export function commandMenu(locale: Locale): { command: string; description: string }[] {
  const t = translator(messages, locale)
  return [...COMMANDS, 'help' as const].map((command) => ({
    command,
    description: t(`menu.${command}` as MessageKey<typeof messages>),
  }))
}

// What every command handler gets: the player, the text after the command and their chat state.
interface Command {
  user: User
  arg: string
  ctx: ReturnType<typeof getChat>
  locale: Locale
  t: ReturnType<typeof translator<typeof messages>>
  say: (s: string) => ReturnType<typeof sendMessage> | undefined
  titles: () => ReturnType<typeof library>
}

function statusReply({ user, ctx, t }: Command): string {
  if (!ctx) return t('notLoaded')
  const { title, trophies } = ctx
  const shown = shownProgress(user, title, ctx.groups)
  const missing = trophies.filter((tr) => !tr.earned)
  const easiest = [...missing].sort((a, b) => b.earnedRate - a.earnedRate).slice(0, 3)
  return [
    `${title.name}: ${shown.progress}% (${shown.earned}/${shown.total}${shown.label})`,
    t('statusMissing', { count: missing.length }),
    ...easiest.map(
      (tr) => `• ${tr.name}: ${tr.detail} (${fmtRate(userLocale(user), tr.earnedRate)}%)`,
    ),
  ].join('\n')
}

async function planReply({ user, arg, ctx, locale, t, say }: Command): Promise<string> {
  if (!ctx) return t('notLoaded')
  const minutes = Number(arg) || 120
  if (minutes < 15 || minutes > 600) return t('planUsage')
  await say(t('planBuilding'))
  return planReport(await planSession(user, ctx, minutes), locale)
}

async function nextReply({ user, ctx, t, titles }: Command): Promise<string> {
  const skip = ctx ? [ctx.title.npCommunicationId] : []
  const ranked = await rankNextPlatinum(await titles(), user, 8, skip)
  if (ranked.length === 0) return t('nextNone')
  return [
    t('nextTitle'),
    ...ranked.map((r, i) =>
      t('nextItem', {
        n: i + 1,
        name: r.game.name,
        progress: r.baseProgress,
        count: r.remaining,
      }),
    ),
    '',
    t('nextHint'),
  ].join('\n')
}

async function gameReply({ user, arg, t, say, titles }: Command): Promise<string> {
  if (!arg) return t('gameUsage')
  const hit = (await titles()).find((ti) => ti.name.toLowerCase().includes(arg.toLowerCase()))
  if (!hit) return t('gameNotFound', { query: arg })
  await say(t('gameLoading', { name: hit.name }))
  const next = await setChat(user, hit)
  const switched = t('gameSwitched', {
    name: next.title.name,
    progress: shownProgress(user, next.title, next.groups).progress,
  })
  return next.guide ? `${switched} ${t('gameGuideReady')}` : switched
}

async function languageReply({ user, arg, t }: Command): Promise<string> {
  const choice = arg.toLowerCase()
  const next: Locale | undefined = choice.startsWith('pt')
    ? Language.PtBR
    : choice.startsWith('en')
      ? Language.En
      : undefined
  if (!next) return t('languageUsage')
  await updateUser(user.id, { locale: next })
  return translator(messages, next)('languageSet')
}

const HANDLERS: Record<string, (c: Command) => string | Promise<string>> = {
  '/start': ({ user, locale, t }) =>
    `${t('welcome', { name: user.psn_online_id })}\n\n${help(locale)}`,
  '/help': ({ locale }) => help(locale),
  '/status': statusReply,
  '/guide': ({ ctx, locale, t }) => {
    if (!ctx) return t('notLoaded')
    if (!ctx.guide) return t('guideNotReady', { name: ctx.title.name })
    return `${ctx.title.name}\n${guideSummary(ctx.guide, locale)}`
  },
  '/plan': planReply,
  '/next': nextReply,
  '/game': gameReply,
  '/goals': async ({ user, arg, locale, titles }) =>
    arg
      ? handleInterestCommand(user, arg, await titles())
      : yearReport(await yearProgress(user, await titles()), locale),
  '/recommend': async ({ user, arg, locale, t, say, titles }) => {
    await say(t('researching'))
    return recommendationReport(
      await recommendations(
        user,
        await titles(),
        await ownedGames(user.psn_account_id),
        arg === 'refresh',
      ),
      locale,
    )
  },
  // What follows the command is the player's mood: "/pick algo curto".
  '/pick': async ({ user, locale, t, say, titles, arg }) => {
    await say(t('researching'))
    const pick = await nextPick(user, await titles(), locale, { mood: arg || undefined })
    if (!pick) return t('pickNone')
    const text = t('pickResult', { name: pick.game.name, why: pick.why, first: pick.firstStep })
    return pick.fits ? text : `${text}\n\n${t('pickNoFit')}`
  },
  '/servers': async ({ user, titles }) => serverReport(user, await titles()),
  '/language': languageReply,
}

// Returns the reply for a slash command, or undefined when it is not one we know.
export async function handleCommand(user: User, text: string): Promise<string | undefined> {
  const [cmd, ...rest] = text.split(' ')
  const arg = rest.join(' ').trim()
  const ctx = getChat(user)
  const locale = userLocale(user)
  const t = translator(messages, locale)
  const say = (s: string) =>
    user.telegram_chat_id ? sendMessage(user.telegram_chat_id, s) : undefined
  const titles = () => library(user.psn_account_id)
  const handler = Object.hasOwn(HANDLERS, cmd ?? '') ? HANDLERS[cmd ?? ''] : undefined
  return handler?.({ user, arg, ctx, locale, t, say, titles })
}
