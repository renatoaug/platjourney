import './env.ts'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import * as fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import * as auth from '../src/auth.ts'
import { AuthError } from '../src/auth.ts'
import * as browser from '../src/browse.ts'
import { config } from '../src/config.ts'
import * as deepguide from '../src/deepguide.ts'
import { DEMO_ACCOUNT_ID } from '../src/demo.ts'
import * as guide from '../src/guide.ts'
import { GUIDE_VERSION, type Guide } from '../src/guide.ts'
import { pagePolicy, SECURITY_HEADERS } from '../src/http.ts'
import * as interests from '../src/interests.ts'
import * as lib from '../src/library.ts'
import * as nexo from '../src/nexo.ts'
import * as nextPickModule from '../src/next-pick.ts'
import * as planner from '../src/planner.ts'
import * as playtime from '../src/playtime.ts'
import { Refused, registerPlugin, resetPlugins } from '../src/plugins.ts'
import * as profile from '../src/profile.ts'
import * as psn from '../src/psn.ts'
import { PrivateProfile } from '../src/psn.ts'
import * as push from '../src/push.ts'
import * as ranking from '../src/ranking.ts'
import { resetRateLimits } from '../src/rate-limit.ts'
import * as recommend from '../src/recommend.ts'
import * as activity from '../src/repository/activity.ts'
import * as games from '../src/repository/game.ts'
import * as missing from '../src/repository/game-request.ts'
import * as guides from '../src/repository/guide.ts'
import * as requests from '../src/repository/guide-request.ts'
import type { Playtime } from '../src/repository/playtime.ts'
import * as pushSubs from '../src/repository/push-subscription.ts'
import * as statuses from '../src/repository/server-status.ts'
import * as similarRepo from '../src/repository/similar.ts'
import * as titles from '../src/repository/title.ts'
import * as users from '../src/repository/user.ts'
import * as similar from '../src/similar.ts'
import * as telegram from '../src/telegram.ts'
import * as watcher from '../src/watcher.ts'
import { forgetResearch, handle, heroArt } from '../src/web.ts'
import { makeContext, makeGame, makeTitle, makeTrophy, makeUser } from './api-fixtures.ts'
import { counts } from './fixtures.ts'

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

async function send(
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const raw = body === undefined ? [] : [typeof body === 'string' ? body : JSON.stringify(body)]
  const req = Object.assign(Readable.from(raw), { method, url, headers })
  const res = new FakeResponse()
  await handle(req as unknown as IncomingMessage, res as unknown as ServerResponse)
  const type = res.headers['content-type'] ?? ''
  return {
    status: res.status,
    headers: res.headers,
    body: type === 'application/json' ? JSON.parse(res.body) : res.body,
  }
}

const me = makeUser()
const game = makeGame()
const title = makeTitle()
const freshGuide = { version: GUIDE_VERSION, overview: 'ok' } as Guide
const played = (seconds: number): Playtime => ({
  game: game.id,
  seconds,
  play_count: 1,
  first_played_at: null,
  last_played_at: null,
})
const saved = { research: config.automatic.research, skip: config.auth.skipVerification }

beforeEach(() => {
  forgetResearch()
  resetRateLimits()
  config.automatic.research = true
  spyOn(console, 'error').mockImplementation(() => {})
  spyOn(auth, 'authenticate').mockResolvedValue(me)
  spyOn(similarRepo, 'guideFacts').mockResolvedValue([])
  spyOn(deepguide, 'deepGuideStats').mockResolvedValue(null)
  spyOn(deepguide, 'ensureDeepGuide').mockResolvedValue(null)
  spyOn(guide, 'ensureGuide').mockResolvedValue(freshGuide)
  spyOn(interests, 'yearProgress').mockResolvedValue({ year: 2026 } as never)
  spyOn(interests, 'handleInterestCommand').mockResolvedValue('ok')
  spyOn(interests, 'storeFor').mockResolvedValue(null)
  spyOn(lib, 'library').mockResolvedValue([title])
  spyOn(lib, 'ownedGames').mockResolvedValue([])
  spyOn(playtime, 'playtimes').mockResolvedValue(new Map())
  spyOn(psn, 'titleTrophies').mockResolvedValue([makeTrophy()])
  spyOn(psn, 'catalogTrophies').mockResolvedValue(null)
  spyOn(psn, 'profileSummary').mockResolvedValue({ onlineId: 'Kratos' } as never)
  spyOn(ranking, 'loadGroups').mockResolvedValue(null)
  spyOn(ranking, 'rankNextPlatinum').mockResolvedValue([])
  spyOn(recommend, 'recommendations').mockResolvedValue({ items: [] } as never)
  spyOn(recommend, 'dismissRecommendation').mockResolvedValue()
  spyOn(activity, 'recentTips').mockResolvedValue([])
  spyOn(activity, 'unreadNotifications').mockResolvedValue(0)
  spyOn(activity, 'recentMessages').mockResolvedValue([])
  spyOn(games, 'getGame').mockResolvedValue(game)
  spyOn(games, 'catalogGameForName').mockResolvedValue(undefined as never)
  spyOn(games, 'gameForTitle').mockResolvedValue(game)
  spyOn(guides, 'getGuide').mockResolvedValue(freshGuide)
  spyOn(requests, 'requestGuide').mockResolvedValue()
  spyOn(statuses, 'listServerStatuses').mockResolvedValue([])
  spyOn(users, 'updateUser').mockResolvedValue()
  spyOn(users, 'setLinkCode').mockResolvedValue()
  spyOn(telegram, 'botInfo').mockResolvedValue({ username: 'nexo_bot', name: 'Nexo' })
  spyOn(telegram, 'botUsername').mockResolvedValue('nexo_bot')
  spyOn(watcher, 'getCurrent').mockReturnValue(undefined)
  spyOn(watcher, 'watchNow').mockImplementation(() => {})
  spyOn(watcher, 'forgetUser').mockImplementation(() => {})
  // The chat follows the game being played unless a test picks another.
  spyOn(watcher, 'getChat').mockImplementation((u) => watcher.getCurrent(u))
})

afterEach(() => {
  config.automatic.research = saved.research
  config.auth.skipVerification = saved.skip
  mock.restore()
})

const signedIn = { user: makeUser({ telegram_chat_id: '42' }), token: 'tok' }

test('logout clears the session cookie', async () => {
  const logout = spyOn(auth, 'logout').mockResolvedValue()
  const res = await send('POST', '/api/auth/logout')
  expect(res.status).toBe(200)
  expect(res.headers['set-cookie']).toContain('Max-Age=0')
  expect(logout).toHaveBeenCalled()
})

test('auth routes refuse an invalid PSN id', async () => {
  const res = await send('POST', '/api/auth/login', { onlineId: 'a b', password: 'x' })
  expect(res).toMatchObject({ status: 400, body: { error: 'invalid_psn_id' } })
})

test('lookup answers the account status', async () => {
  spyOn(auth, 'accountStatus').mockResolvedValue({ status: 'new' } as never)
  const res = await send('POST', '/api/auth/lookup', { onlineId: 'Kratos' })
  expect(res.body).toEqual({ status: 'new' })
})

test('register and login sign in, start watching and set the cookie', async () => {
  const register = spyOn(auth, 'register').mockResolvedValue(signedIn)
  const login = spyOn(auth, 'login').mockResolvedValue(signedIn)
  for (const path of ['/api/auth/register', '/api/auth/login']) {
    const res = await send('POST', path, { onlineId: 'Kratos', password: 'secret12' })
    expect(res.status).toBe(200)
    expect(res.headers['set-cookie']).toStartWith('platjourney_session=tok;')
    expect(res.body.user).toEqual({
      id: 'user:1',
      onlineId: 'Kratos',
      avatarUrl: null,
      telegramLinked: true,
      includeDlcProgress: false,
      psPlus: 'none',
      aiNotices: true,
      aiNoticesAvailable: config.automatic.notices,
      notifyTelegram: true,
      pushKey: null,
      locale: 'pt-BR',
      demo: false,
      onboarded: false,
    })
  }
  expect(register).toHaveBeenCalledWith('Kratos', 'secret12')
  expect(login).toHaveBeenCalledWith('Kratos', 'secret12', '')
  expect(watcher.watchNow).toHaveBeenCalledTimes(2)
})

