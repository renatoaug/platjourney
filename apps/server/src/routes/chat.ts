import { ai } from '../ai.ts'
import { config } from '../config.ts'
import { tagged } from '../costs.ts'
import { isDemo } from '../demo.ts'
import { getChat, getCurrent, setChat, setChatFromCatalog } from '../game-context.ts'
import { json, readBody } from '../http.ts'
import { defineMessages, Language, translator, userLocale } from '../i18n.ts'
import type { library } from '../library.ts'
import type { GameContext } from '../nexo.ts'
import { reply } from '../nexo.ts'
import { nextPick } from '../next-pick.ts'
import { shownProgress } from '../progress.ts'
import { loadGroups } from '../ranking.ts'
import { allow } from '../rate-limit.ts'
import {
  appendMessage,
  type ChatMessage,
  chatThreads,
  type GameCard,
  logTip,
  recentMessages,
} from '../repository/activity.ts'
import { gamesForTitles, getGame, searchCatalog } from '../repository/game.ts'
import { guideFacts } from '../repository/similar.ts'
import type { User } from '../repository/user.ts'
import { chatOrCheck } from '../watcher.ts'
import { type Api, type ApiHandler, currentView } from './api.ts'

// A trophy named in a question, in bold as the app writes it or by a name of several words, puts its
// card on the answer. It reads the trophies as they are now, so a card follows what the player
// earned, and a hidden trophy has no card until the player reveals that game's hidden trophies.
const named = (text: string, name?: string) => {
  const key = name?.trim().toLocaleLowerCase()
  if (!key) return false
  const lower = text.toLocaleLowerCase()
  return lower.includes(`**${key}**`) || (key.includes(' ') && lower.includes(key))
}

export function withTrophyCards(messages: ChatMessage[], user: User, ctx?: GameContext) {
  if (!ctx) return messages
  const visible = ctx.trophies.filter(
    (t) => !t.hidden || t.earned || user.revealed_trophy_games?.includes(ctx.game.id),
  )
  return messages.map((message, i) => {
    const asked = messages[i - 1]
    if (message.role !== 'assistant' || asked?.role !== 'user') return message
    if (message.game?.id !== ctx.game.id) return message
    const found = visible.filter(
      (t) => named(asked.content, t.name) || named(asked.content, t.nameEn),
    )
    // A question naming several trophies has no single trophy to show.
    if (found.length !== 1) return message
    const t = found[0]
    return {
      ...message,
      trophy: {
        id: t.id,
        name: t.name,
        detail: t.detail ?? null,
        type: t.type,
        iconUrl: t.iconUrl ?? null,
        earned: t.earned,
        rarity: t.earnedRate || null,
      },
    }
  })
}

// Each game is its own conversation: `?game=game:…` reads that one, `?game=none` the messages
// without a game, and no parameter the current game's.
async function chatMessages({ res, url, me }: Api) {
  const asked = url.searchParams.get('game')
  const game =
    asked === 'none' ? null : asked?.startsWith('game:') ? asked : (getChat(me)?.game.id ?? null)
  const context = getChat(me)
  const list = await recentMessages(me.id, 40, game)
  return json(res, 200, context?.game.id === game ? withTrophyCards(list, me, context) : list)
}

const messages = defineMessages({
  [Language.PtBR]: { firstStep: '**Primeiro passo:** {step}' },
  [Language.En]: { firstStep: '**First step:** {step}' },
})

// The player asking what to go for next, in their words: it gets the real recommendation, with the
// game's card, instead of an answer the chat could only write from the game it is about.
const ASKS_PICK =
  /\b(o que|qual( jogo)?|que jogo)\b.*\b(platinar|jogar)\b|\bproxima platina\b|\bwhat\b.*\b(platinum|play)\b|\b(which|next) (game|platinum)\b/
const asksNextPick = (text: string) =>
  !text.includes('**') &&
  ASKS_PICK.test(
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase(),
  )

