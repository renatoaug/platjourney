import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import * as browse from '../src/browse.ts'
import { config } from '../src/config.ts'
import * as demo from '../src/demo.ts'
import * as interests from '../src/interests.ts'
import * as lib from '../src/library.ts'
import * as playtime from '../src/playtime.ts'
import { Refused, registerPlugin, resetPlugins } from '../src/plugins.ts'
import * as psn from '../src/psn.ts'
import * as ranking from '../src/ranking.ts'
import { resetRateLimits } from '../src/rate-limit.ts'
import * as activity from '../src/repository/activity.ts'
import * as games from '../src/repository/game.ts'
import * as guides from '../src/repository/guide.ts'
import * as recs from '../src/repository/recommendation.ts'
import * as users from '../src/repository/user.ts'
import * as watcher from '../src/watcher.ts'
import { makeContext, makeGame, makeTitle, makeTrophy, makeUser } from './api-fixtures.ts'
import { connect, fakeOauthStore, send } from './oauth-store.ts'

const me = makeUser()
const other = makeUser({ id: 'user:2', psn_online_id: 'Atreus', psn_account_id: 'acc-2' })
const game = makeGame()
const title = makeTitle()
let token = ''
let id = 0

beforeEach(async () => {
  resetRateLimits()
  fakeOauthStore([me, other])
  spyOn(console, 'error').mockImplementation(() => {})
  spyOn(lib, 'library').mockImplementation(async (account) =>
    account === me.psn_account_id ? [title] : [],
  )
  spyOn(games, 'getGame').mockImplementation(async (g) => (g === game.id ? game : undefined))
  spyOn(games, 'gameByName').mockImplementation(async (n) => (n === game.name ? game : undefined))
  spyOn(ranking, 'loadGroups').mockResolvedValue(null)
  token = (await connect(me)).access_token
})

afterEach(() => {
  resetPlugins()
  mock.restore()
})

async function rpc(method: string, params?: unknown, auth = token) {
  const res = await send(
    'POST',
    '/mcp',
    { jsonrpc: '2.0', id: ++id, method, ...(params ? { params } : {}) },
    { authorization: `Bearer ${auth}`, 'content-type': 'application/json' },
  )
  return res
}

async function call(name: string, args: Record<string, unknown> = {}, auth = token) {
  const res = await rpc('tools/call', { name, arguments: args }, auth)
  const result = res.body.result
  return { ...result, data: result.isError ? undefined : JSON.parse(result.content[0].text) }
}

test('without a token /mcp points the assistant to sign-in', async () => {
  const res = await send('POST', '/mcp', { jsonrpc: '2.0', id: 1, method: 'ping' })
  expect(res.status).toBe(401)
  expect(res.headers['www-authenticate']).toBe(
    'Bearer resource_metadata="http://app.test/.well-known/oauth-protected-resource"',
  )
  expect((await send('OPTIONS', '/mcp')).status).toBe(204)
})

test('initialize, ping and the tool list', async () => {
  const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {} })
  expect(init.body.result).toMatchObject({
    protocolVersion: '2025-03-26',
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: 'platjourney', websiteUrl: 'http://app.test' },
  })
  // The app's icon on its dark background, for the assistant's list of connectors.
  expect(init.body.result.serverInfo.icons[0]).toEqual({
    src: 'http://app.test/icon-192.png',
    mimeType: 'image/png',
    sizes: ['192x192'],
  })
  expect(
    (await rpc('initialize', { protocolVersion: '1999-01-01' })).body.result.protocolVersion,
  ).toBe('2025-11-25')
  expect((await rpc('ping')).body).toEqual({ jsonrpc: '2.0', id, result: {} })
  const tools = (await rpc('tools/list')).body.result.tools
  expect(tools.map((t: { name: string }) => t.name)).toEqual([
    'get_profile',
    'get_current_game',
    'get_trophies',
    'search_games',
    'get_guide',
    'search_deep_guide',
    'get_interests',
    'get_library',
    'get_next_platinums',
    'get_recommendations',
    'get_similar_games',
    'get_releases',
    'get_platinums',
    'add_interest',
    'remove_interest',
    'mark_owned',
    'set_yearly_goal',
    'dismiss_recommendation',
    'save_suggestion',
    'save_session_plan',
    'save_tip',
  ])
  // Reads say so; the changes say whether they take something away.
  const hints = Object.fromEntries(
    tools.map((t: { name: string; annotations: object }) => [t.name, t.annotations]),
  )
  expect(hints.get_library).toEqual({ readOnlyHint: true, openWorldHint: false })
  expect(hints.add_interest).toEqual({
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
  })
  expect(hints.remove_interest).toMatchObject({ readOnlyHint: false, destructiveHint: true })
  expect((await rpc('resources/list')).body.error).toEqual({
    code: -32601,
    message: 'Method not found',
  })
})

