import { browseGuides } from '../browse.ts'
import { config } from '../config.ts'
import { ensureDeepGuide } from '../deepguide.ts'
import { isDemo, trophiesFor } from '../demo.ts'
import { ensureGuide, GUIDE_VERSION, type Guide } from '../guide.ts'
import { json, readBody } from '../http.ts'
import { translator } from '../i18n.ts'
import { storeFor } from '../interests.ts'
import { library } from '../library.ts'
import { hours, playtimes } from '../playtime.ts'
import { catalogTrophies } from '../psn.ts'
import { loadGroups } from '../ranking.ts'
import { allow } from '../rate-limit.ts'
import { RELEASES_AFTER_DAYS, RELEASES_BEFORE_DAYS } from '../releases.ts'
import {
  catalogGameForName,
  type Game,
  gameByName,
  gameForTitle,
  getGame,
  releasesBetween,
  searchCatalog,
} from '../repository/game.ts'
import { requestMissingGame } from '../repository/game-request.ts'
import { getGuide } from '../repository/guide.ts'
import { requestGuide } from '../repository/guide-request.ts'
import type { User } from '../repository/user.ts'
import { similarToGame } from '../similar.ts'
import { type Api, type ApiHandler, apiMessages, deepGuideOf, heroArt } from './api.ts'

// Guide research takes a minute; the page polls while one of these is in flight.
const building = new Map<string, Promise<Guide>>()
// Researching a guide searches the web with a paid model: a few at a time for the whole
// instance, and a daily number per player. Past either, the game waits on the list of guides
// to write, like it does with automatic research off.
const MAX_BUILDING = 3
const RESEARCH_PER_DAY = 10
const researched = new Map<string, { day: string; count: number }>()

/** For tests: forgets today's research counts. */
export const forgetResearch = () => researched.clear()

function mayResearch(user: User): boolean {
  if (building.size >= MAX_BUILDING) return false
  const day = new Date().toISOString().slice(0, 10)
  const seen = researched.get(user.id)
  const count = seen?.day === day ? seen.count : 0
  if (count >= RESEARCH_PER_DAY) return false
  researched.set(user.id, { day, count: count + 1 })
  return true
}
async function guideOrBuild(
  user: User,
  game: Game,
  build: () => Promise<Guide>,
): Promise<{ guide: Guide | null; queued: boolean }> {
  const cached = await getGuide<Guide>(game.id)
  // The demo shows the guides it has and never asks for one.
  if (isDemo(user)) return { guide: cached ?? null, queued: false }
  if (cached && (cached.version ?? 1) >= GUIDE_VERSION) return { guide: cached, queued: false }
  // Without automatic research (or over today's share of it) an older guide is still better
  // than none, and a missing one is listed for whoever runs the instance.
  if (!config.automatic.research || (!building.has(game.id) && !mayResearch(user))) {
    if (!cached) await requestGuide(game.id)
    return { guide: cached ?? null, queued: !cached }
  }
  if (!building.has(game.id)) {
    const job = build().finally(() => building.delete(game.id))
    job.catch((e) => console.error('guide failed:', (e as Error).message))
    building.set(game.id, job)
  }
  return { guide: null, queued: false }
}

// The game a title page asks for, by catalog id or by name.
async function askedGame(url: URL, user: User, platform: string): Promise<Game | undefined> {
  const gameParam = url.searchParams.get('game')
  const name = url.searchParams.get('name')
  if (gameParam) return getGame(gameParam)
  // A name the catalog does not know would be looked up on IGDB and stored; the demo only reads.
  if (name) return isDemo(user) ? gameByName(name) : catalogGameForName(name, platform)
  return undefined
}

// Detail for one catalog game: with PSN progress when the player owns it.
async function titleDetail(url: URL, user: User) {
  const np = url.searchParams.get('id')
  const platform = url.searchParams.get('platform') ?? 'PS5'

  let game = await askedGame(url, user, platform)
  const titles = await library(user.psn_account_id)
  const owned = titles.filter((t) =>
    np ? t.npCommunicationId === np : game?.np_communication_ids.includes(t.npCommunicationId),
  )
  // Prefer the copy with the most progress (PS5 over PS4 when equal).
  const title = owned.sort(
    (a, b) => b.progress - a.progress || (b.platform.includes('PS5') ? 1 : -1),
  )[0]
  if (!game && title) game = await gameForTitle(title)
  if (!game) return null
  return title ? ownedDetail(user, game, title) : catalogDetail(user, game, platform)
}