// Nexo's normal recommendation, charged and recorded as one: among the saved games, or any game
// when there is none to choose from. Null when nothing can be picked, and the chat answers instead.
async function pickAnswer(me: User, text: string, titles: Api['titles'], game?: string) {
  const library = await titles()
  const locale = userLocale(me)
  const pick =
    (await nextPick(me, library, locale, { scope: 'interests' })) ??
    (await nextPick(me, library, locale, { scope: 'any' }))
  if (!pick) return null
  const [full, facts] = await Promise.all([getGame(pick.game.id), guideFacts([pick.game.id])])
  const own = full?.np_communication_ids?.length
    ? library.find((t) => full.np_communication_ids.includes(t.npCommunicationId))
    : undefined
  const card: GameCard = {
    kind: 'game',
    game: pick.game.id,
    name: pick.game.name,
    coverUrl: full?.cover_url ?? pick.game.cover_url ?? null,
    artUrl: full?.art_url ?? null,
    difficulty: facts[0]?.difficulty || null,
    hours: facts[0]?.hours || null,
    progress: own ? own.progress : null,
  }
  const t = translator(messages, me)
  const answer = [pick.why, pick.firstStep ? t('firstStep', { step: pick.firstStep }) : '']
    .filter(Boolean)
    .join('\n\n')
  await appendMessage(me.id, 'user', text, game)
  await appendMessage(me.id, 'assistant', answer, game, card)
  await logTip(me.id, 'chat', answer, game)
  return answer
}

async function chatSend({ req, res, me, titles }: Api) {
  const { text } = await readBody(req)
  if (typeof text !== 'string' || !text.trim()) return json(res, 400, { error: 'text required' })
  const ctx = await chatOrCheck(me)
  const question = text.trim().slice(0, config.chat.maxChars)
  const picked = asksNextPick(question)
    ? await pickAnswer(me, question, titles, ctx?.game.id)
    : null
  const response = picked ?? (await reply(me, question, ctx))
  return json(res, 200, {
    text: response,
    messages: withTrophyCards(await recentMessages(me.id, 40, ctx?.game.id ?? null), me, ctx),
  })
}

// The chat's mic: the recorded question becomes text in the box, for the player to read and send.
// The model is told the names it will hear (Nexo, the game, its trophies, missing ones first),
// which a phone's or a browser's own recognizer spells by ear.
const MAX_AUDIO_BODY = 2_000_000
const VOICE_WORDS = 80
const VOICE_PER_HOUR = 60

async function transcribe({ req, res, me }: Api) {
  if (isDemo(me)) return json(res, 403, { error: 'demo' })
  if (!allow(`voice|${me.id}`, VOICE_PER_HOUR, 60 * 60_000))
    return json(res, 429, { error: 'too many recordings' })
  const { audio, mime } = await readBody(req, MAX_AUDIO_BODY)
  if (typeof audio !== 'string' || !audio || typeof mime !== 'string')
    return json(res, 400, { error: 'audio required' })
  const ctx = getChat(me)
  const trophies = [...(ctx?.trophies ?? [])].sort((a, b) => Number(a.earned) - Number(b.earned))
  const words = [
    'Nexo',
    ...(ctx ? [ctx.game.name] : []),
    ...trophies.map((t) => (me.locale === 'en' ? (t.nameEn ?? t.name) : t.name)),
  ].slice(0, VOICE_WORDS)
  const { text } = await tagged({ user: me.id, action: 'transcribe' }, () =>
    ai<{ text: string }>('/voice/transcribe', {
      audio,
      mime,
      locale: me.locale === 'en' ? 'en' : 'pt-BR',
      words,
    }),
  )
  return json(res, 200, { text })
}