test('notifications are acknowledged, and only POST with a JSON-RPC message is read', async () => {
  const headers = { authorization: `Bearer ${token}` }
  const note = await send(
    'POST',
    '/mcp',
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    headers,
  )
  expect(note.status).toBe(202)
  expect((await send('GET', '/mcp', undefined, headers)).status).toBe(405)
  expect((await send('POST', '/mcp', { id: 1, method: 'ping' }, headers)).body.error.code).toBe(
    -32600,
  )
  expect((await send('POST', '/mcp', '{oops', headers)).body.error.code).toBe(-32700)
})

test("the profile is the token owner's, never another player's", async () => {
  const summary = spyOn(psn, 'profileSummary').mockImplementation(async (account, onlineId) => ({
    onlineId: onlineId as string,
    level: account === me.psn_account_id ? 400 : 1,
    levelProgress: 10,
    earned: { bronze: 1, silver: 2, gold: 3, platinum: 1 as const },
  }))
  const mine = await call('get_profile')
  expect(mine.data).toEqual({
    onlineId: 'Kratos',
    level: 400,
    levelProgress: 10,
    earned: { bronze: 1, silver: 2, gold: 3, platinum: 1 as const },
    games: 1,
  })
  const theirs = await call('get_profile', {}, (await connect(other, 'y'.repeat(60))).access_token)
  expect(theirs.data).toMatchObject({ onlineId: 'Atreus', level: 1, games: 0 })
  expect(summary.mock.calls.map((c) => c[0])).toEqual([me.psn_account_id, other.psn_account_id])
})

test('the current game lists the base-game trophies still missing', async () => {
  spyOn(watcher, 'getCurrent').mockReturnValue(undefined)
  expect((await call('get_current_game')).data).toEqual({ playing: null })
  const trophies = [
    makeTrophy({ id: 1, name: 'Got it', earned: true }),
    makeTrophy({ id: 2, name: 'Faltando', nameEn: 'Missing', groupId: 'default', earned: false }),
    makeTrophy({ id: 3, name: 'DLC', groupId: '001', earned: false }),
  ]
  spyOn(watcher, 'getCurrent').mockReturnValue(makeContext({ trophies, hoursPlayed: 12 }))
  spyOn(ranking, 'loadGroups').mockResolvedValue({ base: { earned: 5, total: 10 } } as never)
  const { data } = await call('get_current_game')
  expect(data.playing).toMatchObject({ hoursPlayed: 12, baseGame: { earned: 5, total: 10 } })
  expect(data.playing.missing).toEqual([
    expect.objectContaining({ name: 'Missing', localName: 'Faltando', earned: false, dlc: false }),
  ])
})

test('trophies of an owned game carry what was earned; another game shows its catalog list', async () => {
  spyOn(demo, 'trophiesFor').mockResolvedValue([
    makeTrophy({ id: 1, earned: true, earnedAt: '2026-01-02' }),
    makeTrophy({ id: 2, earned: false, progressTarget: 10, progressValue: 3 }),
  ])
  const owned = await call('get_trophies', { game: 'game:1', status: 'missing' })
  expect(owned.data).toMatchObject({ owned: true, progress: title.progress })
  expect(owned.data.trophies).toEqual([
    expect.objectContaining({ earned: false, progress: '3/10' }),
  ])
  expect(
    (await call('get_trophies', { game: 'Days Gone', status: 'earned' })).data.trophies,
  ).toEqual([expect.objectContaining({ earnedAt: '2026-01-02' })])
  const theirs = (await connect(other, 'y'.repeat(60))).access_token
  spyOn(psn, 'catalogTrophies').mockResolvedValue({
    np: 'NPWR1',
    platform: 'PS5',
    trophies: [makeTrophy()],
  })
  const listed = await call('get_trophies', { game: 'game:1' }, theirs)
  expect(listed.data).toMatchObject({ owned: false })
  expect(listed.data.trophies).toHaveLength(1)
  const missing = await call('get_trophies', { game: 'game:999' })
  expect(missing).toMatchObject({ isError: true })
  expect(missing.content[0].text).toContain('search_games')
})

