import { community, communityGames, forgetCommunity, rankings } from '../community.ts'
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
const REACTIONS: ReactionKind[] = ['gg', 'fire', 'skull']

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
    const shown = feed.filter(
      (e) =>
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
        reactions: reactions.get(e.key) ?? { counts: { gg: 0, fire: 0, skull: 0 }, mine: [] },
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
    const ids = [...ranks.platinums, ...ranks.rare, ...ranks.fastest].map((r) => r.user)
    return json(res, 200, { ...ranks, people: peopleOf(members, ids), me: myId(me.id) })
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
    return json(res, 200, r.get(event) ?? { counts: { gg: 0, fire: 0, skull: 0 }, mine: [] })
  },
  // { user, on }: follow a player who shows up in the community, or stop.
  'POST /api/community/follow': async ({ req, res, me }) => {
    if (isDemo(me)) return json(res, 403, { error: 'demo' })
    const { user, on } = await readBody(req)
    if (typeof user !== 'string' || !/^[a-z0-9]{1,40}$/.test(user) || typeof on !== 'boolean')
      return json(res, 400, { error: 'invalid' })
    if (user === myId(me.id)) return json(res, 400, { error: 'self' })
    const { members } = await community()
    if (on && !members.some((m) => m.id === user)) return json(res, 404, { error: 'not_found' })
    await setFollow(myId(me.id), user, on)
    forgetCommunity()
    return json(res, 200, { following: await following(myId(me.id)) })
  },
}
