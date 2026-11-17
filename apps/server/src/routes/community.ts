import { community, communityGames, forgetCommunity, type RankRow, rankings } from '../community.ts'
import { isDemo } from '../demo.ts'
import { json, readBody } from '../http.ts'
import { secureUrl } from '../psn.ts'
import {
  following,
  type Member,
  type ReactionKind,
  reactionsOn,
  setFollow,
  setReaction,
} from '../repository/community.ts'
import type { ApiHandler } from './api.ts'

const PAGE = 30
// How many players each ranking board lists.
const TOP = 20
const REACTIONS: ReactionKind[] = ['like', 'gg', 'fire', 'wow', 'skull']

const person = (m: Member | undefined) =>
  m ? { id: m.id, onlineId: m.onlineId, avatarUrl: secureUrl(m.avatarUrl) } : null

/** The players the answer names, keyed by id. */
const peopleOf = (all: Member[], ids: string[]) => {
  const byId = new Map(all.map((m) => [m.id, m]))
  return Object.fromEntries(
    [...new Set(ids)].flatMap((id) => {
      const p = person(byId.get(id))
      return p ? [[id, p]] : []
    }),
  )
}

const myId = (id: string) => id.replace(/^user:/, '')

export const COMMUNITY_ROUTES: Record<string, ApiHandler> = {
  // ?scope=all|following|me&before=<iso>: a page of the last 30 days, newest first.
  'GET /api/community/feed': async ({ res, url, me }) => {
    const scope = url.searchParams.get('scope') ?? 'all'
    if (!['all', 'following', 'me'].includes(scope)) return json(res, 400, { error: 'scope' })
    const before = url.searchParams.get('before')
    const { members, feed } = await community()
    const mine = myId(me.id)
    const follows = scope === 'following' ? new Set(await following(mine)) : null
    // A player out of the community is left out for the others, never for themselves.
    const seen = new Set(members.filter((m) => m.visible || m.id === mine).map((m) => m.id))
    const shown = feed.filter(
      (e) =>
        seen.has(e.user) &&
        (!before || e.at < before) &&
        (scope === 'all' || (scope === 'me' ? e.user === mine : follows?.has(e.user))),
    )
    const page = shown.slice(0, PAGE)
    const reactions = await reactionsOn(
      page.map((e) => e.key),
      mine,
    )
    return json(res, 200, {
      events: page.map((e) => ({
        ...e,
        reactions: reactions.get(e.key) ?? {
          counts: { like: 0, gg: 0, fire: 0, wow: 0, skull: 0 },
          mine: [],
        },
      })),
      people: peopleOf(
        members,
        page.map((e) => e.user),
      ),
      following: [...(follows ?? new Set(await following(mine)))],
      next: shown.length > PAGE ? page[page.length - 1].at : null,
      visible: me.community_visible !== false,
    })
  },
  // ?period=month|year
  'GET /api/community/rankings': async ({ res, url, me }) => {
    const period = url.searchParams.get('period') ?? 'month'
    if (period !== 'month' && period !== 'year') return json(res, 400, { error: 'period' })
    const now = new Date()
    const since =
      period === 'month'
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : new Date(now.getFullYear(), 0, 1)
    const [ranks, { members }] = await Promise.all([rankings(since), community()])
    const mine = myId(me.id)
    // The top 20 of each board, and the reader's own place in it wherever it falls.
    const board = (rows: RankRow[]) => {
      const at = rows.findIndex((r) => r.user === mine)
      return { top: rows.slice(0, TOP), mine: at < 0 ? null : { ...rows[at], place: at + 1 } }
    }
    const platinums = board(ranks.platinums)
    const rare = board(ranks.rare)
    const fastest = board(ranks.fastest)
    const ids = [platinums, rare, fastest].flatMap((b) => b.top.map((r) => r.user))
    return json(res, 200, {
      platinums: platinums.top,
      rare: rare.top,
      fastest: fastest.top,
      mine: { platinums: platinums.mine, rare: rare.mine, fastest: fastest.mine },
      people: peopleOf(members, [...ids, mine]),
      me: mine,
    })
  },
  'GET /api/community/games': async ({ res }) => json(res, 200, await communityGames()),
  // { event, kind, on }: one reaction of the player's on a feed event.
  'POST /api/community/react': async ({ req, res, me }) => {
    // The demo saves nothing: it looks at the community without taking part.
    if (isDemo(me)) return json(res, 403, { error: 'demo' })
    const { event, kind, on } = await readBody(req)
    if (
      typeof event !== 'string' ||
      !/^(plat|rare|start|medal):[\w:.-]{1,180}$/.test(event) ||
      !REACTIONS.includes(kind as ReactionKind) ||
      typeof on !== 'boolean'
    )
      return json(res, 400, { error: 'invalid' })
    await setReaction(myId(me.id), event, kind as ReactionKind, on)
    const r = await reactionsOn([event], myId(me.id))
    return json(
      res,
      200,
      r.get(event) ?? { counts: { like: 0, gg: 0, fire: 0, wow: 0, skull: 0 }, mine: [] },
    )
  },
  // { user, on }: follow a player who shows up in the community, or stop.
  'POST /api/community/follow': async ({ req, res, me }) => {
    if (isDemo(me)) return json(res, 403, { error: 'demo' })
    const { user, on } = await readBody(req)
    if (typeof user !== 'string' || !/^[a-z0-9]{1,40}$/.test(user) || typeof on !== 'boolean')
      return json(res, 400, { error: 'invalid' })
    if (user === myId(me.id)) return json(res, 400, { error: 'self' })
    const { members } = await community()
    if (on && !members.some((m) => m.id === user && m.visible))
      return json(res, 404, { error: 'not_found' })
    await setFollow(myId(me.id), user, on)
    forgetCommunity()
    return json(res, 200, { following: await following(myId(me.id)) })
  },
}