test('a claim starts with a code and finishes with a session', async () => {
  config.auth.skipVerification = true
  const start = spyOn(auth, 'startClaim').mockResolvedValue({
    code: 'TC-ABCDEF',
    secret: 's3cret',
  } as never)
  const finish = spyOn(auth, 'finishClaim').mockResolvedValue(signedIn)
  const started = await send('POST', '/api/auth/claim', { onlineId: 'Kratos' })
  // The secret goes only in an HttpOnly cookie on the claim routes, never in the body.
  expect(started.body).toEqual({ code: 'TC-ABCDEF', skipVerification: true })
  expect(started.headers['set-cookie']).toContain(
    'platjourney_claim=s3cret; Path=/api/auth/claim; HttpOnly; SameSite=Strict',
  )
  const cookie = { cookie: 'platjourney_claim=s3cret' }
  await send('POST', '/api/auth/claim', { onlineId: 'Kratos' }, cookie)
  expect(start).toHaveBeenLastCalledWith('Kratos', 's3cret')
  const done = await send(
    'POST',
    '/api/auth/claim/finish',
    { onlineId: 'Kratos', password: 7, fresh: true },
    cookie,
  )
  expect(finish).toHaveBeenCalledWith('Kratos', '', true, 's3cret')
  expect(done.headers['set-cookie'] as unknown).toEqual([
    expect.stringContaining('platjourney_session='),
    expect.stringContaining('platjourney_claim=; Path=/api/auth/claim'),
  ])
})

test('a change asked from another site is refused; the same site and server calls are not', async () => {
  const other = await send(
    'POST',
    '/api/chat',
    { text: 'oi' },
    { origin: 'https://evil.example', host: 'app.example' },
  )
  expect(other).toMatchObject({ status: 403, body: { error: 'cross_origin' } })
  const bad = await send(
    'POST',
    '/api/chat',
    { text: 'oi' },
    { origin: 'nonsense', host: 'app.example' },
  )
  expect(bad.status).toBe(403)
  spyOn(nexo, 'reply').mockResolvedValue({ text: 'ok' } as never)
  const same = await send(
    'POST',
    '/api/chat',
    { text: 'oi' },
    { origin: 'https://app.example', host: 'app.example' },
  )
  expect(same.status).not.toBe(403)
  // A read from another site is not a change: it goes through (CORS keeps the answer from it).
  expect(
    (
      await send('GET', '/api/me', undefined, {
        origin: 'https://evil.example',
        host: 'app.example',
      })
    ).status,
  ).not.toBe(403)
})

test('sign-in routes and the demo are limited per address', async () => {
  spyOn(auth, 'accountStatus').mockResolvedValue({} as never)
  for (let i = 0; i < 30; i++) await send('POST', '/api/auth/lookup', { onlineId: 'Kratos' })
  const cut = await send('POST', '/api/auth/lookup', { onlineId: 'Kratos' })
  expect(cut).toMatchObject({ status: 429, body: { error: 'too_many_requests' } })
  expect(auth.accountStatus).toHaveBeenCalledTimes(30)
  spyOn(auth, 'demoSession').mockResolvedValue(null)
  for (let i = 0; i < 5; i++) await send('POST', '/api/auth/demo')
  expect((await send('POST', '/api/auth/demo')).status).toBe(429)
})

test("the chat reads the current game's conversation, another game's, or the one without a game", async () => {
  const read = spyOn(activity, 'recentMessages').mockResolvedValue([])
  await send('GET', '/api/chat')
  expect(read).toHaveBeenLastCalledWith(me.id, 40, null)
  spyOn(watcher, 'getCurrent').mockReturnValue(makeContext())
  await send('GET', '/api/chat')
  expect(read).toHaveBeenLastCalledWith(me.id, 40, makeContext().game.id)
  await send('GET', '/api/chat?game=game:9')
  expect(read).toHaveBeenLastCalledWith(me.id, 40, 'game:9')
  await send('GET', '/api/chat?game=none')
  expect(read).toHaveBeenLastCalledWith(me.id, 40, null)
  spyOn(nexo, 'reply').mockResolvedValue('ok')
  await send('POST', '/api/chat', { text: 'oi' })
  expect(read).toHaveBeenLastCalledWith(me.id, 40, makeContext().game.id)
})

test('a chat message with no game loaded first checks what the player is on', async () => {
  const check = spyOn(watcher, 'chatOrCheck').mockResolvedValue(makeContext())
  const answer = spyOn(nexo, 'reply').mockResolvedValue('ok')
  await send('POST', '/api/chat', { text: 'oi' })
  expect(check).toHaveBeenCalledWith(me)
  expect(answer.mock.calls[0][2]).toEqual(makeContext())
})

test('the conversations list comes from the repository', async () => {
  spyOn(activity, 'chatThreads').mockResolvedValue([])
  expect((await send('GET', '/api/chat/threads')).body).toEqual([])
})

test('auth failures answer with their status and message', async () => {
  spyOn(auth, 'login').mockRejectedValue(new AuthError('too_many_attempts'))
  const res = await send('POST', '/api/auth/login', { onlineId: 'Kratos', password: 'x' })
  expect(res).toMatchObject({ status: 429, body: { error: 'too_many_attempts' } })
})

test('private trophies, a plugin refusal and anything else have their own answers', async () => {
  const reply = spyOn(nexo, 'reply')
  reply.mockRejectedValueOnce(new PrivateProfile())
  expect((await send('POST', '/api/chat', { text: 'oi' })).status).toBe(409)
  reply.mockRejectedValueOnce(new Refused('not_allowed', 'Agora não.', 402))
  expect(await send('POST', '/api/chat', { text: 'oi' })).toMatchObject({
    status: 402,
    body: { error: 'not_allowed', message: 'Agora não.' },
  })
  reply.mockRejectedValueOnce(new Error('boom'))
  expect((await send('POST', '/api/chat', { text: 'oi' })).status).toBe(500)
  expect(console.error).toHaveBeenCalledWith('web failed:', 'boom')
})

test('a body that is not JSON is a bad request, and one too big is refused', async () => {
  expect(await send('POST', '/api/chat', '{nope')).toMatchObject({
    status: 400,
    body: { error: 'bad_json' },
  })
  const big = await send('POST', '/api/chat', JSON.stringify({ text: 'x'.repeat(200_000) }))
  expect(big).toMatchObject({ status: 413, body: { error: 'body_too_large' } })
})

test('an unknown auth route needs a session like any other', async () => {
  spyOn(auth, 'authenticate').mockResolvedValue(undefined)
  const res = await send('POST', '/api/auth/other', { onlineId: 'Kratos' })
  expect(res).toMatchObject({ status: 401, body: { error: 'unauthenticated' } })
})

test('unknown api routes are not found', async () => {
  expect((await send('GET', '/api/nothing')).status).toBe(404)
})

test('me names the Telegram bot only when a chat is linked', async () => {
  expect((await send('GET', '/api/me')).body).toMatchObject({
    user: { telegramBot: null },
  })
  spyOn(auth, 'authenticate').mockResolvedValue(makeUser({ telegram_chat_id: '42' }))
  expect((await send('GET', '/api/me')).body.user.telegramBot).toEqual({
    username: 'nexo_bot',
    name: 'Nexo',
  })
  spyOn(telegram, 'botInfo').mockRejectedValue(new Error('down'))
  expect((await send('GET', '/api/me')).body.user.telegramBot).toBeNull()
})

test('the introduction is marked seen once and shows as such', async () => {
  expect((await send('GET', '/api/me')).body.user.onboarded).toBe(false)
  expect((await send('POST', '/api/account/onboarded')).body).toEqual({ ok: true })
  expect(users.updateUser).toHaveBeenCalledWith(me.id, { onboarded_at: expect.any(Date) })
  spyOn(auth, 'authenticate').mockResolvedValue(makeUser({ onboarded_at: '2026-10-02T12:00:00Z' }))
  expect((await send('GET', '/api/me')).body.user.onboarded).toBe(true)
})