test('search lists catalog games with their guide facts', async () => {
  spyOn(browse, 'browseGuides').mockResolvedValue({
    items: [
      { id: 'game:1', name: 'Days Gone', platforms: ['PS4'], guide: { difficulty: 4, hours: 30 } },
    ],
  } as never)
  expect((await call('search_games', { query: 'days' })).data).toEqual({
    games: [
      { id: 'game:1', name: 'Days Gone', platforms: ['PS4'], guide: { difficulty: 4, hours: 30 } },
    ],
  })
  expect((await call('search_games', { query: 'd' })).isError).toBe(true)
})

test('the guide is the stored one, never researched on the spot', async () => {
  const get = spyOn(guides, 'getGuide').mockResolvedValue({ overview: 'Platina tranquila' })
  expect((await call('get_guide', { game: 'game:1' })).data).toMatchObject({
    game: { id: 'game:1', name: 'Days Gone' },
    guide: { overview: 'Platina tranquila' },
  })
  get.mockResolvedValue(undefined)
  expect((await call('get_guide', { game: 'game:1' })).data.guide).toBeNull()
})

test('the deep guide answers with passages and their pages; the demo has none', async () => {
  const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        passages: [
          {
            source: 'Site',
            url: 'https://s.example',
            heading: 'Ch. 5',
            content: 'Behind the bar',
            position: 3,
          },
        ],
      }),
    ),
  )
  const res = await call('search_deep_guide', {
    game: 'game:1',
    question: 'onde fica o colecionável 5?',
  })
  expect(res.data.passages).toEqual([
    { source: 'Site', url: 'https://s.example', heading: 'Ch. 5', content: 'Behind the bar' },
  ])
  const sent = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
  expect(sent).toMatchObject({ question: 'onde fica o colecionável 5?', limit: 6 })
  expect((await call('search_deep_guide', { game: 'game:1', question: ' ' })).isError).toBe(true)
  fetchSpy.mockResolvedValue(new Response('down', { status: 500 }))
  const failed = await call('search_deep_guide', { game: 'game:1', question: 'x' })
  expect(failed.content[0].text).toBe('This could not be done right now. Try again in a moment.')

  const demoUser = makeUser({ id: 'user:demo', psn_account_id: demo.DEMO_ACCOUNT_ID, demo: true })
  fakeOauthStore([demoUser])
  const demoToken = (await connect(demoUser)).access_token
  const refused = await call('search_deep_guide', { game: 'game:1', question: 'x' }, demoToken)
  expect(refused.content[0].text).toBe('The deep guide is not part of the demo.')
})

test("interests come with the year goal and this year's platinums", async () => {
  spyOn(playtime, 'playtimes').mockResolvedValue(new Map())
  spyOn(interests, 'yearProgress').mockResolvedValue({
    year: 2026,
    target: 12,
    done: 1,
    platinumed: [{ game, at: '2026-02-01', hours: 20 }],
    interests: [{ id: 'interest:1', game, progress: 40, hours: 8, done: false, deal: null }],
  } as never)
  expect((await call('get_interests')).data).toEqual({
    year: 2026,
    goal: 12,
    platinumsThisYear: [{ game: 'Days Gone', at: '2026-02-01', hours: 20 }],
    interests: [
      {
        id: 'interest:1',
        game: { id: 'game:1', name: 'Days Gone' },
        progress: 40,
        hours: 8,
        done: false,
        deal: null,
      },
    ],
  })
})

