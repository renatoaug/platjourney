import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import * as auth from '../src/auth.ts'
import * as browse from '../src/browse.ts'
import * as communityModule from '../src/community.ts'
import { GUIDE_VERSION, type Guide } from '../src/guide.ts'
import * as interests from '../src/interests.ts'
import * as lib from '../src/library.ts'
import * as profile from '../src/profile.ts'
import * as psn from '../src/psn.ts'
import { resetRateLimits } from '../src/rate-limit.ts'
import * as communityRepo from '../src/repository/community.ts'
import * as games from '../src/repository/game.ts'
import * as guides from '../src/repository/guide.ts'
import * as requests from '../src/repository/guide-request.ts'
import * as users from '../src/repository/user.ts'
import { forgetVisitorProfiles } from '../src/routes/visitor.ts'
import * as similar from '../src/similar.ts'
import { handle } from '../src/web.ts'
import { makeGame, makeTrophy, makeUser } from './api-fixtures.ts'

class FakeResponse {
  status = 0
  headers: Record<string, string> = {}
  body = ''
  headersSent = false
  setHeader(name: string, value: string) {
    this.headers[name] = value
  }
  writeHead(status: number, headers: Record<string, string> = {}) {
    this.status = status
    this.headers = { ...this.headers, ...headers }
    this.headersSent = true
    return this
  }
  end(body: unknown = '') {
    this.body = String(body)
    return this
  }
}

async function send(method: string, url: string, body?: unknown) {
  const raw = body === undefined ? [] : [JSON.stringify(body)]
  const req = Object.assign(Readable.from(raw), { method, url, headers: {} })
  const res = new FakeResponse()
  await handle(req as unknown as IncomingMessage, res as unknown as ServerResponse)
  const type = res.headers['content-type'] ?? ''
  return {
    status: res.status,
    headers: res.headers,
    body: type === 'application/json' ? JSON.parse(res.body) : res.body,
  }
}

const game = makeGame()
const player = makeUser({ id: 'user:other', psn_account_id: '99', psn_online_id: 'Other_One' })
const stored = { version: GUIDE_VERSION - 1, overview: 'stored' } as Guide

beforeEach(() => {
  resetRateLimits()
  forgetVisitorProfiles()
  // Nobody is signed in.
  spyOn(auth, 'authenticate').mockResolvedValue(undefined)
  spyOn(users, 'userByOnlineId').mockResolvedValue(player)
  spyOn(lib, 'library').mockResolvedValue([])
  spyOn(profile, 'profilePage').mockResolvedValue({ totalHours: 9 } as never)
  spyOn(games, 'getGame').mockResolvedValue(game)
  spyOn(games, 'catalogGameForName').mockResolvedValue(undefined as never)
  spyOn(guides, 'getGuide').mockResolvedValue(stored)
  spyOn(psn, 'catalogTrophies').mockResolvedValue({
    np: 'NPWR1',
    platform: 'PS5',
    trophies: [makeTrophy()],
  } as never)
  spyOn(interests, 'storeFor').mockResolvedValue(null)
})

afterEach(() => mock.restore())

test('a visitor sees the profile of someone who shows up in the community, read once for a while', async () => {
  const shown = await send('GET', '/api/profile?user=other_one')
  expect(shown).toMatchObject({ status: 200, body: { totalHours: 9 } })
  await send('GET', '/api/profile?user=other_one')
  // The second visit is served from the first read: PSN is asked once.
  expect(profile.profilePage).toHaveBeenCalledTimes(1)
  expect(lib.library).toHaveBeenCalledWith('99')
})

test('a visitor gets no profile of someone hidden from the community, of the demo, or a bad name', async () => {
  const find = spyOn(users, 'userByOnlineId')
  find.mockResolvedValue({ ...player, community_visible: false })
  expect((await send('GET', '/api/profile?user=other_one')).status).toBe(404)
  find.mockResolvedValue({ ...player, demo: true })
  expect((await send('GET', '/api/profile?user=other_one')).status).toBe(404)
  find.mockResolvedValue(undefined)
  expect((await send('GET', '/api/profile?user=nobody_here')).status).toBe(404)
  expect((await send('GET', '/api/profile?user=../x')).status).toBe(400)
  // Their own profile needs an account: without ?user= there is nobody to show.
  expect((await send('GET', '/api/profile')).status).toBe(400)
})