test('preferences take the notices choice', async () => {
  const res = await send('POST', '/api/account/preferences', { aiNotices: false })
  expect(res.body.user.aiNotices).toBe(false)
  expect(users.updateUser).toHaveBeenCalledWith(me.id, { ai_notices: false })
})

test('preferences take the Telegram notices choice', async () => {
  const res = await send('POST', '/api/account/preferences', { notifyTelegram: false })
  expect(res.body.user.notifyTelegram).toBe(false)
  expect(users.updateUser).toHaveBeenCalledWith(me.id, { notify_telegram: false })
})

describe('push', () => {
  const saved = { ...config.push }
  const sub = { endpoint: 'https://push.example/a', keys: { p256dh: 'k', auth: 's' } }
  beforeEach(() => {
    config.push.publicKey = 'pub'
    config.push.privateKey = 'priv'
  })
  afterEach(() => Object.assign(config.push, saved))

  test('the account says which key to subscribe with, none when push is off', async () => {
    expect((await send('GET', '/api/me')).body.user.pushKey).toBe('pub')
    config.push.privateKey = null
    expect((await send('GET', '/api/me')).body.user.pushKey).toBeNull()
    expect((await send('POST', '/api/push/subscription', sub)).status).toBe(404)
  })

  test('a device subscribes with an https endpoint and its keys', async () => {
    const save = spyOn(pushSubs, 'savePushSubscription').mockResolvedValue()
    expect((await send('POST', '/api/push/subscription', { endpoint: 'http://x' })).status).toBe(
      400,
    )
    expect((await send('POST', '/api/push/subscription', sub)).body).toEqual({ ok: true })
    expect(save).toHaveBeenCalledWith(me.id, { endpoint: sub.endpoint, p256dh: 'k', auth: 's' })
  })

  test('a device unsubscribes only from its own account', async () => {
    const drop = spyOn(pushSubs, 'deletePushSubscription').mockResolvedValue()
    expect((await send('DELETE', '/api/push/subscription', {})).status).toBe(400)
    expect(
      (await send('DELETE', '/api/push/subscription', { endpoint: sub.endpoint })).status,
    ).toBe(200)
    expect(drop).toHaveBeenCalledWith(sub.endpoint, me.id)
  })

  test('a test notice goes to every device of the player', async () => {
    const to = spyOn(push, 'pushTo').mockResolvedValue(2)
    expect((await send('POST', '/api/push/test')).body).toEqual({ sent: 2 })
    expect(to.mock.calls[0][1]).toMatchObject({ title: 'Nexo', url: '/#/history' })
  })
})

test('preferences take a boolean DLC choice', async () => {
  expect((await send('POST', '/api/account/preferences', {})).status).toBe(400)
  const res = await send('POST', '/api/account/preferences', { includeDlcProgress: true })
  expect(res.body.user.includeDlcProgress).toBe(true)
  expect(users.updateUser).toHaveBeenCalledWith(me.id, { include_dlc_progress: true })
})

test('password change validates input and reports a wrong current password', async () => {
  const change = spyOn(auth, 'changePassword').mockResolvedValue()
  expect((await send('POST', '/api/account/password', { current: 1 })).status).toBe(400)
  expect((await send('POST', '/api/account/password', { current: 'a', next: 'b' })).body).toEqual({
    ok: true,
  })
  change.mockRejectedValueOnce(new AuthError('wrong_password'))
  expect((await send('POST', '/api/account/password', { current: 'a', next: 'b' })).body).toEqual({
    error: 'wrong_password',
    message: 'A senha atual não confere.',
  })
  change.mockRejectedValueOnce(new AuthError('weak_password'))
  const weak = await send('POST', '/api/account/password', { current: 'a', next: 'b' })
  expect(weak).toMatchObject({ status: 400, body: { error: 'weak_password' } })
})

test('deleting the account forgets the user and clears the cookie', async () => {
  const remove = spyOn(auth, 'deleteAccount').mockResolvedValue()
  const res = await send('DELETE', '/api/account', { onlineId: 'Kratos' })
  expect(res.headers['set-cookie']).toContain('Max-Age=0')
  expect(remove).toHaveBeenCalledWith(me, 'Kratos')
  expect(watcher.forgetUser).toHaveBeenCalledWith(me.id)
  await send('DELETE', '/api/account', {})
  expect(remove).toHaveBeenLastCalledWith(me, '')
})

test('the Telegram link keeps a code still valid, and replaces one about to expire', async () => {
  const inAWhile = new Date(Date.now() + 10 * 60_000)
  spyOn(auth, 'authenticate').mockResolvedValue(
    makeUser({ telegram_link_code: 'abc', telegram_link_expires_at: inAWhile }),
  )
  expect((await send('POST', '/api/telegram/link')).body).toEqual({
    url: 'https://t.me/nexo_bot?start=abc',
  })
  expect(users.setLinkCode).not.toHaveBeenCalled()
  spyOn(auth, 'authenticate').mockResolvedValue(
    makeUser({
      telegram_link_code: 'abc',
      telegram_link_expires_at: new Date(Date.now() + 30_000),
    }),
  )
  const { url } = (await send('POST', '/api/telegram/link')).body
  expect(url).not.toEndWith('=abc')
  expect(users.setLinkCode).toHaveBeenCalledWith(me.id, url.split('start=')[1])
})

test('the Telegram link makes a code the first time, and unlinking drops it', async () => {
  const { url } = (await send('POST', '/api/telegram/link')).body
  const code = url.split('start=')[1]
  expect(users.setLinkCode).toHaveBeenCalledWith(me.id, code)
  await send('DELETE', '/api/telegram/link')
  expect(users.updateUser).toHaveBeenLastCalledWith(me.id, {
    telegram_chat_id: null,
    telegram_link_code: null,
  })
})

test('state without a current game starts watching and ranks the library', async () => {
  const groups = {
    base: { earned: 8, total: 10 },
    dlc: { earned: 1, total: 4 },
  }
  spyOn(ranking, 'rankNextPlatinum').mockResolvedValue([
    { game, title, groups, baseProgress: 80, remaining: 2 },
    { game: makeGame({ id: 'game:2' }), title, groups: null, baseProgress: 50, remaining: 5 },
  ] as never)
  spyOn(playtime, 'playtimes').mockResolvedValue(new Map([[game.id, played(7200)]]))
  spyOn(statuses, 'listServerStatuses').mockResolvedValue([
    { game: game.id, status: 'closed' },
    { game: 'game:2', status: 'unknown' },
  ] as never)
  const user = makeUser({ id: 'user:state' })
  spyOn(auth, 'authenticate').mockResolvedValue(user)
  // The guide's estimate and difficulty ride along; an unknown 0 goes as null.
  spyOn(similarRepo, 'guideFacts').mockResolvedValue([
    { game: game.id, hours: 80, difficulty: 4 },
    { game: 'game:2', hours: 0, difficulty: 0 },
  ])
  const { body } = await send('GET', '/api/state')
  expect(watcher.watchNow).toHaveBeenCalledWith(user)
  // null, not missing: the web app reads a missing game as still loading.
  expect(body).toHaveProperty('current', null)
  expect(body.ranking).toEqual([
    {
      game: game.id,
      name: game.name,
      platform: 'PS5',
      icon: 'icon.png',
      cover: 'cover.png',
      progress: 80,
      remaining: 2,
      hours: 2,
      total: 10,
      earned: 8,
      dlc: { earned: 1, total: 4 },
      guideHours: 80,
      difficulty: 4,
    },
    expect.objectContaining({
      hours: null,
      total: 10,
      earned: 5,
      dlc: null,
      guideHours: null,
      difficulty: null,
    }),
  ])
  expect(body.servers).toEqual([{ game: game.id, status: 'closed' }])
  expect(body.profile).toEqual({ onlineId: 'Kratos' })
  await send('GET', '/api/state')
  expect(psn.profileSummary).toHaveBeenCalledTimes(1)
})

