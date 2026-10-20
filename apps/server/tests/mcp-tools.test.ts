import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import * as interests from '../src/interests.ts'
import * as lib from '../src/library.ts'
import { forgetMethod } from '../src/mcp.ts'
import * as playtime from '../src/playtime.ts'
import * as profile from '../src/profile.ts'
import * as ranking from '../src/ranking.ts'
import { resetRateLimits } from '../src/rate-limit.ts'
import * as recommend from '../src/recommend.ts'
import * as games from '../src/repository/game.ts'
import * as interestRepo from '../src/repository/interest.ts'
import * as similarRepo from '../src/repository/similar.ts'
import * as similar from '../src/similar.ts'
import { makeGame, makeTitle, makeUser } from './api-fixtures.ts'
import { counts } from './fixtures.ts'
import { connect, fakeOauthStore, send } from './oauth-store.ts'

const me = makeUser()
const game = makeGame()
const platinumed = makeTitle({
  npCommunicationId: 'NPWR2',
  name: 'Journey',
  earnedByType: { ...counts(5), platinum: 1 },
  lastUpdated: '2026-05-01T00:00:00Z',
})
const started = makeTitle({ lastUpdated: '2026-06-01T00:00:00Z' })
const untouched = makeTitle({ npCommunicationId: 'NPWR3', name: 'Inside', earned: 0 })
let token = ''
let id = 0

beforeEach(async () => {
  resetRateLimits()
  forgetMethod()
  fakeOauthStore([me])
  spyOn(console, 'error').mockImplementation(() => {})
  spyOn(lib, 'library').mockResolvedValue([platinumed, started, untouched])
  spyOn(games, 'getGame').mockImplementation(async (g) => (g === game.id ? game : undefined))
  spyOn(games, 'gameByName').mockResolvedValue(undefined)
  token = (await connect(me)).access_token
})

afterEach(() => mock.restore())

async function rpc(method: string, params?: unknown, auth = token) {
  return send(
    'POST',
    '/mcp',
    { jsonrpc: '2.0', id: ++id, method, ...(params ? { params } : {}) },
    { authorization: `Bearer ${auth}`, 'content-type': 'application/json' },
  )
}

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = (await rpc('tools/call', { name, arguments: args })).body.result
  return { ...result, data: result.isError ? undefined : JSON.parse(result.content[0].text) }
}

test('the library lists the games, the latest played first, filtered by status', async () => {
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map([['NPWR1', game]]))
  spyOn(playtime, 'playtimes').mockResolvedValue(new Map([['game:1', { seconds: 9000 }]]) as never)
  const all = (await call('get_library')).data
  expect(all.total).toBe(3)
  expect(all.games.map((g: { name: string }) => g.name)).toEqual(['Days Gone', 'Journey', 'Inside'])
  expect(all.games[0]).toMatchObject({ id: 'game:1', hoursPlayed: 2.5, platinum: false })
  expect((await call('get_library', { status: 'platinumed' })).data.games).toHaveLength(1)
  expect((await call('get_library', { status: 'in_progress' })).data.games).toHaveLength(1)
  expect((await call('get_library', { limit: 1 })).data.games).toHaveLength(1)
})

test('the next platinums come ranked with their guide facts', async () => {
  const rank = spyOn(ranking, 'rankNextPlatinum').mockResolvedValue([
    { game, title: started, groups: null, remaining: 4, effort: 2, baseProgress: 80 },
  ])
  spyOn(similarRepo, 'guideFacts').mockResolvedValue([
    { game: 'game:1', difficulty: 3, hours: 20, hasMissables: true, hasOnline: false },
  ])
  const { data } = await call('get_next_platinums', { limit: 99 })
  expect(rank.mock.calls[0][2]).toBe(20)
  expect(data.games).toEqual([
    {
      game: { id: 'game:1', name: 'Days Gone', platforms: ['PS4', 'PS5'], releaseYear: null },
      platform: 'PS5',
      baseProgress: 80,
      trophiesLeft: 4,
      guide: { difficulty: 3, hours: 20, hasMissables: true, hasOnline: false },
    },
  ])
})

test('recommendations, similar games, releases and platinums read what the app shows', async () => {
  const pick = {
    game,
    platform: 'PS5',
    difficulty: 2,
    hours: 8,
    playthroughs: 1,
    hasMissables: false,
    hasDifficultyTrophy: null,
    because: ['Journey'],
    platinumed: ['Journey'],
  }
  spyOn(lib, 'ownedGames').mockResolvedValue([])
  spyOn(similar, 'similarPicks').mockResolvedValue({ items: [pick], quick: [], series: [pick] })
  expect((await call('get_recommendations')).data).toMatchObject({
    likeYourGames: [{ because: ['Journey'], hours: 8 }],
    quickPlatinums: [],
    inYourSeries: [{ difficulty: 2 }],
  })
  spyOn(similar, 'similarToGame').mockResolvedValue([
    { game, difficulty: 4, hours: 30, relation: 'series' } as never,
  ])
  expect((await call('get_similar_games', { game: 'game:1' })).data.similar).toEqual([
    {
      game: { id: 'game:1', name: 'Days Gone', platforms: ['PS4', 'PS5'], releaseYear: null },
      relation: 'series',
      difficulty: 4,
      hours: 30,
    },
  ])
  spyOn(games, 'releasesBetween').mockResolvedValue([{ id: 'game:9', name: 'Saros' }] as never)
  expect((await call('get_releases')).data).toEqual({ releases: [{ id: 'game:9', name: 'Saros' }] })
  spyOn(profile, 'profilePage').mockResolvedValue({
    platinums: [
      { game, platform: 'PS4', earnedAt: '2026-05-01', rarity: 4.2, trophyName: 'P', hours: 40 },
    ],
    pendingPlatinums: 2,
    byYear: [{ year: 2026, count: 1 }],
    byPlatform: [{ platform: 'PS4', count: 1 }],
  } as never)
  expect((await call('get_platinums')).data).toMatchObject({
    total: 3,
    platinums: [{ earnedAt: '2026-05-01', rarity: 4.2, hours: 40 }],
  })
})

