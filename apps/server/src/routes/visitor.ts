import type { IncomingMessage, ServerResponse } from 'node:http'
import { clientIp } from '../access.ts'
import { communityGames } from '../community.ts'
import { isDemo } from '../demo.ts'
import { json } from '../http.ts'
import { translator } from '../i18n.ts'
import { storeFor } from '../interests.ts'
import { library } from '../library.ts'
import { withPlayerSteps } from '../player-steps.ts'
import { type ProfilePage, profilePage } from '../profile.ts'
import { catalogTrophies } from '../psn.ts'
import { allow } from '../rate-limit.ts'
import { getGame } from '../repository/game.ts'
import { getGuide } from '../repository/guide.ts'
import { userByOnlineId } from '../repository/user.ts'
import { similarToGame } from '../similar.ts'
import { withTints } from '../tint.ts'
import { apiMessages, heroArt, requestLocale } from './api.ts'
import { guides } from './games.ts'

// What someone without an account may read: the pages a shared link, a search result or the
// landing opens. A player's profile (when they show up in the community), a game's page with its
// stored guide, the guides and what the community plays. Only reads: no guide is researched, no
// game is looked up on IGDB, and a profile is fetched from PSN at most once every few minutes.

interface Visit {
  req: IncomingMessage
  res: ServerResponse
  url: URL
}

type VisitorHandler = (v: Visit) => Promise<void>

// Each address gets its own budget, apart from the one shared with signed-in routes.
const VISITS_PER_MINUTE = 60

// A profile someone shares is opened by many at once: one PSN read serves them all for a while.
const PROFILE_TTL_MS = 10 * 60_000
const MAX_PROFILES = 500
const profiles = new Map<string, { at: number; page: Promise<ProfilePage> }>()

/** For tests: forgets the profiles read. */
export const forgetVisitorProfiles = () => profiles.clear()

function cachedProfile(key: string, read: () => Promise<ProfilePage>): Promise<ProfilePage> {
  const now = Date.now()
  const hit = profiles.get(key)
  if (hit && now - hit.at < PROFILE_TTL_MS) return hit.page
  if (profiles.size >= MAX_PROFILES)
    for (const [k, v] of profiles) if (now - v.at >= PROFILE_TTL_MS) profiles.delete(k)
  // Still full of fresh ones: the oldest goes.
  if (profiles.size >= MAX_PROFILES) profiles.delete(profiles.keys().next().value as string)
  const page = read()
  profiles.set(key, { at: now, page })
  // A failed read is not kept: the next visitor tries again.
  page.catch(() => profiles.delete(key))
  return page
}

async function profile({ res, url }: Visit) {
  const name = url.searchParams.get('user') ?? ''
  if (!/^[A-Za-z0-9_-]{3,16}$/.test(name)) return json(res, 400, { error: 'invalid' })
  const player = await userByOnlineId(name)
  if (!player || isDemo(player) || player.community_visible === false)
    return json(res, 404, { error: 'not_found' })
  return json(
    res,
    200,
    await cachedProfile(player.id, async () =>
      profilePage(await library(player.psn_account_id), player),
    ),
  )
}

// The catalog game asked for, as `game:<id>`; links carry it with or without the table.
function gameId(url: URL): string | null {
  const id = url.searchParams.get('game') ?? ''
  if (!/^(game:)?[\w-]{1,60}$/.test(id)) return null
  return id.startsWith('game:') ? id : `game:${id}`
}

// A catalog game's page as anyone sees it before owning it: the trophies, the guide already
// written and where to buy it. Asked by catalog id only.
async function title({ res, url }: Visit) {
  const id = gameId(url)
  if (!id) return json(res, 400, { error: 'game required' })
  const found = await getGame(id)
  if (!found) return json(res, 404, { error: 'title not found' })
  const [game] = await withTints([found])
  const [list, stored] = await Promise.all([
    game.np_communication_ids.length ? catalogTrophies(game.np_communication_ids) : null,
    getGuide<Parameters<typeof withPlayerSteps>[0]>(game.id),
  ])
  const guide = await withPlayerSteps(stored ?? null, list?.trophies, list?.np)
  return json(res, 200, {
    owned: false,
    trophies: list?.trophies ?? null,
    deepGuide: null,
    game,
    name: game.name,
    platform: game.platforms.find((p) => p === 'PS5') ?? game.platforms[0] ?? 'PS5',
    icon: heroArt(game),
    cover: game.cover_url,
    store: await storeFor(game, {}),
    guide: guide ?? null,
    building: false,
    // A guide not written yet waits for someone with an account to ask for it.
    queued: false,
  })
}

const VISITOR_ROUTES: Record<string, VisitorHandler> = {
  'GET /api/profile': profile,
  'GET /api/title': title,
  'GET /api/guides': guides,
  'GET /api/community/games': async ({ res }) => json(res, 200, await communityGames()),
  'GET /api/games/similar': async ({ res, url }) => {
    const game = gameId(url)
    if (!game) return json(res, 400, { error: 'game required' })
    return json(res, 200, { items: await similarToGame(game) })
  },
}

/** Answers a request without a session when it is one a visitor may make. True when answered. */
export async function visitorAnswered(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  method: string,
): Promise<boolean> {
  const key = `${method} ${url.pathname}`
  const handler = Object.hasOwn(VISITOR_ROUTES, key) ? VISITOR_ROUTES[key] : undefined
  if (!handler) return false
  if (!allow(`visitor|${clientIp(req) ?? ''}`, VISITS_PER_MINUTE, 60_000)) {
    json(
      res,
      429,
      {
        error: 'too_many_requests',
        message: translator(apiMessages, requestLocale(req))('tooManyRequests'),
      },
      { 'retry-after': '60' },
    )
    return true
  }
  await handler({ req, res, url })
  return true
}
