import type { IncomingMessage, ServerResponse } from 'node:http'
import { config } from '../config.ts'
import { deepGuideStats } from '../deepguide.ts'
import { isDemo } from '../demo.ts'
import { getCurrent } from '../game-context.ts'
import { defineMessages, fromAcceptLanguage, Language, type Locale, userLocale } from '../i18n.ts'
import type { library } from '../library.ts'
import { secureUrl } from '../psn.ts'
import { pushEnabled } from '../push.ts'
import type { Game } from '../repository/game.ts'
import type { User } from '../repository/user.ts'
import { botInfo } from '../telegram.ts'

// Every route that counts requests answers with the same text when an address goes over.
export const apiMessages = defineMessages({
  [Language.PtBR]: {
    tooManyRequests: 'Muitos pedidos seguidos. Espere um minuto e tente de novo.',
  },
  [Language.En]: {
    tooManyRequests: 'Too many requests in a row. Wait a minute and try again.',
  },
})

// The page sends the language it is showing; without it, the player's saved one, then pt-BR.
export const requestLocale = (req: IncomingMessage, user?: User | null): Locale =>
  fromAcceptLanguage(req.headers['accept-language']) ?? userLocale(user)

// What every app route gets: the request, the signed-in player and the language to answer in.
export interface Api {
  req: IncomingMessage
  res: ServerResponse
  url: URL
  me: User
  locale: Locale
  titles: () => ReturnType<typeof library>
}

export type ApiHandler = (a: Api) => Promise<void> | void

// Game rows carry their embedding (1536 numbers); the browser never needs it.

// What the browser may know about the signed-in user.
export const publicUser = (u: User) => ({
  id: u.id,
  onlineId: u.psn_online_id,
  // Avatars saved before PSN's were moved to https still say http.
  avatarUrl: secureUrl(u.avatar_url),
  telegramLinked: !!u.telegram_chat_id,
  includeDlcProgress: u.include_dlc_progress === true,
  psPlus: u.ps_plus ?? 'none',
  aiNotices: u.ai_notices !== false,
  notifyTelegram: u.notify_telegram !== false,
  // The key a browser subscribes to push with; null when the instance has push off.
  pushKey: pushEnabled() ? config.push.publicKey : null,
  // Whether this instance lets Nexo write notices at all; the profile's switch only shows then.
  aiNoticesAvailable: config.automatic.notices,
  locale: u.locale ?? null,
  demo: isDemo(u),
  // The demo never stores it: each visitor's browser remembers the introduction instead.
  onboarded: !isDemo(u) && !!u.onboarded_at,
})

// The account screen also names the Telegram bot the player is connected to.
export const accountUser = async (u: User) => ({
  ...publicUser(u),
  telegramBot: u.telegram_chat_id ? await botInfo().catch(() => null) : null,
})

// The deep guide's numbers come from the AI service, which the demo never calls.
export const deepGuideOf = (user: User, game: Game) =>
  isDemo(user) ? Promise.resolve(null) : deepGuideStats(game)

// The hero's background: the game's wide picture from the catalog (a 16:9 screenshot). Without one,
// a PS5 trophy list's own art, which is large but of any shape; PS4, PS3 and Vita lists only have a
// small icon that blurs when stretched, so for those the cover at 1080p is the last resort.
export function heroArt(
  game: Pick<Game, 'cover_url' | 'art_url'>,
  title?: { platform: string; iconUrl?: string | null },
) {
  if (game.art_url) return game.art_url
  if (title?.iconUrl && title.platform.includes('PS5')) return title.iconUrl
  const cover = game.cover_url?.replace('/t_cover_big/', '/t_1080p/')
  return cover ?? title?.iconUrl ?? null
}

export async function currentView(user: User, ctx = getCurrent(user)) {
  return (
    ctx && {
      deepGuide: await deepGuideOf(user, ctx.game),
      game: ctx.game,
      name: ctx.title.name,
      platform: ctx.title.platform,
      icon: heroArt(ctx.game, ctx.title),
      progress: ctx.title.progress,
      earned: ctx.title.earned,
      total: ctx.title.total,
      np: ctx.title.npCommunicationId,
      // False for a game outside the library, chosen in the chat to talk about before buying.
      owned: ctx.owned !== false,
      groups: ctx.groups,
      hoursPlayed: ctx.hoursPlayed ?? null,
      guide: ctx.guide,
      // No guide and nothing researching it: it waits in guide_request.
      queued: !ctx.guide && !config.automatic.research,
      trophies: ctx.trophies,
    }
  )
}
