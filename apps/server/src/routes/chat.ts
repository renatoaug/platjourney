import { ai } from '../ai.ts'
import { config } from '../config.ts'
import { tagged } from '../costs.ts'
import { isDemo } from '../demo.ts'
import { getChat, setChat, setChatFromCatalog } from '../game-context.ts'
import { json, readBody } from '../http.ts'
import type { library } from '../library.ts'
import { reply } from '../nexo.ts'
import { allow } from '../rate-limit.ts'
import { chatThreads, recentMessages } from '../repository/activity.ts'
import { getGame, searchCatalog } from '../repository/game.ts'
import type { User } from '../repository/user.ts'
import { chatOrCheck } from '../watcher.ts'
import { type Api, type ApiHandler, currentView } from './api.ts'

// Each game is its own conversation: `?game=game:…` reads that one, `?game=none` the messages
// without a game, and no parameter the current game's.
async function chatMessages({ res, url, me }: Api) {
  const asked = url.searchParams.get('game')
  const game =
    asked === 'none' ? null : asked?.startsWith('game:') ? asked : (getChat(me)?.game.id ?? null)
  return json(res, 200, await recentMessages(me.id, 40, game))
}

async function chatSend({ req, res, me }: Api) {
  const { text } = await readBody(req)
  if (typeof text !== 'string' || !text.trim()) return json(res, 400, { error: 'text required' })
  const ctx = await chatOrCheck(me)
  const response = await reply(me, text.trim().slice(0, config.chat.maxChars), ctx)
  return json(res, 200, {
    text: response,
    messages: await recentMessages(me.id, 40, ctx?.game.id ?? null),
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
  if (isDemo(me)) return json(res, 200, [])
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const current = getChat(me)?.title.npCommunicationId
  const own = await titles()
  const hits = own.filter((ti) => ti.name.toLowerCase().includes(q)).slice(0, 8)
  const mine = hits.map((ti) => ({
    np: ti.npCommunicationId,
    name: ti.name,
    platform: ti.platform,
    icon: ti.iconUrl,
    progress: ti.progress,
    current: ti.npCommunicationId === current,
    owned: true,
  }))
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