test("a visitor sees a game's stored guide and trophies, and nothing is researched or asked for", async () => {
  const research = spyOn(requests, 'requestGuide').mockResolvedValue()
  const res = await send('GET', `/api/title?game=${encodeURIComponent(game.id)}`)
  expect(res.status).toBe(200)
  expect(res.body).toMatchObject({
    owned: false,
    name: game.name,
    guide: { overview: 'stored' },
    trophies: [{ name: makeTrophy().name }],
    building: false,
    queued: false,
  })
  expect(research).not.toHaveBeenCalled()
})

test('a visitor opens a game only by its catalog id, never by a name to look up', async () => {
  expect((await send('GET', '/api/title?name=Some%20Game')).status).toBe(400)
  expect(games.catalogGameForName).not.toHaveBeenCalled()
  spyOn(games, 'getGame').mockResolvedValue(undefined)
  expect((await send('GET', '/api/title?game=game:missing')).status).toBe(404)
})

test('a visitor reads the guides, what the community plays and similar games', async () => {
  spyOn(browse, 'browseGuides').mockResolvedValue({ items: [], total: 0 } as never)
  spyOn(communityModule, 'communityGames').mockResolvedValue({ playing: [] } as never)
  spyOn(similar, 'similarToGame').mockResolvedValue([])
  expect((await send('GET', '/api/guides?q=x')).body).toEqual({ items: [], total: 0 })
  expect((await send('GET', '/api/community/games')).body).toEqual({ playing: [] })
  expect((await send('GET', `/api/games/similar?game=${game.id}`)).body).toEqual({ items: [] })
  expect((await send('GET', '/api/games/similar?game=a%20b')).status).toBe(400)
})

test('everything else still needs an account', async () => {
  for (const [method, path] of [
    ['GET', '/api/state'],
    ['GET', '/api/me'],
    ['POST', '/api/goals'],
    ['GET', '/api/community'],
  ])
    expect(await send(method, path, method === 'POST' ? {} : undefined)).toMatchObject({
      status: 401,
      body: { error: 'unauthenticated' },
    })
})

test('a visitor reading too fast waits a minute', async () => {
  spyOn(browse, 'browseGuides').mockResolvedValue({ items: [] } as never)
  for (let i = 0; i < 120; i++) await send('GET', '/api/guides')
  const over = await send('GET', '/api/guides')
  expect(over.status).toBe(429)
  expect(over.headers['retry-after']).toBe('60')
})

test("a visitor reads the community's feed and rankings as nobody in particular", async () => {
  const feed = spyOn(communityModule, 'community').mockResolvedValue({
    members: [],
    feed: [],
  } as never)
  spyOn(communityModule, 'rankings').mockResolvedValue({
    platinums: [],
    rare: [],
    fastest: [],
  } as never)
  spyOn(communityRepo, 'following').mockResolvedValue([])
  spyOn(communityRepo, 'reactionsOn').mockResolvedValue(new Map())
  const res = await send('GET', '/api/community/feed?scope=all')
  expect(res).toMatchObject({ status: 200, body: { events: [], visible: false } })
  expect((await send('GET', '/api/community/rankings?period=month')).status).toBe(200)
  expect(feed).toHaveBeenCalled()
})

test('a visitor searches the catalog and sees the releases', async () => {
  spyOn(games, 'searchCatalog').mockResolvedValue([])
  spyOn(games, 'releasesBetween').mockResolvedValue([])
  expect((await send('GET', '/api/games/search?q=astro')).body).toEqual([])
  expect((await send('GET', '/api/releases')).body).toEqual([])
})