test('state shows the current game and leaves it out of the ranking', async () => {
  config.automatic.research = false
  spyOn(watcher, 'getCurrent').mockReturnValue(makeContext({ hoursPlayed: 3 }))
  const { body } = await send('GET', '/api/state')
  expect(watcher.watchNow).not.toHaveBeenCalled()
  expect(ranking.rankNextPlatinum).toHaveBeenCalledWith([title], me, 20, ['NPWR1'])
  expect(body.current).toMatchObject({
    game: { id: game.id },
    name: 'Days Gone',
    np: 'NPWR1',
    hoursPlayed: 3,
    queued: true,
    deepGuide: null,
  })
})

test('an owned title comes with progress, trophies and a ready guide', async () => {
  spyOn(playtime, 'playtimes').mockResolvedValue(new Map([[game.id, played(3600)]]))
  const res = await send('GET', '/api/title?game=game:1')
  expect(res.status).toBe(200)
  expect(res.body).toMatchObject({
    owned: true,
    np: 'NPWR1',
    hoursPlayed: 1,
    progress: 50,
    guide: { overview: 'ok' },
    building: false,
    queued: false,
  })
  expect(deepguide.ensureDeepGuide).toHaveBeenCalledWith(game, 10)
})

test('the copy with more progress wins, PS5 first when equal', async () => {
  spyOn(lib, 'library').mockResolvedValue([
    makeTitle({ platform: 'PS4', progress: 50 }),
    makeTitle({ platform: 'PS5', progress: 50 }),
    makeTitle({ platform: 'PS4', progress: 20 }),
  ])
  expect((await send('GET', '/api/title?game=game:1')).body.platform).toBe('PS5')
})

test('a title found by its trophy list id resolves its catalog game', async () => {
  spyOn(games, 'getGame').mockResolvedValue(undefined)
  const res = await send('GET', '/api/title?id=NPWR1')
  expect(res.body.owned).toBe(true)
  expect(games.gameForTitle).toHaveBeenCalledWith(title)
})

test('an unknown title is not found', async () => {
  spyOn(lib, 'library').mockResolvedValue([])
  const res = await send('GET', '/api/title?name=Zelda&platform=PS4')
  expect(res.status).toBe(404)
  expect(games.catalogGameForName).toHaveBeenCalledWith('Zelda', 'PS4')
})

test('a title by name is looked up only from this site, a few times a minute', async () => {
  spyOn(lib, 'library').mockResolvedValue([])
  const lookup = spyOn(games, 'catalogGameForName').mockResolvedValue(undefined)
  const away = await send('GET', '/api/title?name=Zelda', undefined, {
    'sec-fetch-site': 'cross-site',
  })
  expect(away.status).toBe(403)
  expect(lookup).not.toHaveBeenCalled()
  resetRateLimits()
  const answers = []
  for (let i = 0; i < 21; i++) answers.push((await send('GET', '/api/title?name=Zelda')).status)
  expect(answers.slice(0, 20).every((s) => s === 404)).toBe(true)
  expect(answers[20]).toBe(429)
  expect(lookup).toHaveBeenCalledTimes(20)
  resetRateLimits()
})

test('a title the player does not own uses the catalog trophy list', async () => {
  spyOn(lib, 'library').mockResolvedValue([])
  spyOn(games, 'catalogGameForName').mockResolvedValue(game)
  spyOn(psn, 'catalogTrophies').mockResolvedValue({
    platform: 'PS4',
    trophies: [makeTrophy()],
  } as never)
  const res = await send('GET', '/api/title?name=Days')
  expect(res.body).toMatchObject({ owned: false, platform: 'PS5', guide: { overview: 'ok' } })
  expect(res.body.trophies).toHaveLength(1)
  expect(deepguide.ensureDeepGuide).toHaveBeenCalledWith(game)
})

test('a catalog game without trophy lists has no trophies', async () => {
  spyOn(lib, 'library').mockResolvedValue([])
  spyOn(games, 'getGame').mockResolvedValue(makeGame({ np_communication_ids: [], platforms: [] }))
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  config.automatic.research = false
  const res = await send('GET', '/api/title?game=game:1&platform=PS4')
  expect(res.body).toMatchObject({ trophies: null, platform: 'PS4', queued: true, guide: null })
  expect(psn.catalogTrophies).not.toHaveBeenCalled()
  expect(requests.requestGuide).toHaveBeenCalledWith('game:1')
})

test('without research an old guide is still shown', async () => {
  config.automatic.research = false
  spyOn(guides, 'getGuide').mockResolvedValue({ overview: 'old' } as Guide)
  const res = await send('GET', '/api/title?game=game:1')
  expect(res.body).toMatchObject({ guide: { overview: 'old' }, queued: false, building: false })
  expect(requests.requestGuide).not.toHaveBeenCalled()
})

test('a missing guide is built once while the page polls', async () => {
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  let finish = (_: Guide) => {}
  const build = spyOn(guide, 'ensureGuide').mockReturnValue(
    new Promise<Guide>((resolve) => {
      finish = resolve
    }),
  )
  const first = await send('GET', '/api/title?game=game:1')
  expect(first.body).toMatchObject({ guide: null, building: true })
  await send('GET', '/api/title?game=game:1')
  expect(build).toHaveBeenCalledTimes(1)
  expect(build).toHaveBeenCalledWith(game, [makeTrophy()], { name: 'Days Gone', platform: 'PS5' })
  finish(freshGuide)
})

test('research is capped: a few at a time, and a daily number per player', async () => {
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  spyOn(lib, 'library').mockResolvedValue([])
  spyOn(games, 'getGame').mockImplementation(async (id: string) => makeGame({ id }))
  const pending: ((g: Guide) => void)[] = []
  const build = spyOn(guide, 'ensureGuide').mockImplementation(
    () => new Promise<Guide>((resolve) => pending.push(resolve)),
  )
  for (const n of [1, 2, 3]) await send('GET', `/api/title?game=game:${n}`)
  const fourth = await send('GET', '/api/title?game=game:4')
  expect(fourth.body).toMatchObject({ guide: null, queued: true })
  expect(requests.requestGuide).toHaveBeenCalledWith('game:4')
  expect(build).toHaveBeenCalledTimes(3)
  for (const finish of pending.splice(0)) finish(freshGuide)
  await Bun.sleep(0)

  build.mockResolvedValue(freshGuide)
  for (let n = 5; n < 12; n++) {
    await send('GET', `/api/title?game=game:${n}`)
    await Bun.sleep(0)
  }
  expect(build).toHaveBeenCalledTimes(10)
  const past = await send('GET', '/api/title?game=game:12')
  expect(past.body).toMatchObject({ guide: null, queued: true })
  expect(build).toHaveBeenCalledTimes(10)
})

test('a failed guide build is logged', async () => {
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  spyOn(lib, 'library').mockResolvedValue([])
  spyOn(guide, 'ensureGuide').mockRejectedValue(new Error('no pages'))
  await send('GET', '/api/title?game=game:1')
  await Bun.sleep(0)
  expect(console.error).toHaveBeenCalledWith('guide failed:', 'no pages')
})

test('a failed deep guide is logged', async () => {
  spyOn(deepguide, 'ensureDeepGuide').mockRejectedValue(new Error('no index'))
  await send('GET', '/api/title?game=game:1')
  spyOn(lib, 'library').mockResolvedValue([])
  await send('GET', '/api/title?game=game:1')
  await Bun.sleep(0)
  expect(console.error).toHaveBeenCalledTimes(2)
  expect(console.error).toHaveBeenCalledWith('deep guide failed:', 'no index')
})

test('the profile page adds the account', async () => {
  spyOn(profile, 'profilePage').mockResolvedValue({ totalHours: 5 } as never)
  expect((await send('GET', '/api/profile')).body).toMatchObject({
    totalHours: 5,
    user: { id: me.id },
  })
})

