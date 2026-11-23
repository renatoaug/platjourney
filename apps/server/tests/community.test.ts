import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import * as community from '../src/community.ts'
import { forgetCommunity, keepRarities, medalsEarned } from '../src/community.ts'
import type { TrophyStatus } from '../src/psn.ts'
import * as repo from '../src/repository/community.ts'
import type { Api } from '../src/routes/api.ts'
import { COMMUNITY_ROUTES } from '../src/routes/community.ts'
import { makeUser } from './api-fixtures.ts'

const day = (n: number, hour = 15) => new Date(Date.UTC(2026, 10, n, hour)).toISOString()
const rarities = new Map([
  ['NP1|1', { rate: 2, type: 'gold' }],
  ['NP1|2', { rate: 3.5, type: 'silver' }],
  ['NP1|3', { rate: 40, type: 'bronze' }],
  ['NP1|0', { rate: 1, type: 'platinum' }],
])

beforeEach(() => forgetCommunity())
afterEach(() => mock.restore())

test('five trophies under 5% earn the rare hunter, on the fifth; the platinum does not count', () => {
  const unlocks = [
    { np: 'NP1', trophyId: 0, at: day(1) },
    { np: 'NP1', trophyId: 1, at: day(3) },
    { np: 'NP1', trophyId: 2, at: day(5) },
    { np: 'NP2', trophyId: 1, at: day(7) },
    { np: 'NP1', trophyId: 3, at: day(9) },
  ]
  const more = new Map([
    ...rarities,
    ['NP2|1', { rate: 1.2, type: 'bronze' }],
    ['NP2|2', { rate: 4.9, type: 'bronze' }],
    ['NP2|3', { rate: 0.4, type: 'gold' }],
  ])
  expect(medalsEarned(unlocks, more, [], new Map(), null, 2026)).toEqual([])
  const five = [
    ...unlocks,
    { np: 'NP2', trophyId: 2, at: day(11) },
    { np: 'NP2', trophyId: 3, at: day(13) },
  ]
  expect(medalsEarned(five, more, [], new Map(), null, 2026)).toEqual([
    { kind: 'rare_hunter', at: day(13) },
  ])
})

test('a platinum within seven days of the first trophy earns the lightning platinum', () => {
  const slow = medalsEarned(
    [],
    rarities,
    [{ np: 'NP1', at: day(20) }],
    new Map([['NP1', day(1)]]),
    null,
    2026,
  )
  expect(slow).toEqual([])
  const quick = medalsEarned(
    [],
    rarities,
    [{ np: 'NP1', at: day(7) }],
    new Map([['NP1', day(1)]]),
    null,
    2026,
  )
  expect(quick).toEqual([{ kind: 'quick_platinum', at: day(7) }])
})

test('trophies on seven days in a row earn no day off; a gap starts over', () => {
  const run = (days: number[]) => days.map((d, i) => ({ np: 'NP1', trophyId: 3 + i, at: day(d) }))
  expect(medalsEarned(run([1, 2, 3, 5, 6, 7, 8, 9]), rarities, [], new Map(), null, 2026)).toEqual(
    [],
  )
  expect(medalsEarned(run([1, 2, 3, 4, 5, 6, 7]), rarities, [], new Map(), null, 2026)).toEqual([
    { kind: 'no_day_off', at: day(7) },
  ])
})

test('the year goal is earned by the platinum that reaches it, only for that year', () => {
  const plats = [
    { np: 'A', at: '2025-12-30T10:00:00.000Z' },
    { np: 'B', at: day(1) },
    { np: 'C', at: day(2) },
  ]
  expect(medalsEarned([], rarities, plats, new Map(), 3, 2026)).toEqual([])
  expect(medalsEarned([], rarities, plats, new Map(), 2, 2026)).toEqual([
    { kind: 'year_goal', at: day(2) },
  ])
})

const trophy = (over: Partial<TrophyStatus>): TrophyStatus => ({
  id: 1,
  name: 'Um',
  detail: '',
  nameEn: 'One',
  detailEn: '',
  type: 'gold',
  rarity: 'Raro',
  earnedRate: 2,
  earned: false,
  hidden: false,
  groupId: 'default',
  ...over,
})

