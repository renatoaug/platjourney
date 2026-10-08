import './env.ts'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { config } from '../src/config.ts'
import * as deepguide from '../src/deepguide.ts'
import { DEMO_ACCOUNT_ID } from '../src/demo.ts'
import type { Guide } from '../src/guide.ts'
import * as guide from '../src/guide.ts'
import * as lib from '../src/library.ts'
import * as nexo from '../src/nexo.ts'
import * as playtime from '../src/playtime.ts'
import { Refused } from '../src/plugins.ts'
import * as psn from '../src/psn.ts'
import * as ranking from '../src/ranking.ts'
import * as activity from '../src/repository/activity.ts'
import * as sessions from '../src/repository/auth.ts'
import * as games from '../src/repository/game.ts'
import * as guides from '../src/repository/guide.ts'
import * as requests from '../src/repository/guide-request.ts'
import type { TitleRow } from '../src/repository/title.ts'
import * as titles from '../src/repository/title.ts'
import * as users from '../src/repository/user.ts'
import * as servers from '../src/servers.ts'
import * as telegram from '../src/telegram.ts'
import {
  checkUser,
  demoContext,
  forgetUser,
  getCurrent,
  SESSION_NOTICE_HOURS,
  sessionNotice,
  setCurrent,
  startWatcher,
  watchNow,
} from '../src/watcher.ts'
import { counts, makeGame, makeTitle, makeTrophy, makeUser } from './fixtures.ts'

const automatic = { ...config.automatic }
const user = makeUser({ id: 'user:w1', telegram_chat_id: '42' })
const game = makeGame()
const routeGuide = {
  milestones: [
    { after: null, tips: [{ kind: 'warning', text: 'Jogue no Difícil.', trophy: null }] },
    { after: 'Segundo', tips: [{ kind: 'item', text: 'Compre o arco.', trophy: null }] },
  ],
} as unknown as Guide
const trophies = [
  makeTrophy({ id: 1, name: 'Primeiro', earned: true }),
  makeTrophy({ id: 2, name: 'Segundo', type: 'gold', earned: true, earnedRate: 12.5 }),
  makeTrophy({ id: 3, name: 'Terceiro' }),
]
const row = (over: Partial<TitleRow> = {}): TitleRow => ({
  id: 'title:t1',
  user: user.id,
  game: game.id,
  np_communication_id: 'NPWR1_00',
  name: 'Days Gone',
  platform: 'PS4',
  icon_url: '',
  progress: 50,
  earned: 10,
  total: 20,
  earned_ids: [1],
  groups: null,
  last_updated_at: '2026-05-01T09:00:00.000Z',
  last_tip_at: '2026-04-01T00:00:00.000Z',
  ...over,
})

let recent: ReturnType<typeof spyOn<typeof psn, 'recentTitles'>>
let getTitle: ReturnType<typeof spyOn<typeof titles, 'getTitle'>>
let send: ReturnType<typeof spyOn<typeof telegram, 'sendMessage'>>
let logTip: ReturnType<typeof spyOn<typeof activity, 'logTip'>>
let markTip: ReturnType<typeof spyOn<typeof titles, 'markTipSent'>>
let saveEarned: ReturnType<typeof spyOn<typeof titles, 'saveEarnedIds'>>
let getGuide: ReturnType<typeof spyOn<typeof guides, 'getGuide'>>
let playing: ReturnType<typeof spyOn<typeof psn, 'nowPlaying'>>
let updateUser: ReturnType<typeof spyOn<typeof users, 'updateUser'>>