// The chat's game, as /game in Telegram: the player's own titles, searched by name, and the
// switch, which loads that game's context for the chat and the notices alike.
async function librarySearch({ res, url, me, titles }: Api) {
  if (isDemo(me) && url.searchParams.get('scope') !== 'owned') return json(res, 200, [])
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const current = getChat(me)?.title.npCommunicationId
  const own = await titles()
  // The Games page is the personal PSN library, not the chat's mixed catalog search.
  if (url.searchParams.get('scope') === 'owned') {
    const size = 12
    const hits = own.filter((ti) => ti.name.toLowerCase().includes(q))
    const requested = Number(url.searchParams.get('page') ?? 1)
    const page = Math.min(
      Number.isSafeInteger(requested) && requested > 0 ? requested : 1,
      Math.max(1, Math.ceil(hits.length / size)),
    )
    const visible = hits.slice((page - 1) * size, page * size)
    const art = await gamesForTitles(visible, false)
    const playing = getCurrent(me)?.title.npCommunicationId
    return json(res, 200, {
      items: await Promise.all(
        visible.map(async (ti) => {
          const groups = await loadGroups(ti, me)
          const { earned, total, progress } = shownProgress(me, ti, groups)
          return {
            np: ti.npCommunicationId,
            name: ti.name,
            platform: ti.platform,
            icon: ti.iconUrl,
            cover: art.get(ti.npCommunicationId)?.cover_url ?? null,
            art: art.get(ti.npCommunicationId)?.art_url ?? null,
            progress,
            earned,
            total,
            progressScope: !groups ? 'psn' : me.include_dlc_progress && groups.dlc ? 'all' : 'base',
            platinum: ti.earnedByType.platinum > 0,
            current: ti.npCommunicationId === playing,
            owned: true,
          }
        }),
      ),
      total: hits.length,
      page,
      size,
    })
  }
  const hits = own.filter((ti) => ti.name.toLowerCase().includes(q)).slice(0, 8)
  const mine = await Promise.all(
    hits.map(async (ti) => ({
      np: ti.npCommunicationId,
      name: ti.name,
      platform: ti.platform,
      icon: ti.iconUrl,
      progress: shownProgress(me, ti, await loadGroups(ti, me)).progress,
      current: ti.npCommunicationId === current,
      owned: true,
    })),
  )
  const others = q.length < 2 || mine.length >= 8 ? [] : await notOwned(me, q, own, 8 - mine.length)
  return json(res, 200, [...mine, ...others])
}

// Then games outside the library, to talk about one before buying it.
async function notOwned(
  me: User,
  q: string,
  own: Awaited<ReturnType<typeof library>>,
  room: number,
) {
  const owned = new Set(own.map((ti) => ti.npCommunicationId))
  const currentGame = getChat(me)?.game.id
  return (await searchCatalog(q))
    .filter((g) => g.np_communication_ids?.length)
    .filter((g) => !g.np_communication_ids.some((np) => owned.has(np)))
    .slice(0, room)
    .map((g) => ({
      game: g.id,
      name: g.name,
      platform: g.platforms?.[0] ?? '',
      icon: g.cover_url ?? null,
      progress: null,
      current: g.id === currentGame,
      owned: false,
    }))
}

async function switchCurrent({ req, res, me, titles }: Api) {
  if (isDemo(me)) return json(res, 403, { error: 'demo' })
  const { np, game } = await readBody(req)
  const own = await titles()
  // A catalog game the player owns after all is switched to through its title, with progress.
  const found =
    typeof game === 'string' && game.startsWith('game:') ? await getGame(game) : undefined
  const hit = own.find(
    (ti) =>
      ti.npCommunicationId === np || found?.np_communication_ids?.includes(ti.npCommunicationId),
  )
  if (hit)
    return json(res, 200, { current: (await currentView(me, await setChat(me, hit))) ?? null })
  if (!found) return json(res, 404, { error: 'title not found' })
  const ctx = await setChatFromCatalog(me, found)
  if (!ctx) return json(res, 404, { error: 'no trophy list' })
  return json(res, 200, { current: (await currentView(me, ctx)) ?? null })
}

// The chat with Nexo and the game it talks about.
export const CHAT_ROUTES: Record<string, ApiHandler> = {
  'GET /api/chat': chatMessages,
  'GET /api/chat/threads': async ({ res, me }) => json(res, 200, await chatThreads(me.id)),
  'POST /api/chat': chatSend,
  'POST /api/chat/transcribe': transcribe,
  'GET /api/library': librarySearch,
  'POST /api/current': switchCurrent,
}