test('rarities are kept from a player’s list, never from a catalog list, and once in a while', async () => {
  const save = spyOn(repo, 'saveRarities').mockResolvedValue()
  keepRarities('NPCAT', [trophy({ rarityTier: undefined })])
  expect(save).not.toHaveBeenCalled()
  keepRarities('NPMINE', [trophy({ rarityTier: 1 })])
  keepRarities('NPMINE', [trophy({ rarityTier: 1 })])
  expect(save).toHaveBeenCalledTimes(1)
  expect(save.mock.calls[0]).toEqual([
    'NPMINE',
    [{ trophyId: 1, type: 'gold', name: 'Um', nameEn: 'One', rate: 2 }],
  ])
})

class FakeResponse {
  status = 0
  body = ''
  headers: Record<string, string> = {}
  setHeader(n: string, v: string) {
    this.headers[n] = v
  }
  writeHead(status: number, headers: Record<string, string> = {}) {
    this.status = status
    this.headers = { ...this.headers, ...headers }
    return this
  }
  end(body: unknown = '') {
    this.body = String(body)
    return this
  }
}

async function call(route: string, url: string, body?: unknown) {
  const req = Object.assign(Readable.from(body === undefined ? [] : [JSON.stringify(body)]), {
    method: route.split(' ')[0],
    url,
    headers: {},
  })
  const res = new FakeResponse()
  const me = makeUser()
  await COMMUNITY_ROUTES[route]({
    req: req as unknown as IncomingMessage,
    res: res as unknown as ServerResponse,
    url: new URL(url, 'http://localhost'),
    me,
    locale: 'pt-BR',
    titles: async () => [],
  } as unknown as Api)
  return { status: res.status, body: res.body ? JSON.parse(res.body) : null, me }
}