test('plans are read, discarded and made for 15 to 600 minutes', async () => {
  spyOn(planner, 'currentPlan').mockResolvedValue(null)
  spyOn(planner, 'discardPlan').mockResolvedValue()
  const make = spyOn(planner, 'planSession').mockResolvedValue({ minutes: 60 } as never)
  expect((await send('GET', '/api/plan')).body).toEqual({ plan: null })
  expect((await send('DELETE', '/api/plan')).body).toEqual({ plan: null })
  expect((await send('POST', '/api/plan', { minutes: 60 })).status).toBe(409)
  const ctx = makeContext()
  spyOn(watcher, 'getCurrent').mockReturnValue(ctx)
  expect((await send('POST', '/api/plan', { minutes: 5 })).status).toBe(400)
  expect((await send('POST', '/api/plan', { minutes: '60' })).status).toBe(400)
  expect((await send('POST', '/api/plan', { minutes: 60 })).body).toEqual({ plan: { minutes: 60 } })
  expect(make).toHaveBeenCalledWith(me, ctx, 60)
})

test('a trophy tip needs a missing trophy from the library', async () => {
  const help = spyOn(nexo, 'trophyHelp').mockResolvedValue('faça assim')
  spyOn(psn, 'titleTrophies').mockResolvedValue([
    makeTrophy({ id: 1 }),
    makeTrophy({ id: 2, earned: true }),
  ])
  const tip = (body: unknown) => send('POST', '/api/trophy-tip', body)
  expect((await tip({ np: 'NPWR1' })).status).toBe(400)
  expect((await tip({ np: 'OTHER', trophyId: 1 })).body.error).toBe('title not in your library')
  expect((await tip({ np: 'NPWR1', trophyId: 9 })).body.error).toBe('trophy not found')
  expect((await tip({ np: 'NPWR1', trophyId: 2 })).status).toBe(409)
  expect((await tip({ np: 'NPWR1', trophyId: 1 })).body).toEqual({ text: 'faça assim' })
  expect(help.mock.calls[0][1]).toMatchObject({ game, title, guide: freshGuide, hoursPlayed: null })
})

test('older tips come 30 at a time before a date', async () => {
  const older = spyOn(activity, 'tipsBefore').mockResolvedValue([])
  expect((await send('GET', '/api/tips')).status).toBe(400)
  expect((await send('GET', '/api/tips?before=2026-10-01T10:00:00Z')).body).toEqual([])
  expect(older).toHaveBeenLastCalledWith(me.id, new Date('2026-10-01T10:00:00Z'), 30)
})

test('notifications are paged within bounds and can be marked read', async () => {
  const page = spyOn(activity, 'notificationsPage').mockResolvedValue({ items: [] } as never)
  spyOn(activity, 'markNotificationsRead').mockResolvedValue()
  expect((await send('GET', '/api/notifications')).body).toEqual({ page: 1, size: 8, items: [] })
  await send('GET', '/api/notifications?page=-3&size=99')
  expect(page).toHaveBeenLastCalledWith(me.id, 1, 30)
  expect((await send('POST', '/api/notifications/read')).body).toEqual({ ok: true })
})

test('chat lists messages and answers trimmed text', async () => {
  const reply = spyOn(nexo, 'reply').mockResolvedValue('olá')
  expect((await send('GET', '/api/chat')).body).toEqual([])
  expect((await send('POST', '/api/chat', { text: '   ' })).status).toBe(400)
  const res = await send('POST', '/api/chat', { text: `  ${'a'.repeat(2500)}` })
  expect(res.body).toEqual({ text: 'olá', messages: [] })
  expect((reply.mock.calls[0][1] as string).length).toBe(config.chat.maxChars)
})

test('the guide browser reads its filters from the query', async () => {
  const facets = {
    difficulty: { easy: 0, medium: 0, hard: 0, brutal: 0 },
    hours: {},
    noMissables: 0,
    onePlaythrough: 0,
    noOnline: 0,
    genres: [],
  }
  const browse = spyOn(browser, 'browseGuides').mockResolvedValue({
    page: 2,
    size: 24,
    total: 30,
    items: [],
    facets,
    collage: [],
  })
  expect(
    (
      await send(
        'GET',
        '/api/guides?q=souls&platform=PS5&sort=easiest&page=2&difficulty=medium&hours=25&noMissables=1&genre=RPG',
      )
    ).body,
  ).toEqual({ page: 2, size: 24, total: 30, items: [], facets, collage: [] })
  expect(browse).toHaveBeenLastCalledWith({
    query: 'souls',
    platform: 'PS5',
    sort: 'easiest',
    page: 2,
    difficulty: 'medium',
    hours: '25',
    noMissables: true,
    onePlaythrough: false,
    noOnline: false,
    genre: 'RPG',
  })
  await send('GET', '/api/guides?page=x')
  expect(browse).toHaveBeenLastCalledWith({
    query: undefined,
    platform: undefined,
    sort: undefined,
    page: 1,
    difficulty: undefined,
    hours: undefined,
    noMissables: false,
    onePlaythrough: false,
    noOnline: false,
    genre: undefined,
  })
})

test('the calendar asks for the last two weeks and the next six', async () => {
  const releases = spyOn(games, 'releasesBetween').mockResolvedValue([])
  expect((await send('GET', '/api/releases')).body).toEqual([])
  const [from, to] = releases.mock.calls[0] as [Date, Date]
  expect(Math.round((to.getTime() - from.getTime()) / 86_400_000)).toBe(56)
})

test('game search passes the query on', async () => {
  const search = spyOn(games, 'searchCatalog').mockResolvedValue([game])
  expect((await send('GET', '/api/games/search?q=days')).body).toHaveLength(1)
  await send('GET', '/api/games/search')
  expect(search).toHaveBeenLastCalledWith('')
})

test('a game the search missed is looked up in IGDB, or kept as a request', async () => {
  const ask = (name: unknown) => send('POST', '/api/games/request', { name })
  expect((await ask(3)).status).toBe(400)
  expect((await ask(' x ')).status).toBe(400)
  const lookup = spyOn(games, 'catalogGameForName').mockResolvedValueOnce(game)
  const keep = spyOn(missing, 'requestMissingGame').mockResolvedValue(false)
  expect((await ask(' Jogo Exemplo ')).body).toEqual({ game: game.id })
  expect(lookup).toHaveBeenLastCalledWith('Jogo Exemplo')
  expect(keep).not.toHaveBeenCalled()
  lookup.mockResolvedValueOnce(undefined)
  expect((await ask('Jogo Inexistente')).body).toEqual({ requested: true, already: false })
  expect(keep).toHaveBeenLastCalledWith('Jogo Inexistente', me.id)
  lookup.mockResolvedValueOnce(undefined)
  keep.mockResolvedValueOnce(true)
  expect((await ask('Jogo Inexistente')).body).toEqual({ requested: true, already: true })
})

test('asking for missing games is limited per account', async () => {
  spyOn(games, 'catalogGameForName').mockResolvedValue(undefined)
  spyOn(missing, 'requestMissingGame').mockResolvedValue(false)
  for (let i = 0; i < 5; i++)
    expect((await send('POST', '/api/games/request', { name: 'Jogo Exemplo' })).status).toBe(200)
  expect((await send('POST', '/api/games/request', { name: 'Jogo Exemplo' })).status).toBe(429)
})

test('goals accept only catalog games to add', async () => {
  const goals = (command: unknown) => send('POST', '/api/goals', { command })
  expect((await goals(3)).status).toBe(400)
  expect((await goals('add zelda')).status).toBe(400)
  spyOn(games, 'getGame').mockResolvedValueOnce(undefined)
  expect((await goals('add game:9')).status).toBe(400)
  expect((await goals('add game:1')).body).toEqual({ year: 2026 })
  // Where the game was saved from rides after the id and reaches the command as it came.
  expect((await goals('add game:1 from:releases')).status).toBe(200)
  expect(interests.handleInterestCommand).toHaveBeenLastCalledWith(me, 'add game:1 from:releases', [
    title,
  ])
  expect(await goals('set 12')).toMatchObject({ status: 200 })
  expect(interests.handleInterestCommand).toHaveBeenLastCalledWith(me, 'set 12', [title])
})