beforeEach(() => {
  spyOn(sessions, 'pruneExpired').mockResolvedValue()
  config.automatic.notices = true
  config.automatic.research = false
  recent = spyOn(psn, 'recentTitles').mockResolvedValue([makeTitle()])
  spyOn(psn, 'titleTrophies').mockResolvedValue(trophies)
  spyOn(games, 'gameForTitle').mockResolvedValue(game)
  spyOn(ranking, 'loadGroups').mockResolvedValue(null)
  getGuide = spyOn(guides, 'getGuide').mockResolvedValue(routeGuide)
  spyOn(deepguide, 'ensureDeepGuide').mockResolvedValue(null)
  spyOn(playtime, 'playtimes').mockResolvedValue(
    new Map([
      [
        game.id,
        {
          game: game.id,
          seconds: 7200,
          play_count: 1,
          first_played_at: null,
          last_played_at: null,
        },
      ],
    ]),
  )
  getTitle = spyOn(titles, 'getTitle').mockResolvedValue(row())
  spyOn(titles, 'upsertTitle').mockResolvedValue(row())
  saveEarned = spyOn(titles, 'saveEarnedIds').mockResolvedValue(undefined)
  markTip = spyOn(titles, 'markTipSent').mockResolvedValue(undefined)
  logTip = spyOn(activity, 'logTip').mockResolvedValue(undefined)
  send = spyOn(telegram, 'sendMessage').mockResolvedValue(undefined)
  playing = spyOn(psn, 'nowPlaying').mockResolvedValue(null)
  updateUser = spyOn(users, 'updateUser').mockResolvedValue(undefined)
  spyOn(console, 'log').mockImplementation(() => {})
  spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  Object.assign(config.automatic, automatic)
  forgetUser(user.id)
  mock.restore()
})

const started = () => makeTitle({ progress: 5, earned: 1 })