test('changes run the same interest commands as the web and Telegram', async () => {
  const run = spyOn(interests, 'handleInterestCommand').mockResolvedValue('ok')
  spyOn(interestRepo, 'listInterests').mockResolvedValue([
    { id: 'interest:7', game, position: 0 } as never,
  ])
  expect((await call('add_interest', { game: 'game:1' })).data.saved.id).toBe('game:1')
  expect((await call('remove_interest', { game: 'game:1' })).data).toEqual({ removed: 'Days Gone' })
  expect((await call('mark_owned', { game: 'game:1' })).data).toEqual({ owned: 'Days Gone' })
  expect((await call('set_yearly_goal', { target: 12 })).data.goal).toBe(12)
  expect(run.mock.calls.map((c) => c[1])).toEqual([
    'add game:1',
    'remove interest:7',
    'owned interest:7',
    'set 12',
  ])
  expect((await call('set_yearly_goal', { target: 0 })).content[0].text).toContain('1 to 365')
  spyOn(interestRepo, 'listInterests').mockResolvedValue([])
  expect((await call('remove_interest', { game: 'game:1' })).content[0].text).toContain(
    'not in the interests',
  )
})

test('dismissing a recommendation keeps the reason only when it is a known one', async () => {
  const dismiss = spyOn(recommend, 'dismissRecommendation').mockResolvedValue()
  expect(
    (await call('dismiss_recommendation', { game: 'game:1', reason: 'too_long' })).data,
  ).toEqual({ dismissed: 'Days Gone', reason: 'too_long' })
  await call('dismiss_recommendation', { game: 'game:1', reason: 'meh' })
  expect(dismiss.mock.calls.map((c) => c[2])).toEqual(['too_long', undefined])
})

test('the demo reads but its changes are refused', async () => {
  const demoUser = makeUser({ id: 'user:demo', psn_account_id: 'demo', demo: true })
  fakeOauthStore([demoUser])
  token = (await connect(demoUser)).access_token
  const run = spyOn(interests, 'handleInterestCommand').mockResolvedValue('ok')
  const res = await call('add_interest', { game: 'game:1' })
  expect(res.content[0].text).toBe('This is the demo: it can be read, but nothing is saved.')
  expect(run).not.toHaveBeenCalled()
})

test('the shortcuts carry how Nexo thinks, asked once from the AI service', async () => {
  const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ pick: 'PICK RULES', plan: 'PLAN RULES', tip: 'TIP RULES' })),
  )
  const init = (await rpc('initialize', {})).body.result
  expect(init.capabilities.prompts).toEqual({ listChanged: false })
  const list = (await rpc('prompts/list')).body.result.prompts
  expect(list.map((p: { name: string }) => p.name)).toEqual([
    'what_to_play',
    'plan_session',
    'trophy_tip',
  ])
  const what = (await rpc('prompts/get', { name: 'what_to_play', arguments: { mood: 'curto' } }))
    .body.result
  expect(what.messages[0].content.text).toContain('Right now I feel like: curto.')
  expect(what.messages[0].content.text).toContain('PICK RULES')
  const plan = (await rpc('prompts/get', { name: 'plan_session', arguments: { minutes: '45' } }))
    .body.result
  expect(plan.messages[0].content.text).toContain('45 minutes')
  expect(plan.messages[0].content.text).toContain('PLAN RULES')
  const tip = (await rpc('prompts/get', { name: 'trophy_tip', arguments: {} })).body.result
  expect(tip.messages[0].content.text).toContain('What should I do next')
  expect(tip.messages[0].content.text).toContain('TIP RULES')
  const named = (await rpc('prompts/get', { name: 'trophy_tip', arguments: { trophy: 'Leitor' } }))
    .body.result
  expect(named.messages[0].content.text).toContain('"Leitor"')
  // Asked once, then kept.
  expect(fetchSpy.mock.calls.filter((c) => String(c[0]).endsWith('/method'))).toHaveLength(1)
  expect((await rpc('prompts/get', { name: 'nope' })).body.error.code).toBe(-32601)
})

test('a failed method request is asked again next time', async () => {
  const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('down', { status: 500 }),
  )
  const failed = await rpc('prompts/get', { name: 'trophy_tip' })
  expect(failed.body.error).toEqual({ code: -32603, message: 'Internal error' })
  fetchSpy.mockResolvedValue(new Response(JSON.stringify({ pick: 'P', plan: 'L', tip: 'T' })))
  expect((await rpc('prompts/get', { name: 'trophy_tip' })).body.result.messages).toHaveLength(1)
})
