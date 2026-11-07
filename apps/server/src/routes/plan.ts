import { getCurrent } from '../game-context.ts'
import type { Guide } from '../guide.ts'
import { json, readBody } from '../http.ts'
import { trophyHelp } from '../nexo.ts'
import { currentPlan, discardPlan, PLAN_REASONS, type PlanReason, planSession } from '../planner.ts'
import { hours, playtimes } from '../playtime.ts'
import { projectGame } from '../plugins.ts'
import { titleTrophies } from '../psn.ts'
import { loadGroups } from '../ranking.ts'
import { gameForTitle } from '../repository/game.ts'
import { getGuide } from '../repository/guide.ts'
import { setPlanReason } from '../repository/session-plan.ts'
import type { Api, ApiHandler } from './api.ts'

// Explicitly choosing a game never changes PSN presence or the chat's selected game.
async function planContext(a: Api, np: unknown) {
  if (np === undefined || np === null) return getCurrent(a.me)
  if (typeof np !== 'string' || !np) return null
  const title = (await a.titles()).find((t) => t.npCommunicationId === np)
  if (!title) return null
  const playing = getCurrent(a.me)
  if (playing?.title.npCommunicationId === np) return playing
  const game = await gameForTitle(title)
  const [trophies, groups, guide] = await Promise.all([
    titleTrophies(title, a.me.psn_account_id),
    loadGroups(title, a.me),
    getGuide<Guide>(game.id),
  ])
  return { game, title, trophies, groups, guide }
}

async function newPlan(a: Api) {
  const { minutes, np } = await readBody(a.req)
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 15 || minutes > 600)
    return json(a.res, 400, { error: 'minutes must be between 15 and 600' })
  const ctx = await planContext(a, np)
  if (!ctx) return json(a.res, np == null ? 409 : 404, { error: 'game not available' })
  return json(a.res, 200, { plan: await planSession(a.me, ctx, minutes) })
}

async function trophyTip({ req, res, me, titles }: Api) {
  const { np, trophyId } = await readBody(req)
  if (typeof np !== 'string' || typeof trophyId !== 'number')
    return json(res, 400, { error: 'np and trophyId required' })
  const title = (await titles()).find((t) => t.npCommunicationId === np)
  if (!title) return json(res, 404, { error: 'title not in your library' })
  const [trophies, groups, game] = await Promise.all([
    titleTrophies(title, me.psn_account_id),
    loadGroups(title, me),
    gameForTitle(title),
  ])
  const trophy = trophies.find((t) => t.id === trophyId)
  if (!trophy) return json(res, 404, { error: 'trophy not found' })
  if (trophy.earned) return json(res, 409, { error: 'trophy already earned' })
  const guide = await getGuide<Guide>(game.id)
  const ctx = {
    game,
    title,
    trophies,
    groups,
    guide,
    hoursPlayed: hours((await playtimes(me)).get(game.id)),
  }
  return json(res, 200, { text: await trophyHelp(me, ctx, trophy) })
}

// The session plan and the help for one trophy, both for the game being played.
export const PLAN_ROUTES: Record<string, ApiHandler> = {
  'GET /api/plan': async (a) => {
    const ctx = await planContext(a, a.url.searchParams.get('np'))
    if (!ctx && a.url.searchParams.has('np'))
      return json(a.res, 404, { error: 'game not available' })
    const value = { plan: await currentPlan(a.me, ctx ?? undefined) }
    return json(
      a.res,
      200,
      ctx ? await projectGame({ user: a.me, game: ctx.game.id, surface: 'session' }, value) : value,
    )
  },
  // The answer says which plan closed and whether to ask why (no step was done).
  'DELETE /api/plan': async (a) => {
    const { res, me } = a
    const ctx = await planContext(a, a.url.searchParams.get('np'))
    if (!ctx && a.url.searchParams.has('np')) return json(res, 404, { error: 'game not available' })
    if (!(await currentPlan(me, ctx ?? undefined))) return json(res, 409, { error: 'plan changed' })
    const closed = await discardPlan(me, ctx ?? undefined)
    return json(res, 200, {
      plan: null,
      closed: closed?.id ?? null,
      askReason: closed?.askReason ?? false,
    })
  },
  'POST /api/plan/reason': async ({ req, res, me }) => {
    const { id, reason } = await readBody(req)
    if (typeof id !== 'string' || !PLAN_REASONS.includes(reason as PlanReason))
      return json(res, 400, { error: 'id and a known reason required' })
    if (!(await setPlanReason(me.id, id, reason as PlanReason)))
      return json(res, 404, { error: 'no closed plan of yours with that id' })
    return json(res, 200, { ok: true })
  },
  'POST /api/plan': newPlan,
  'POST /api/trophy-tip': trophyTip,
}