describe('session start', () => {
  const roadmapGuide = {
    ...routeGuide,
    roadmap: [
      { phase: 'Fase 1', goal: '', trophies: ['Primeiro'] },
      { phase: 'Fase 2', goal: '', trophies: ['Segundo', 'Terceiro'] },
    ],
  } as unknown as Guide
  const unchanged = () =>
    getTitle.mockResolvedValue(
      row({ earned_ids: [1, 2], earned: 10, last_updated_at: '2026-05-01T10:00:00.000Z' }),
    )

  test('opening the game in context sends one notice with what is left and the roadmap phase', async () => {
    unchanged()
    getGuide.mockResolvedValue(roadmapGuide)
    playing.mockResolvedValue('DAYS GONE')
    await checkUser(user)
    const text =
      '🎮 Days Gone aberto. Bom jogo!\nFalta 1 troféu do jogo base para a platina.\nPróximo no roteiro (Fase 2): Terceiro.'
    expect(logTip).toHaveBeenCalledWith(user.id, 'session', text, game.id)
    expect(send.mock.calls).toEqual([['42', text]])
    expect(updateUser.mock.calls[0][1].session_notice_at).toBeInstanceOf(Date)
  })

  test('another game gets the notice with its name only', async () => {
    unchanged()
    playing.mockResolvedValue('ASTRO BOT')
    await checkUser(user)
    expect(logTip).toHaveBeenCalledWith(
      user.id,
      'session',
      '🎮 ASTRO BOT aberto. Bom jogo!',
      undefined,
    )
  })

  test(`within ${SESSION_NOTICE_HOURS} hours of the last one, presence is not even asked`, async () => {
    unchanged()
    await checkUser({ ...user, session_notice_at: new Date(Date.now() - 3_600_000) })
    expect(playing).not.toHaveBeenCalled()
    await checkUser({ ...user, session_notice_at: new Date(Date.now() - 7 * 3_600_000) })
    expect(playing).toHaveBeenCalledTimes(1)
  })

  test('nothing open, nothing sent and nothing stamped', async () => {
    unchanged()
    await checkUser(user)
    expect(send).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  test('a game just started already got its start notice: no second one, but it counts', async () => {
    getTitle.mockResolvedValue(undefined)
    recent.mockResolvedValue([started()])
    spyOn(nexo, 'proactiveTip').mockResolvedValue('Bora!')
    playing.mockResolvedValue('Days Gone')
    await checkUser(user)
    expect(send.mock.calls).toEqual([['42', 'Bora!']])
    expect(updateUser).toHaveBeenCalledTimes(1)
  })

  test('the notice without a game in context, in English', () => {
    const en = { ...user, locale: 'en' as const }
    expect(sessionNotice(en, 'Days Gone')).toBe('🎮 Days Gone is on. Have a good session!')
  })
})

describe('checkUser', () => {
  test('nothing happens without recent titles', async () => {
    recent.mockResolvedValue([])
    await checkUser(user)
    expect(getTitle).not.toHaveBeenCalled()
    expect(getCurrent(user)).toBeUndefined()
  })

  test('a game just started gets one message from Nexo, with the opening route in it', async () => {
    getTitle.mockResolvedValue(undefined)
    recent.mockResolvedValue([started()])
    const tip = spyOn(nexo, 'proactiveTip').mockResolvedValue('Bora!')
    await checkUser(user)
    expect(tip.mock.calls[0][2]).toBe('Antes de começar:\n• Jogue no Difícil.')
    expect(markTip).toHaveBeenCalledWith(user.id, 'NPWR1_00')
    expect(send.mock.calls).toEqual([['42', 'Bora!']])
    expect(saveEarned).toHaveBeenCalledWith(user.id, 'NPWR1_00', [1, 2])
    expect(getCurrent(user)?.hoursPlayed).toBe(2)
  })

  test('new trophies get one reaction from Nexo, with the route in it', async () => {
    const reaction = spyOn(nexo, 'unlockReaction').mockResolvedValue('Boa!')
    await checkUser(user)
    expect(reaction.mock.calls[0][2].map((t) => t.id)).toEqual([2])
    expect(reaction.mock.calls[0][3]).toBe('Agora vale saber:\n• Compre o arco.')
    expect(send.mock.calls.map((c) => c[1])).toEqual(['Boa!'])
  })

  test('two checks at once send the reaction once', async () => {
    let stored = row()
    getTitle.mockImplementation(async () => stored)
    saveEarned.mockImplementation(async (_user, _id, ids) => {
      stored = row({ earned_ids: ids })
    })
    const reaction = spyOn(nexo, 'unlockReaction').mockResolvedValue('Boa!')
    await Promise.all([checkUser(user), checkUser(user)])
    expect(reaction).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledTimes(1)
  })

  test('a failed Telegram send still saves the trophies as seen, with no second notice', async () => {
    const reaction = spyOn(nexo, 'unlockReaction').mockResolvedValue('Boa!')
    send.mockRejectedValue(new Error('Forbidden: bot was blocked by the user'))
    await checkUser(user)
    expect(reaction).toHaveBeenCalledTimes(1)
    expect(logTip).not.toHaveBeenCalled()
    expect(saveEarned).toHaveBeenCalledWith(user.id, 'NPWR1_00', [1, 2])
  })

  test('with notices off, trophies get a plain notice', async () => {
    config.automatic.notices = false
    const reaction = spyOn(nexo, 'unlockReaction')
    await checkUser(user)
    expect(reaction).not.toHaveBeenCalled()
    const text =
      '🏆 Segundo (ouro, 12,5% de quem joga) em Days Gone\n\nAgora vale saber:\n• Compre o arco.'
    expect(logTip).toHaveBeenCalledWith(user.id, 'unlock', text, game.id)
    expect(send.mock.calls).toEqual([['42', text]])
  })

  test('a player who turned Nexo’s notices off gets the plain one', async () => {
    const reaction = spyOn(nexo, 'unlockReaction')
    await checkUser({ ...user, ai_notices: false })
    expect(reaction).not.toHaveBeenCalled()
    expect(send.mock.calls[0][1]).toStartWith('🏆 Segundo')
  })

  test('with notices off, a new game gets a plain start notice', async () => {
    config.automatic.notices = false
    getTitle.mockResolvedValue(undefined)
    recent.mockResolvedValue([started()])
    await checkUser(user)
    const text =
      'Você começou Days Gone. O guia da platina está no PlatJourney.\n\nAntes de começar:\n• Jogue no Difícil.'
    expect(logTip).toHaveBeenCalledWith(user.id, 'start', text, game.id)
    expect(markTip).toHaveBeenCalled()
  })

  test('when Nexo is down the player still gets the plain notice', async () => {
    spyOn(nexo, 'unlockReaction').mockRejectedValue(new Error('model down'))
    await checkUser(user)
    expect(logTip.mock.calls[0][1]).toBe('unlock')
    getTitle.mockResolvedValue(undefined)
    recent.mockResolvedValue([started()])
    spyOn(nexo, 'proactiveTip').mockRejectedValue(new Error('model down'))
    await checkUser(user)
    expect(logTip.mock.calls.some((c) => c[1] === 'start')).toBe(true)
  })

  test('refused by a plugin, the plain notice goes instead', async () => {
    spyOn(nexo, 'unlockReaction').mockRejectedValue(new Refused('not_allowed', 'Agora não.'))
    getGuide.mockResolvedValue(undefined)
    spyOn(requests, 'requestGuide').mockResolvedValue(undefined)
    await checkUser(user)
    expect(logTip.mock.calls[0][1]).toBe('unlock')
    expect(send).toHaveBeenCalledTimes(1)
  })

  test('the first sync of an old game sends nothing', async () => {
    getTitle.mockResolvedValue(undefined)
    const tip = spyOn(nexo, 'proactiveTip')
    await checkUser(user)
    expect(tip).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
    expect(saveEarned).toHaveBeenCalledWith(user.id, 'NPWR1_00', [1, 2])
  })

  test('an unchanged title reuses the loaded context', async () => {
    getTitle.mockResolvedValue(
      row({ earned_ids: [1, 2], earned: 10, last_updated_at: '2026-05-01T10:00:00.000Z' }),
    )
    await checkUser(user)
    const ctx = getCurrent(user)
    await checkUser(user)
    expect(getCurrent(user)).toBe(ctx)
    expect(psn.titleTrophies).toHaveBeenCalledTimes(1)
  })

  test('a route tip that fails to send is skipped', async () => {
    spyOn(nexo, 'unlockReaction').mockResolvedValue('Boa!')
    logTip.mockRejectedValue(new Error('db down'))
    await checkUser(user)
    expect(saveEarned).toHaveBeenCalled()
  })

  test('players without Telegram only get the tip log', async () => {
    config.automatic.notices = false
    await checkUser(makeUser({ id: 'user:w2' }))
    forgetUser('user:w2')
    expect(logTip).toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })
})

describe('setCurrent', () => {
  test('without automatic research a missing guide is only requested', async () => {
    getGuide.mockResolvedValue(undefined)
    const request = spyOn(requests, 'requestGuide').mockResolvedValue(undefined)
    const deep = spyOn(deepguide, 'ensureDeepGuide')
    const ctx = await setCurrent(user, makeTitle())
    expect(request).toHaveBeenCalledWith(game.id)
    expect(ctx.guide).toBeUndefined()
    expect(deep).not.toHaveBeenCalled()
    expect(getCurrent(user)).toBe(ctx)
  })

  test('with automatic research a missing guide is built', async () => {
    config.automatic.research = true
    getGuide.mockResolvedValue(undefined)
    const ensure = spyOn(guide, 'ensureGuide').mockResolvedValue(routeGuide)
    const deep = spyOn(deepguide, 'ensureDeepGuide').mockResolvedValue(null)
    const ctx = await setCurrent(user, makeTitle())
    expect(ensure).toHaveBeenCalledWith(game, trophies, { name: 'Days Gone', platform: 'PS4' })
    expect(deep).toHaveBeenCalledWith(game, 20)
    expect(ctx.guide).toBe(routeGuide)
  })

  test('a failed guide leaves the context without one', async () => {
    config.automatic.research = true
    getGuide.mockResolvedValue(undefined)
    const error = spyOn(console, 'error').mockImplementation(() => {})
    spyOn(guide, 'ensureGuide').mockRejectedValue(new Error('down'))
    expect((await setCurrent(user, makeTitle())).guide).toBeUndefined()
    expect(error).toHaveBeenCalledWith('guide failed:', 'down')
  })

  test('a failed deep guide or playtime does not break the context', async () => {
    const error = spyOn(console, 'error').mockImplementation(() => {})
    spyOn(deepguide, 'ensureDeepGuide').mockRejectedValue(new Error('deep down'))
    spyOn(playtime, 'playtimes').mockRejectedValue(new Error('psn down'))
    const ctx = await setCurrent(user, makeTitle())
    expect(ctx.hoursPlayed).toBeNull()
    await Bun.sleep(1)
    expect(error).toHaveBeenCalledWith('deep guide failed:', 'deep down')
  })
})

describe('background runs', () => {
  test('watchNow checks the user and logs failures', async () => {
    const error = spyOn(console, 'error').mockImplementation(() => {})
    recent.mockRejectedValue(new Error('psn down'))
    watchNow(user)
    for (let i = 0; i < 50 && error.mock.calls.length === 0; i++) await Bun.sleep(1)
    expect(error).toHaveBeenCalledWith('watcher failed for Player:', 'psn down')
  })

  test('the watcher sweeps every user and, with research on, checks servers', async () => {
    config.automatic.research = true
    const intervals = spyOn(globalThis, 'setInterval').mockImplementation((() => 0) as never)
    const timeouts = spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn()
      return 0
    }) as never)
    const error = spyOn(console, 'error').mockImplementation(() => {})
    const other = makeUser({ id: 'user:w3', psn_online_id: 'Hidden', telegram_chat_id: '7' })
    spyOn(users, 'listUsers').mockResolvedValue([user, other])
    recent.mockImplementation((async (account: string) => {
      if (account === 'acc1' && recent.mock.calls.length > 1) throw new psn.PrivateProfile()
      return []
    }) as never)
    spyOn(lib, 'library').mockResolvedValue([])
    const check = spyOn(servers, 'checkServers').mockImplementation((async (u: { id: string }) =>
      u.id === user.id ? ['⚠️ fecha'] : Promise.reject(new Error('search down'))) as never)
    startWatcher(15)
    for (let i = 0; i < 50 && check.mock.calls.length < 2; i++) await Bun.sleep(1)
    await Bun.sleep(1)
    timeouts.mockRestore()
    expect(intervals.mock.calls.map((c) => c[1])).toEqual([
      15 * 60_000,
      60 * 60_000,
      24 * 60 * 60_000,
    ])
    expect(send).toHaveBeenCalledWith('42', '⚠️ fecha')
    expect(error).toHaveBeenCalledWith('server check failed for Hidden:', 'search down')
    expect(error.mock.calls.some((c) => String(c[0]).startsWith('watcher failed'))).toBe(false)
  })

  test('without research the watcher sweeps trophies and prunes expired sessions', () => {
    const intervals = spyOn(globalThis, 'setInterval').mockImplementation((() => 0) as never)
    spyOn(users, 'listUsers').mockResolvedValue([])
    startWatcher(5)
    expect(intervals.mock.calls.map((c) => c[1])).toEqual([5 * 60_000, 60 * 60_000])
    expect(sessions.pruneExpired).toHaveBeenCalled()
  })
})