test('recommendations can be dismissed and refreshed', async () => {
  const recs = spyOn(recommend, 'recommendations')
  expect((await send('POST', '/api/recommendations/dismiss', { game: 'x' })).status).toBe(400)
  await send('POST', '/api/recommendations/dismiss', { game: 'game:2' })
  expect(recommend.dismissRecommendation).toHaveBeenCalledWith(me, 'game:2', undefined)
  await send('POST', '/api/recommendations/dismiss', { game: 'game:3', reason: 'online' })
  expect(recommend.dismissRecommendation).toHaveBeenLastCalledWith(me, 'game:3', 'online')
  const bad = await send('POST', '/api/recommendations/dismiss', { game: 'game:4', reason: 'meh' })
  expect(bad.status).toBe(400)
  await send('GET', '/api/recommendations?refresh=1')
  expect(recs).toHaveBeenLastCalledWith(me, [title], [], true, false)
  await send('GET', '/api/recommendations')
  expect(recs).toHaveBeenLastCalledWith(me, [title], [], false, false)
})

test('stored=1 answers only the saved batch, never a new one', async () => {
  const recs = spyOn(recommend, 'recommendations')
  const res = await send('GET', '/api/recommendations?stored=1')
  expect(res.status).toBe(200)
  expect(recs).toHaveBeenLastCalledWith(me, [title], [], false, true)
})

test('recommendations by similar games answer from the graph, without the model', async () => {
  const body = { items: [], quick: [], series: [], reason: 'no-library' as const }
  const picks = spyOn(similar, 'similarPicks').mockResolvedValue(body)
  const res = await send('GET', '/api/recommendations/similar')
  expect(res).toMatchObject({ status: 200, body })
  expect(picks).toHaveBeenCalledWith(me, [title], [])
  expect(recommend.recommendations).not.toHaveBeenCalled()
})

test('a game page asks for its similar games by id', async () => {
  const items = [{ game, difficulty: 3, hours: 12, relation: 'expansion' as const }]
  const related = spyOn(similar, 'similarToGame').mockResolvedValue(items)
  expect((await send('GET', '/api/games/similar')).status).toBe(400)
  expect((await send('GET', '/api/games/similar?game=title:1')).status).toBe(400)
  const res = await send('GET', '/api/games/similar?game=game:1')
  expect(res).toMatchObject({ status: 200, body: { items } })
  expect(related).toHaveBeenCalledWith('game:1')
})

const nexoPick = {
  id: 'recommendation:1',
  game: { id: 'game:2', name: 'Inside' },
  why: 'Curto',
  firstStep: 'Comece',
  mood: null,
  scope: 'interests' as const,
  ownedOnly: false,
  fits: true,
  at: '2026-10-18T10:00:00Z',
}

test('Nexo picks a game on request, with the mood and where to look, checked', async () => {
  spyOn(nextPickModule, 'nextPick').mockResolvedValue(nexoPick)
  const res = await send('POST', '/api/picks', {})
  expect(res).toMatchObject({ status: 200, body: { pick: nexoPick } })
  expect(nextPickModule.nextPick).toHaveBeenCalledWith(me, [title], 'pt-BR', {
    mood: undefined,
    scope: undefined,
    ownedOnly: false,
  })
  await send('POST', '/api/picks', {
    mood: `curto${'x'.repeat(200)}`,
    scope: 'any',
    ownedOnly: true,
  })
  expect(nextPickModule.nextPick).toHaveBeenLastCalledWith(me, [title], 'pt-BR', {
    mood: `curto${'x'.repeat(115)}`,
    scope: 'any',
    ownedOnly: true,
  })
  expect((await send('POST', '/api/picks', { scope: 'all' })).status).toBe(400)
  expect((await send('POST', '/api/picks', { mood: 7 })).status).toBe(400)
})

test('the picks asked for before, the latest first', async () => {
  spyOn(nextPickModule, 'pickHistory').mockResolvedValue([nexoPick])
  expect(await send('GET', '/api/picks')).toMatchObject({
    status: 200,
    body: { picks: [nexoPick] },
  })
})

test('taste preferences are checked, saved and answered with the stored batch', async () => {
  const recs = spyOn(recommend, 'recommendations')
  expect((await send('POST', '/api/recommendations/preferences', { added: 'x' })).status).toBe(400)
  const prefs = {
    added: { genres: ['Soulslike'], traits: [], avoid: [] },
    removed: { genres: [], traits: [], avoid: [] },
    filters: { noOnline: true },
  }
  expect((await send('POST', '/api/recommendations/preferences', prefs)).status).toBe(200)
  expect(users.updateUser).toHaveBeenLastCalledWith(me.id, { taste_prefs: prefs })
  expect(recs).toHaveBeenLastCalledWith({ ...me, taste_prefs: prefs }, [title], [], false, true)
})

test('pages come from the built app, with long cache only for assets', async () => {
  spyOn(fs, 'existsSync').mockReturnValue(true)
  spyOn(fs, 'readFileSync').mockReturnValue('<html>')
  const index = await send('GET', '/')
  expect(index).toMatchObject({ status: 200, body: '<html>' })
  expect(index.headers).toEqual({
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-cache',
    'content-security-policy': pagePolicy(),
    ...SECURITY_HEADERS,
  })
  expect(pagePolicy()).toContain("frame-ancestors 'none'")
  const asset = await send('GET', '/assets/app.js')
  expect(asset.headers).toEqual({
    'content-type': 'text/javascript; charset=utf-8',
    'cache-control': 'public, max-age=31536000, immutable',
    ...SECURITY_HEADERS,
  })
  config.auth.secureCookie = true
  expect((await send('GET', '/')).headers['strict-transport-security']).toContain('max-age=')
  config.auth.secureCookie = false
  await send('GET', '/../secret.txt')
  expect(
    String((fs.existsSync as unknown as ReturnType<typeof spyOn>).mock.lastCall?.[0]),
  ).toEndWith('/index.html')
})

test('the app shell points link previews at its image with the address the visitor used', async () => {
  spyOn(fs, 'existsSync').mockReturnValue(true)
  spyOn(fs, 'readFileSync').mockReturnValue('<meta property="og:image" content="/og.png">')
  const behindProxy = await send('GET', '/', undefined, {
    host: 'app.example.com',
    'x-forwarded-proto': 'https',
  })
  expect(behindProxy.body).toBe(
    '<meta property="og:image" content="https://app.example.com/og.png">',
  )
  const direct = await send('GET', '/', undefined, { host: '127.0.0.1:3000' })
  expect(direct.body).toBe('<meta property="og:image" content="http://127.0.0.1:3000/og.png">')
  const forged = await send('GET', '/', undefined, { host: 'x"><script>alert(1)</script>' })
  expect(forged.body).toBe('<meta property="og:image" content="/og.png">')
  expect((await send('GET', '/')).body).toBe('<meta property="og:image" content="/og.png">')
})

test('without a build or for other methods there is nothing to serve', async () => {
  spyOn(fs, 'existsSync').mockReturnValue(false)
  expect(await send('GET', '/goals')).toMatchObject({ status: 404, body: 'not found' })
  expect(await send('POST', '/')).toMatchObject({ status: 404, body: 'not found' })
})

test('an error after the answer started is left alone', async () => {
  spyOn(fs, 'existsSync').mockReturnValue(true)
  spyOn(fs, 'readFileSync').mockImplementation(() => {
    throw new Error('disk')
  })
  const res = await send('GET', '/')
  expect(res).toMatchObject({ status: 200, body: '' })
  expect(console.error).not.toHaveBeenCalled()
})