test('a plugin can refuse a tool, and each connection has a budget a minute', async () => {
  await registerPlugin({
    name: 'gate',
    register: (ctx) =>
      ctx.beforeTool(async ({ tool }) => {
        if (tool === 'search_deep_guide')
          throw new ctx.Refused('closed', 'Not open on this instance.')
      }),
  })
  expect((await call('search_deep_guide', { game: 'game:1', question: 'x' })).content[0].text).toBe(
    'Not open on this instance.',
  )
  expect((await call('nope')).content[0].text).toBe('Unknown tool nope.')
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  const saved = config.mcp.perMinute
  config.mcp.perMinute = 2
  resetRateLimits()
  await call('get_guide', { game: 'game:1' })
  await call('get_guide', { game: 'game:1' })
  expect((await call('get_guide', { game: 'game:1' })).content[0].text).toContain('Too many calls')
  config.mcp.perMinute = saved
  expect(Refused).toBeDefined()
})

test("a suggestion is saved under the assistant's name; the demo saves nothing", async () => {
  const save = spyOn(recs, 'saveAssistantPick').mockResolvedValue()
  const claude = (await connect(me, 'v'.repeat(50), 'Claude')).access_token
  const { data } = await call(
    'save_suggestion',
    { game: game.name, reason: '  Short and fun.  ' },
    claude,
  )
  expect(data).toMatchObject({ saved: { id: game.id }, reason: 'Short and fun.' })
  expect(save).toHaveBeenCalledWith(me.id, game.id, 'Short and fun.', 'claude')
  expect((await call('save_suggestion', { game: game.name })).isError).toBe(true)
  expect((await call('save_suggestion', { game: 'Nope', reason: 'x' })).isError).toBe(true)
})

test('a session plan names the trophies as the list does, for the game being played', async () => {
  const update = spyOn(users, 'updateUser').mockResolvedValue()
  spyOn(watcher, 'getCurrent').mockReturnValue(undefined)
  expect((await call('save_session_plan', { minutes: 60, summary: 's', steps: [] })).isError).toBe(
    true,
  )
  const trophies = [
    makeTrophy({ id: 1, name: 'Leitor', nameEn: 'Reader' }),
    makeTrophy({ id: 2, name: 'Platina', nameEn: 'Platinum', type: 'platinum' }),
  ]
  spyOn(watcher, 'getCurrent').mockReturnValue(makeContext({ trophies }))
  const codex = (await connect(me, 'v'.repeat(50), 'Codex')).access_token
  const ok = await call(
    'save_session_plan',
    {
      minutes: 90,
      summary: 'Story first.',
      steps: [
        { trophy: 'reader', minutes: 20, how: 'Read it', trick: '' },
        { trophy: 'Platinum', how: 'x' },
        { trophy: 'Made up', how: 'y' },
      ],
      warnings: ['Missable', 3],
    },
    codex,
  )
  expect(ok.data).toMatchObject({ saved: { steps: 1 }, notTrophies: ['Platinum', 'Made up'] })
  const plan = update.mock.calls[0][1].session_plan as Record<string, unknown>
  expect(plan).toMatchObject({
    minutes: 90,
    summary: 'Story first.',
    assistant: 'chatgpt',
    totalMinutes: 20,
    warnings: ['Missable'],
    ifTimeLeft: null,
    steps: [{ trophy: 'Leitor', minutes: 20, how: 'Read it', trick: null, flexible: false }],
  })
  expect(
    (await call('save_session_plan', { minutes: 5, summary: 's', steps: [{ trophy: 'Reader' }] }))
      .isError,
  ).toBe(true)
  expect(
    (await call('save_session_plan', { minutes: 60, summary: 's', steps: [{ trophy: 'Nope' }] }))
      .isError,
  ).toBe(true)
})

test('a tip goes to the history under the assistant, with its game when named', async () => {
  const log = spyOn(activity, 'logAssistantTip').mockResolvedValue()
  expect((await call('save_tip', { text: 'Use the bow.', game: game.name })).data).toMatchObject({
    saved: true,
    game: { id: game.id },
  })
  expect(log).toHaveBeenCalledWith(me.id, 'other', 'Use the bow.', game.id)
  await call('save_tip', { text: 'General tip' })
  expect(log).toHaveBeenLastCalledWith(me.id, 'other', 'General tip', undefined)
  expect((await call('save_tip', {})).isError).toBe(true)
})