describe('the demo player', () => {
  const demo = makeUser({ id: 'user:demo', psn_account_id: DEMO_ACCOUNT_ID, demo: true })
  const stored = [makeTrophy({ id: 4, name: 'Guardado', earned: true })]
  afterEach(() => forgetUser(demo.id))

  test('is never checked on PSN', async () => {
    await checkUser(demo)
    expect(recent).not.toHaveBeenCalled()
  })

  test('starts on its stored game played last without a platinum', async () => {
    const platinumed = makeTitle({
      npCommunicationId: 'NPWR9_00',
      earnedByType: counts(1, 0, 0, 1),
    })
    spyOn(lib, 'library').mockResolvedValue([platinumed, makeTitle()])
    getTitle.mockResolvedValue(row({ trophies: stored }))
    const build = spyOn(guide, 'ensureGuide')
    const ask = spyOn(requests, 'requestGuide')
    config.automatic.research = true
    const ctx = await demoContext(demo)
    expect(ctx?.title.npCommunicationId).toBe('NPWR1_00')
    expect(ctx?.trophies).toEqual(stored)
    expect(ctx?.guide).toBe(routeGuide)
    expect(getCurrent(demo)).toBe(ctx as never)
    expect(psn.titleTrophies).not.toHaveBeenCalled()
    expect(build).not.toHaveBeenCalled()
    expect(ask).not.toHaveBeenCalled()
    expect(deepguide.ensureDeepGuide).not.toHaveBeenCalled()
  })

  test('falls back to its latest title, or to nothing', async () => {
    const only = makeTitle({ earnedByType: counts(1, 0, 0, 1) })
    spyOn(lib, 'library').mockResolvedValue([only])
    expect((await demoContext(demo))?.title).toBe(only)
    spyOn(lib, 'library').mockResolvedValue([])
    forgetUser(demo.id)
    expect(await demoContext(demo)).toBeUndefined()
  })

  test('watchNow loads it from the database', async () => {
    spyOn(lib, 'library').mockResolvedValue([makeTitle()])
    watchNow(demo)
    for (let i = 0; i < 50 && !getCurrent(demo); i++) await Bun.sleep(1)
    expect(getCurrent(demo)?.title.name).toBe('Days Gone')
    expect(recent).not.toHaveBeenCalled()
  })

  test('is skipped by the sweep', async () => {
    spyOn(globalThis, 'setInterval').mockImplementation((() => 0) as never)
    spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn()
      return 0
    }) as never)
    spyOn(users, 'listUsers').mockResolvedValue([demo, user])
    recent.mockResolvedValue([])
    startWatcher(15)
    for (let i = 0; i < 50 && recent.mock.calls.length < 1; i++) await Bun.sleep(1)
    await Bun.sleep(1)
    expect(recent.mock.calls).toEqual([['acc1', 5]])
  })
})
