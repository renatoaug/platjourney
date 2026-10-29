import { isDemo, storedSummary } from '../demo.ts'
import { demoContext, getChat, getCurrent } from '../game-context.ts'
import { json } from '../http.ts'
import { yearProgress } from '../interests.ts'
import { library } from '../library.ts'
import { hours, playtimes } from '../playtime.ts'
import { profileSummary } from '../psn.ts'
import { rankNextPlatinum } from '../ranking.ts'
import {
  markNotificationsRead,
  notificationsPage,
  recentTips,
  tipsBefore,
  unreadNotifications,
} from '../repository/activity.ts'
import { listServerStatuses } from '../repository/server-status.ts'
import { type GuideFacts, guideFacts } from '../repository/similar.ts'
import type { User } from '../repository/user.ts'
import { tints } from '../tint.ts'
import { watchNow } from '../watcher.ts'
import { type Api, type ApiHandler, currentView, heroArt } from './api.ts'

const summaries = new Map<
  string,
  { at: number; data: Awaited<ReturnType<typeof profileSummary>> }
>()
async function profile(user: User) {
  const cached = summaries.get(user.id)
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.data
  const data = isDemo(user)
    ? storedSummary(user, await library(user.psn_account_id))
    : await profileSummary(user.psn_account_id, user.psn_online_id)
  summaries.set(user.id, { at: Date.now(), data })
  return data
}

/** Drops the cached PSN summary of a player, as when the account is deleted. */
export const forgetSummary = (id: string) => summaries.delete(id)

type Ranked = Awaited<ReturnType<typeof rankNextPlatinum>>[number]

function rankingRow(
  r: Ranked,
  played: Awaited<ReturnType<typeof playtimes>>,
  facts: Map<string, GuideFacts>,
  tinted: Map<string, string>,
) {
  const f = facts.get(r.game.id)
  const known = (v: unknown) => (typeof v === 'number' && v > 0 ? v : null)
  return {
    game: r.game.id,
    name: r.game.name,
    platform: r.title.platform,
    icon: r.title.iconUrl,
    cover: r.game.cover_url,
    // The wide picture and the color the console home paints behind the game.
    art: heroArt(r.game, r.title),
    tint: tinted.get(r.game.id) ?? null,
    progress: r.baseProgress,
    remaining: r.remaining,
    hours: hours(played.get(r.game.id)),
    total: r.groups?.base.total ?? r.title.total,
    earned: r.groups?.base.earned ?? r.title.earned,
    dlc: r.groups?.dlc ? { earned: r.groups.dlc.earned, total: r.groups.dlc.total } : null,
    // The guide's estimate and difficulty, when the game has a guide that says them.
    guideHours: known(f?.hours),
    difficulty: known(f?.difficulty),
  }
}

async function state({ res, me, titles }: Api) {
  const list = await titles()
  const played = await playtimes(me)
  // The demo's context comes from the database at once; a real player's waits for PSN.
  const ctx = getCurrent(me) ?? (isDemo(me) ? await demoContext(me) : undefined)
  if (!ctx) watchNow(me)
  const ranked = await rankNextPlatinum(list, me, 20, ctx ? [ctx.title.npCommunicationId] : [])
  const facts = new Map(
    (await guideFacts(ranked.map((r) => r.game.id))).map((f) => [String(f.game), f]),
  )
  const tinted = await tints(ranked.map((r) => r.game))
  return json(res, 200, {
    profile: await profile(me),
    // null, not missing: the web app reads a missing game as still loading.
    current: (await currentView(me, ctx)) ?? null,
    // The chat's own game when the player picked another one there; null when it is the game played.
    chat:
      getChat(me) && getChat(me) !== ctx ? ((await currentView(me, getChat(me))) ?? null) : null,
    tips: await recentTips(me.id, 50),
    unread: await unreadNotifications(me.id),
    ranking: ranked.map((r) => rankingRow(r, played, facts, tinted)),
    goals: await yearProgress(me, list, undefined, played),
    servers: (await listServerStatuses(ranked.map((r) => r.game.id))).filter(
      (s) => s.status !== 'unknown',
    ),
  })
}

// The home screen and the notices: what the player has, and what Nexo said.
export const HOME_ROUTES: Record<string, ApiHandler> = {
  'GET /api/state': state,
  'GET /api/tips': async ({ res, url, me }) => {
    const before = new Date(url.searchParams.get('before') ?? '')
    if (Number.isNaN(before.getTime())) return json(res, 400, { error: 'before' })
    return json(res, 200, await tipsBefore(me.id, before, 30))
  },
  'GET /api/notifications': async ({ res, url, me }) => {
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const size = Math.min(30, Math.max(1, Number(url.searchParams.get('size')) || 8))
    return json(res, 200, { page, size, ...(await notificationsPage(me.id, page, size)) })
  },
  'POST /api/notifications/read': async ({ res, me }) => {
    await markNotificationsRead(me.id)
    return json(res, 200, { ok: true })
  },
}