test('a reaction must name a feed event and a known kind', async () => {
  const set = spyOn(repo, 'setReaction').mockResolvedValue()
  spyOn(repo, 'reactionsOn').mockResolvedValue(new Map())
  expect(
    (
      await call('POST /api/community/react', '/api/community/react', {
        event: 'drop table',
        kind: 'like',
        on: true,
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await call('POST /api/community/react', '/api/community/react', {
        event: 'plat:a:NP1',
        kind: 'love',
        on: true,
      })
    ).status,
  ).toBe(400)
  const ok = await call('POST /api/community/react', '/api/community/react', {
    event: 'plat:a:NP1',
    kind: 'like',
    on: true,
  })
  expect(ok.status).toBe(200)
  expect(set).toHaveBeenCalledTimes(1)
})

test('a player follows only someone in the community, never themselves', async () => {
  const set = spyOn(repo, 'setFollow').mockResolvedValue()
  spyOn(repo, 'following').mockResolvedValue([])
  spyOn(community, 'community').mockResolvedValue({
    members: [{ id: 'other', onlineId: 'Other', avatarUrl: null, visible: true }],
    feed: [],
  })
  const self = await call('POST /api/community/follow', '/api/community/follow', {
    user: makeUser().id.replace(/^user:/, ''),
    on: true,
  })
  expect(self.status).toBe(400)
  expect(
    (
      await call('POST /api/community/follow', '/api/community/follow', {
        user: 'nobody',
        on: true,
      })
    ).status,
  ).toBe(404)
  expect(
    (await call('POST /api/community/follow', '/api/community/follow', { user: 'other', on: true }))
      .status,
  ).toBe(200)
  expect(set).toHaveBeenCalledTimes(1)
})

test('the feed filters by scope and pages by date', async () => {
  const me = makeUser().id.replace(/^user:/, '')
  const event = (user: string, at: string) => ({
    key: `start:${user}:NP1:${at}`,
    kind: 'start' as const,
    user,
    at,
    game: null,
  })
  spyOn(community, 'community').mockResolvedValue({
    members: [
      { id: me, onlineId: 'Me', avatarUrl: null, visible: true },
      { id: 'other', onlineId: 'Other', avatarUrl: null, visible: true },
    ],
    feed: [event('other', day(3)), event(me, day(2)), event('other', day(1))],
  })
  spyOn(repo, 'following').mockResolvedValue(['other'])
  spyOn(repo, 'reactionsOn').mockResolvedValue(new Map())
  const all = await call('GET /api/community/feed', '/api/community/feed?scope=all')
  expect(all.body.events.map((e: { user: string }) => e.user)).toEqual(['other', me, 'other'])
  const mine = await call('GET /api/community/feed', '/api/community/feed?scope=me')
  expect(mine.body.events).toHaveLength(1)
  const followed = await call(
    'GET /api/community/feed',
    `/api/community/feed?scope=following&before=${day(3)}`,
  )
  expect(followed.body.events.map((e: { at: string }) => e.at)).toEqual([day(1)])
  expect((await call('GET /api/community/feed', '/api/community/feed?scope=x')).status).toBe(400)
})

test('the demo looks at the community without reacting or following', async () => {
  const react = spyOn(repo, 'setReaction').mockResolvedValue()
  const follow = spyOn(repo, 'setFollow').mockResolvedValue()
  for (const [route, body] of [
    ['POST /api/community/react', { event: 'plat:a:NP1', kind: 'like', on: true }],
    ['POST /api/community/follow', { user: 'other', on: true }],
  ] as const) {
    const res = new FakeResponse()
    await COMMUNITY_ROUTES[route]({
      req: Object.assign(Readable.from([JSON.stringify(body)]), {
        method: 'POST',
        url: '/',
        headers: {},
      }),
      res,
      url: new URL('http://localhost/'),
      me: makeUser({ demo: true }),
      locale: 'pt-BR',
      titles: async () => [],
    } as unknown as Api)
    expect(res.status).toBe(403)
  }
  expect(react).not.toHaveBeenCalled()
  expect(follow).not.toHaveBeenCalled()
})

test('a player out of the community still sees their own, and nobody else does', async () => {
  const me = makeUser().id.replace(/^user:/, '')
  const event = (user: string, at: string) => ({
    key: `start:${user}:NP1:${at}`,
    kind: 'start' as const,
    user,
    at,
    game: null,
  })
  spyOn(community, 'community').mockResolvedValue({
    members: [
      { id: me, onlineId: 'Me', avatarUrl: null, visible: false },
      { id: 'other', onlineId: 'Other', avatarUrl: null, visible: true },
      { id: 'quiet', onlineId: 'Quiet', avatarUrl: null, visible: false },
    ],
    feed: [event('quiet', day(4)), event(me, day(3)), event('other', day(2))],
  })
  spyOn(repo, 'following').mockResolvedValue([])
  spyOn(repo, 'reactionsOn').mockResolvedValue(new Map())
  const all = await call('GET /api/community/feed', '/api/community/feed?scope=all')
  expect(all.body.events.map((e: { user: string }) => e.user)).toEqual([me, 'other'])
  const mine = await call('GET /api/community/feed', '/api/community/feed?scope=me')
  expect(mine.body.events).toHaveLength(1)
})

test('a stale community answers at once while a fresh one is built behind it', async () => {
  const people = [{ id: 'a', onlineId: 'A', avatarUrl: null, visible: true }]
  const read = spyOn(repo, 'members').mockResolvedValue(people)
  spyOn(repo, 'platinumsSince').mockResolvedValue([])
  spyOn(repo, 'unlocksSince').mockResolvedValue([])
  spyOn(repo, 'medalsOf').mockResolvedValue([])
  spyOn(repo, 'goalTargets').mockResolvedValue(new Map())
  const now = Date.now()
  const clock = spyOn(Date, 'now').mockReturnValue(now)
  // The first visit has nothing to show yet: it waits for the build.
  const first = await community.community()
  expect(first.members).toEqual(people)
  // Minutes later the copy is stale: it comes back at once, and a new build starts behind it.
  clock.mockReturnValue(now + 10 * 60_000)
  const builds = read.mock.calls.length
  const later = community.community()
  expect(await later).toBe(first)
  await new Promise((done) => setTimeout(done, 0))
  expect(read.mock.calls.length).toBeGreaterThan(builds)
})

test('starting the server builds the feed and the month and year boards', async () => {
  const read = spyOn(repo, 'members').mockResolvedValue([])
  spyOn(repo, 'platinumsSince').mockResolvedValue([])
  spyOn(repo, 'unlocksSince').mockResolvedValue([])
  spyOn(repo, 'medalsOf').mockResolvedValue([])
  spyOn(repo, 'goalTargets').mockResolvedValue(new Map())
  community.warmCommunity(new Date(2026, 10, 23))
  await new Promise((done) => setTimeout(done, 0))
  // The feed, the month and the year: three builds, each reading the players.
  expect(read.mock.calls.length).toBeGreaterThanOrEqual(3)
  const calls = read.mock.calls.length
  await community.rankings(new Date(2026, 10, 1))
  await community.rankings(new Date(2026, 0, 1))
  expect(read.mock.calls.length).toBe(calls)
})