async function ownedDetail(
  user: User,
  found: Game,
  title: Awaited<ReturnType<typeof library>>[number],
) {
  const [trophies, groups] = await Promise.all([trophiesFor(title, user), loadGroups(title, user)])
  const { guide, queued } = await guideOrBuild(user, found, () =>
    ensureGuide(found, trophies, { name: title.name, platform: title.platform }),
  )
  if (guide && !isDemo(user))
    ensureDeepGuide(found, title.total).catch((e) =>
      console.error('deep guide failed:', (e as Error).message),
    )
  return {
    owned: true,
    np: title.npCommunicationId,
    deepGuide: await deepGuideOf(user, found),
    hoursPlayed: hours((await playtimes(user)).get(found.id)),
    game: found,
    name: found.name,
    platform: title.platform,
    icon: heroArt(found, title),
    cover: found.cover_url,
    progress: title.progress,
    earned: title.earned,
    total: title.total,
    groups,
    trophies,
    guide,
    building: !guide && !queued && !isDemo(user),
    queued,
  }
}

async function catalogDetail(user: User, found: Game, platform: string) {
  // The demo only has the trophy lists of the games in its library.
  const list =
    found.np_communication_ids.length && !isDemo(user)
      ? await catalogTrophies(found.np_communication_ids)
      : null
  const { guide, queued } = await guideOrBuild(user, found, () =>
    ensureGuide(
      found,
      list?.trophies,
      list ? { name: found.name, platform: list.platform } : undefined,
    ),
  )
  if (guide && !isDemo(user))
    ensureDeepGuide(found).catch((e) => console.error('deep guide failed:', (e as Error).message))
  return {
    owned: false,
    trophies: list?.trophies ?? null,
    deepGuide: await deepGuideOf(user, found),
    game: found,
    name: found.name,
    platform: found.platforms.find((p) => p === 'PS5') ?? found.platforms[0] ?? platform,
    icon: heroArt(found),
    cover: found.cover_url,
    // Not in the library yet: where to buy it, and its sale when known.
    store: await storeFor(found, user),
    guide,
    building: !guide && !queued && !isDemo(user),
    queued,
  }
}

async function guides({ res, url }: Api) {
  const p = url.searchParams
  return json(
    res,
    200,
    await browseGuides({
      query: p.get('q') ?? undefined,
      platform: p.get('platform') ?? undefined,
      sort: p.get('sort') ?? undefined,
      page: Number(p.get('page')) || 1,
      difficulty: p.get('difficulty') ?? undefined,
      hours: p.get('hours') ?? undefined,
      noMissables: p.get('noMissables') === '1',
      onePlaythrough: p.get('onePlaythrough') === '1',
      noOnline: p.get('noOnline') === '1',
      genre: p.get('genre') ?? undefined,
    }),
  )
}

// A game the search did not find: IGDB is asked for it, and a game it knows joins the catalog
// (its page then lists it for a guide). A name IGDB does not know either is kept for whoever
// runs the instance.
async function requestGame({ req, res, me, locale }: Api) {
  const t = translator(apiMessages, locale)
  const { name } = await readBody(req)
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100)
    return json(res, 400, { error: 'name required' })
  if (!allow(`game-request|${me.id}`, 5, 60_000))
    return json(res, 429, { error: t('tooManyRequests') })
  const game = await catalogGameForName(name.trim())
  if (game) return json(res, 200, { game: game.id })
  const already = await requestMissingGame(name.trim(), me.id)
  return json(res, 200, { requested: true, already })
}

// The catalog: a game's page, the guides, the releases calendar and the search.
export const GAME_ROUTES: Record<string, ApiHandler> = {
  'GET /api/title': async ({ req, res, url, me, locale }) => {
    // A name the catalog does not know costs an IGDB lookup and a new catalog row, and may start
    // a guide: only from this site's own pages, and a few times a minute.
    if (url.searchParams.get('name') && !url.searchParams.get('game')) {
      if (req.headers['sec-fetch-site'] === 'cross-site')
        return json(res, 403, { error: 'cross-site' })
      if (!allow(`title-name|${me.id}`, 20, 60_000))
        return json(res, 429, { error: translator(apiMessages, locale)('tooManyRequests') })
    }
    const detail = await titleDetail(url, me)
    return detail ? json(res, 200, detail) : json(res, 404, { error: 'title not found' })
  },
  'GET /api/guides': guides,
  // Releases around today: the last two weeks and the next six, for the home's calendar.
  'GET /api/releases': async ({ res }) => {
    const day = 86_400_000
    const now = Date.now()
    return json(
      res,
      200,
      await releasesBetween(
        new Date(now - RELEASES_BEFORE_DAYS * day),
        new Date(now + RELEASES_AFTER_DAYS * day),
      ),
    )
  },
  'GET /api/games/search': async ({ res, url }) =>
    json(res, 200, await searchCatalog(url.searchParams.get('q') ?? '')),
  'POST /api/games/request': requestGame,
  'GET /api/games/similar': async ({ res, url }) => {
    const game = url.searchParams.get('game') ?? ''
    if (!/^game:[\w-]+$/.test(game)) return json(res, 400, { error: 'game required' })
    return json(res, 200, { items: await similarToGame(game) })
  },
}