describe('the demo', () => {
  const demo = makeUser({ id: 'user:demo', psn_account_id: DEMO_ACCOUNT_ID, demo: true })
  const readOnly = {
    error: 'demo_read_only',
    message:
      'Isto é uma demonstração: dá para ver tudo, mas nada é salvo. Conecte sua conta da PSN para usar de verdade.',
  }

  beforeEach(() => {
    spyOn(auth, 'authenticate').mockResolvedValue(demo)
  })

  test('opens without a password and starts on its stored game', async () => {
    const session = spyOn(auth, 'demoSession').mockResolvedValue({ user: demo, token: 'tok' })
    spyOn(auth, 'authenticate').mockResolvedValue(undefined)
    const res = await send('POST', '/api/auth/demo')
    expect(res.status).toBe(200)
    expect(res.headers['set-cookie']).toStartWith('platjourney_session=tok;')
    expect(res.body.user).toMatchObject({ id: 'user:demo', demo: true })
    expect(watcher.watchNow).toHaveBeenCalledWith(demo)
    session.mockResolvedValue(null)
    const missing = await send('POST', '/api/auth/demo', undefined, { 'accept-language': 'en' })
    expect(missing).toEqual({
      status: 404,
      headers: { 'content-type': 'application/json', ...SECURITY_HEADERS },
      body: { error: 'demo_unavailable', message: 'The demo is not available on this server.' },
    })
  })

  const writes: [string, string, unknown?][] = [
    ['POST', '/api/goals', { command: 'set 12' }],
    ['POST', '/api/account/preferences', { includeDlcProgress: true }],
    ['POST', '/api/account/preferences', { includeDlcProgress: true, locale: 'en' }],
    ['POST', '/api/account/password', { current: 'a', next: 'b' }],
    ['DELETE', '/api/account', { onlineId: 'PlatJourneyDemo' }],
    ['POST', '/api/telegram/link', {}],
    ['DELETE', '/api/telegram/link'],
    ['POST', '/api/plan', { minutes: 60 }],
    ['DELETE', '/api/plan'],
    ['POST', '/api/chat', { text: 'oi' }],
    ['POST', '/api/trophy-tip', { np: 'NPWR1', trophyId: 1 }],
    ['POST', '/api/recommendations/dismiss', { game: 'game:2' }],
    ['POST', '/api/recommendations/preferences', {}],
    ['POST', '/api/picks', {}],
    ['GET', '/api/recommendations?refresh=1'],
    ['POST', '/api/anything'],
  ]
  test('reads recommendations by similar games and the similar games of a game', async () => {
    const picks = spyOn(similar, 'similarPicks').mockResolvedValue({
      items: [],
      quick: [],
      series: [],
    })
    spyOn(similar, 'similarToGame').mockResolvedValue([])
    expect(await send('GET', '/api/recommendations/similar')).toMatchObject({ status: 200 })
    expect(picks).toHaveBeenCalledWith(demo, [title], [])
    expect(await send('GET', '/api/games/similar?game=game:1')).toMatchObject({
      status: 200,
      body: { items: [] },
    })
  })

  test.each(writes)('refuses %s %s as read-only', async (method, path, body) => {
    const spies = [
      spyOn(interests, 'handleInterestCommand'),
      spyOn(auth, 'changePassword'),
      spyOn(auth, 'deleteAccount'),
      spyOn(planner, 'planSession'),
      spyOn(planner, 'discardPlan'),
      spyOn(nexo, 'reply'),
      spyOn(nexo, 'trophyHelp'),
      users.updateUser,
      recommend.dismissRecommendation,
      recommend.recommendations,
    ]
    const res = await send(method, path, body)
    expect(res).toMatchObject({ status: 403, body: readOnly })
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
  })

  test('plugin routes only read for the demo too', async () => {
    const ran: string[] = []
    await registerPlugin({
      name: 'demo-fixture',
      register(ctx) {
        ctx.route('read', async ({ res }) => {
          ran.push('read')
          res.writeHead(204).end()
        })
        ctx.route(
          'write',
          async ({ res }) => {
            ran.push('write')
            res.writeHead(204).end()
          },
          { method: 'POST' },
        )
      },
    })
    try {
      expect((await send('GET', '/api/ext/read')).status).toBe(204)
      expect(await send('POST', '/api/ext/write')).toMatchObject({ status: 403, body: readOnly })
      expect(ran).toEqual(['read'])
    } finally {
      resetPlugins()
    }
  })

  test('the read-only notice follows the page language', async () => {
    const res = await send('POST', '/api/chat', { text: 'oi' }, { 'accept-language': 'en-US' })
    expect(res.body.message).toStartWith('This is a demo')
  })

  test('marking notices read, the introduction seen and a language answer without saving', async () => {
    const mark = spyOn(activity, 'markNotificationsRead').mockResolvedValue()
    expect((await send('POST', '/api/notifications/read')).body).toEqual({ ok: true })
    expect((await send('POST', '/api/account/onboarded')).body).toEqual({ ok: true })
    expect((await send('GET', '/api/me')).body.user.onboarded).toBe(false)
    const res = await send('POST', '/api/account/preferences', { locale: 'en' })
    expect(res.body.user).toMatchObject({ locale: 'en', demo: true })
    expect(mark).not.toHaveBeenCalled()
    expect(users.updateUser).not.toHaveBeenCalled()
  })

  test('reads still work, tagged so nothing reaches PSN or the model', async () => {
    let tag: unknown
    spyOn(recommend, 'recommendations').mockImplementation(async () => {
      tag = (await import('../src/costs.ts')).currentTag()
      return { items: [] } as never
    })
    expect((await send('GET', '/api/recommendations')).status).toBe(200)
    expect(tag).toEqual({ user: demo.id, demo: true })
  })

  test('state loads the stored current game at once, with the stored profile', async () => {
    const ctx = makeContext()
    const load = spyOn(watcher, 'demoContext').mockResolvedValue(ctx)
    spyOn(lib, 'library').mockResolvedValue([makeTitle({ earnedByType: counts(3, 1, 0, 1) })])
    const { body } = await send('GET', '/api/state')
    expect(load).toHaveBeenCalledWith(demo)
    expect(watcher.watchNow).not.toHaveBeenCalled()
    expect(body.current).toMatchObject({ name: 'Days Gone', deepGuide: null })
    expect(body.profile).toMatchObject({ onlineId: 'Kratos', earned: counts(3, 1, 0, 1) })
    expect(psn.profileSummary).not.toHaveBeenCalled()
    expect(deepguide.deepGuideStats).not.toHaveBeenCalled()
  })

  test('an owned title shows the stored trophies and guide, and asks nothing', async () => {
    const stored = [makeTrophy({ id: 7, earned: true })]
    spyOn(titles, 'getTitle').mockResolvedValue({ trophies: stored } as never)
    const res = await send('GET', '/api/title?game=game:1')
    expect(res.body).toMatchObject({ owned: true, trophies: stored, guide: { overview: 'ok' } })
    expect(res.body.deepGuide).toBeNull()
    expect(psn.titleTrophies).not.toHaveBeenCalled()
    expect(deepguide.ensureDeepGuide).not.toHaveBeenCalled()
    expect(deepguide.deepGuideStats).not.toHaveBeenCalled()
  })

  test('a game outside the library shows its stored guide without a trophy list', async () => {
    spyOn(lib, 'library').mockResolvedValue([])
    spyOn(guides, 'getGuide').mockResolvedValue(undefined)
    const byName = spyOn(games, 'gameByName').mockResolvedValue(game)
    const res = await send('GET', '/api/title?name=Days')
    expect(res.body).toMatchObject({ owned: false, trophies: null, guide: null, building: false })
    expect(byName).toHaveBeenCalledWith('Days')
    expect(games.catalogGameForName).not.toHaveBeenCalled()
    expect(psn.catalogTrophies).not.toHaveBeenCalled()
    expect(guide.ensureGuide).not.toHaveBeenCalled()
    expect(requests.requestGuide).not.toHaveBeenCalled()
    expect(deepguide.ensureDeepGuide).not.toHaveBeenCalled()
  })
})

test('the hero uses PS5 list art, or the 1080p cover for older lists', () => {
  const cover = 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg'
  expect(heroArt({ cover_url: cover }, { platform: 'PS5', iconUrl: 'ps5.png' })).toBe('ps5.png')
  expect(heroArt({ cover_url: cover }, { platform: 'PS4', iconUrl: 'ps4.png' })).toBe(
    'https://images.igdb.com/igdb/image/upload/t_1080p/co1.jpg',
  )
  expect(heroArt({ cover_url: null }, { platform: 'PS3', iconUrl: 'ps3.png' })).toBe('ps3.png')
  expect(heroArt({ cover_url: null })).toBeNull()
  expect(
    heroArt({ cover_url: cover, art_url: 'art.jpg' }, { platform: 'PS4', iconUrl: 'ps4.png' }),
  ).toBe('art.jpg')
  expect(
    heroArt({ cover_url: cover, art_url: 'art.jpg' }, { platform: 'PS5', iconUrl: 'ps5.png' }),
  ).toBe('art.jpg')
})

test('plugin routes: public ones skip sign-in, the others get the player, and a refusal keeps its status', async () => {
  const seen: unknown[] = []
  await registerPlugin({
    name: 'web-fixture',
    register(ctx) {
      ctx.route(
        'hook',
        async ({ res, me }) => {
          seen.push(me)
          res.writeHead(204).end()
        },
        { public: true, method: 'POST' },
      )
      ctx.route('mine', async ({ res, me }) => {
        seen.push(me?.id)
        res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}')
      })
      ctx.route('refuse', async () => {
        throw new Refused('no_plan', 'Sem plano', 402)
      })
      ctx.route(
        'change',
        async ({ res }) => {
          res.writeHead(204).end()
        },
        { method: 'POST' },
      )
    },
  })
  try {
    expect((await send('POST', '/api/ext/hook')).status).toBe(204)
    expect((await send('GET', '/api/ext/mine')).status).toBe(200)
    expect(seen).toEqual([undefined, me.id])
    // A route answers only its method: a link (GET) cannot trigger a change.
    const viaLink = await send('GET', '/api/ext/change')
    expect(viaLink).toMatchObject({ status: 405, headers: { allow: 'POST' } })
    expect((await send('POST', '/api/ext/mine')).status).toBe(405)
    expect((await send('POST', '/api/ext/change')).status).toBe(204)
    const refused = await send('GET', '/api/ext/refuse')
    expect(refused.status).toBe(402)
    expect(refused.body).toEqual({ error: 'no_plan', message: 'Sem plano' })
  } finally {
    resetPlugins()
  }
})

test('a plugin steps in before any request: it answers in place of the app, or lets it through', async () => {
  const seen: string[] = []
  spyOn(auth, 'openSession').mockResolvedValue({ user: me, token: 'f'.repeat(64) })
  await registerPlugin({
    name: 'sso-fixture',
    register(ctx) {
      ctx.intercept(
        '/api/auth/login',
        async ({ res, me }) => {
          await ctx.signIn(res, me ?? makeUser())
          ctx.json(res, 200, { via: 'sso' })
        },
        { method: 'POST' },
      )
      ctx.intercept('/api/ext/*', async ({ url, me }) => {
        seen.push(`${url.pathname} ${me?.id}`)
      })
      ctx.intercept('/ads.txt', async ({ res }) => {
        res.writeHead(200, { 'content-type': 'text/plain' }).end('example.com, pub-1')
      })
      ctx.route('mine', async ({ res }) => {
        res.writeHead(204).end()
      })
    },
  })
  try {
    const login = await send('POST', '/api/auth/login', { onlineId: 'x', password: 'y' })
    expect(login.body).toEqual({ via: 'sso' })
    expect(login.headers['set-cookie']).toStartWith(`platjourney_session=${'f'.repeat(64)};`)
    expect((await send('GET', '/api/ext/mine')).status).toBe(204)
    expect(seen).toEqual([`/api/ext/mine ${me.id}`])
    expect((await send('GET', '/ads.txt')).body).toBe('example.com, pub-1')
    // Another site's page cannot reach a plugin's change either.
    const forged = await send(
      'POST',
      '/api/auth/login',
      {},
      { origin: 'https://evil.test', host: 'localhost' },
    )
    expect(forged.status).toBe(403)
  } finally {
    resetPlugins()
  }
})

test("a plugin adds sources to the page's policy, and only to the directives it may change", async () => {
  spyOn(fs, 'existsSync').mockReturnValue(true)
  spyOn(fs, 'readFileSync').mockReturnValue('<html>')
  await registerPlugin({
    name: 'ads-fixture',
    register(ctx) {
      ctx.allowOnPage('script-src', 'https://ads.example')
      ctx.allowOnPage('frame-src', 'https://frames.example', 'https://ads.example')
    },
  })
  try {
    const policy = (await send('GET', '/')).headers['content-security-policy']
    expect(policy).toContain("script-src 'self' https://ads.example;")
    expect(policy).toContain("frame-src 'self' https://frames.example https://ads.example;")
    expect(policy).toContain("frame-ancestors 'none'")
  } finally {
    resetPlugins()
  }
  expect(pagePolicy()).not.toContain('ads.example')
})

test('the chat game switch lists the player titles by name and loads the one picked', async () => {
  spyOn(lib, 'library').mockResolvedValue([
    makeTitle({ npCommunicationId: 'NPWR1', name: 'Days Gone' }),
    makeTitle({ npCommunicationId: 'NPWR2', name: 'Ghost of Tsushima', progress: 64 }),
  ])
  spyOn(watcher, 'getCurrent').mockReturnValue(makeContext())
  spyOn(games, 'searchCatalog').mockResolvedValue([])
  const found = await send('GET', '/api/library?q=ghost')
  expect(found.body).toEqual([
    expect.objectContaining({
      np: 'NPWR2',
      name: 'Ghost of Tsushima',
      progress: 64,
      current: false,
    }),
  ])
  const set = spyOn(watcher, 'setChat').mockResolvedValue(makeContext())
  const res = await send('POST', '/api/current', { np: 'NPWR2' })
  expect(res.status).toBe(200)
  expect(set.mock.calls[0][1]).toMatchObject({ npCommunicationId: 'NPWR2' })
  expect((await send('POST', '/api/current', { np: 'NOPE' })).status).toBe(404)
})

test('the game switch also offers catalog games outside the library and talks about them', async () => {
  spyOn(lib, 'library').mockResolvedValue([
    makeTitle({ npCommunicationId: 'NPWR2', name: 'Jogo Exemplo Dois' }),
  ])
  spyOn(watcher, 'getCurrent').mockReturnValue(undefined)
  const outside = makeGame({
    id: 'game:9',
    name: 'Jogo Exemplo Novo',
    np_communication_ids: ['NPWR9'],
  })
  const owned = makeGame({
    id: 'game:2',
    name: 'Jogo Exemplo Dois',
    np_communication_ids: ['NPWR2'],
  })
  spyOn(games, 'searchCatalog').mockResolvedValue([outside, owned])
  const found = await send('GET', '/api/library?q=jogo exemplo')
  expect(found.body).toEqual([
    expect.objectContaining({ np: 'NPWR2', owned: true }),
    expect.objectContaining({ game: 'game:9', name: 'Jogo Exemplo Novo', owned: false }),
  ])
  spyOn(games, 'getGame').mockImplementation((async (id: string) =>
    id === 'game:9' ? outside : owned) as never)
  const fromCatalog = spyOn(watcher, 'setChatFromCatalog').mockResolvedValue(makeContext())
  const set = spyOn(watcher, 'setChat').mockResolvedValue(makeContext())
  expect((await send('POST', '/api/current', { game: 'game:9' })).status).toBe(200)
  expect(fromCatalog.mock.calls[0][1]).toBe(outside)
  // A catalog game the player owns goes through the title, with progress.
  await send('POST', '/api/current', { game: 'game:2' })
  expect(set.mock.calls[0][1]).toMatchObject({ npCommunicationId: 'NPWR2' })
  fromCatalog.mockResolvedValueOnce(null)
  expect((await send('POST', '/api/current', { game: 'game:9' })).status).toBe(404)
})

test('the PS Plus tier is a preference, and an unknown one is refused', async () => {
  const update = spyOn(users, 'updateUser').mockResolvedValue(undefined as never)
  expect((await send('POST', '/api/account/preferences', { psPlus: 'extra' })).status).toBe(200)
  expect(update).toHaveBeenLastCalledWith(expect.any(String), { ps_plus: 'extra' })
  expect((await send('POST', '/api/account/preferences', { psPlus: 'gold' })).status).toBe(400)
})
