import './env.ts'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { config } from '../src/config.ts'
import * as deepguide from '../src/deepguide.ts'
import { DEMO_ACCOUNT_ID } from '../src/demo.ts'
import { focusAfter, todaysFocus } from '../src/focus.ts'
import {
  demoContext,
  forgetUser,
  getChat,
  getCurrent,
  setChat,
  setChatFromCatalog,
  setCurrent,
} from '../src/game-context.ts'
import type { Guide } from '../src/guide.ts'
import * as guide from '../src/guide.ts'
import * as lib from '../src/library.ts'
import * as nexo from '../src/nexo.ts'
import {
  focusNotice,
  followedNotice,
  followedRecommendation,
  sessionNotice,
  unlockNotice,
} from '../src/notices.ts'
import * as playtime from '../src/playtime.ts'
import { Refused } from '../src/plugins.ts'
import * as psn from '../src/psn.ts'
import * as ranking from '../src/ranking.ts'
import * as activity from '../src/repository/activity.ts'
import * as sessions from '../src/repository/auth.ts'
import * as games from '../src/repository/game.ts'
import * as guides from '../src/repository/guide.ts'
import * as requests from '../src/repository/guide-request.ts'
import * as oauthRepo from '../src/repository/oauth.ts'
import * as recs from '../src/repository/recommendation.ts'
import type { TitleRow } from '../src/repository/title.ts'
import * as titles from '../src/repository/title.ts'
import * as users from '../src/repository/user.ts'
import * as servers from '../src/servers.ts'
import * as telegram from '../src/telegram.ts'
import {
  chatOrCheck,
  checkUser,
  SESSION_AGAIN_HOURS,
  SESSION_NOTICE_HOURS,
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
let lastTip: ReturnType<typeof spyOn<typeof activity, 'lastTip'>>
let markTip: ReturnType<typeof spyOn<typeof titles, 'markTipSent'>>
let saveEarned: ReturnType<typeof spyOn<typeof titles, 'saveEarnedIds'>>
let getGuide: ReturnType<typeof spyOn<typeof guides, 'getGuide'>>
let playing: ReturnType<typeof spyOn<typeof psn, 'nowPlaying'>>
let updateUser: ReturnType<typeof spyOn<typeof users, 'updateUser'>>

beforeEach(() => {
  spyOn(sessions, 'pruneExpired').mockResolvedValue()
  spyOn(oauthRepo, 'pruneOauth').mockResolvedValue()
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
  lastTip = spyOn(activity, 'lastTip').mockResolvedValue(undefined)
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
  const briefGuide = {
    ...roadmapGuide,
    tricks: [{ trophy: 'Terceiro', trick: 'Use o arco de longe.', source: 'x' }],
    missables: [{ trophy: 'Terceiro', when: 'antes do capítulo 5.', how: '' }],
  } as unknown as Guide
  const unchanged = () =>
    getTitle.mockResolvedValue(
      row({ earned_ids: [1, 2], earned: 10, last_updated_at: '2026-05-01T10:00:00.000Z' }),
    )

  test('opening the game in context sends one notice with what is left and the roadmap phase', async () => {
    unchanged()
    getGuide.mockResolvedValue(roadmapGuide)
    playing.mockResolvedValue('DAYS GONE')
    spyOn(Math, 'random').mockReturnValue(0)
    await checkUser(user)
    const text =
      '🎮 Hora de jogar! Falta 1 troféu para a platina de **Days Gone**.\n\n**Sugestão de próximo troféu**\nSeguindo o roteiro, o próximo a pipocar deve ser **Terceiro**.\nFaça algo\n\n📍 **Neste trecho do jogo**\n• Compre o arco.\n\nBoa jogatina! 🍀'
    expect(logTip).toHaveBeenCalledWith(user.id, 'session', text, game.id)
    expect(send.mock.calls).toEqual([['42', text]])
    expect(updateUser.mock.calls[0][1].session_notice_at).toBeInstanceOf(Date)
  })

  describe('opened again', () => {
    const short =
      '🎮 Hora de jogar **Days Gone** de novo. A sugestão de próximo troféu continua sendo **Terceiro**. Boa jogatina! 🍀'
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
    const open = async (last: Awaited<ReturnType<typeof activity.lastTip>>) => {
      unchanged()
      getGuide.mockResolvedValue(roadmapGuide)
      playing.mockResolvedValue('DAYS GONE')
      lastTip.mockResolvedValue(last)
      await checkUser(user)
      return logTip.mock.calls.find((c) => c[1] === 'session')?.[2]
    }

    test('the same game the same day with nothing earned gets one short line', async () => {
      expect(await open({ game: game.id, created_at: hoursAgo(7) })).toBe(short)
    })

    test('a trophy earned since the last notice brings the full one back', async () => {
      // The unlock also gets Nexo's reaction: answered here, never by a running AI service.
      spyOn(nexo, 'unlockReaction').mockResolvedValue('Boa!')
      spyOn(psn, 'titleTrophies').mockResolvedValue([
        ...trophies.slice(0, 2),
        makeTrophy({ id: 4, name: 'Novo', earned: true, earnedAt: hoursAgo(1) }),
        trophies[2],
      ])
      expect(await open({ game: game.id, created_at: hoursAgo(7) })).toStartWith(
        '🎮 Hora de jogar! ',
      )
    })

    test(`after ${SESSION_AGAIN_HOURS} hours, or after another game, the notice is full again`, async () => {
      expect(
        await open({ game: game.id, created_at: hoursAgo(SESSION_AGAIN_HOURS + 1) }),
      ).toStartWith('🎮 Hora de jogar! ')
      logTip.mockClear()
      expect(await open({ game: 'game:other', created_at: hoursAgo(7) })).toStartWith(
        '🎮 Hora de jogar! ',
      )
    })

    test('without a suggestion the short line is the game alone, in the player’s language', () => {
      const ctx = { game, title: makeTitle(), trophies: [] } as unknown as Parameters<
        typeof sessionNotice
      >[2]
      expect(sessionNotice(user, 'x', ctx, true)).toBe(
        '🎮 Hora de jogar **Days Gone** de novo. Boa jogatina! 🍀',
      )
      expect(sessionNotice({ ...user, locale: 'en' as const }, 'x', ctx, true)).toBe(
        '🎮 Time to play **Days Gone** again. Have a good session! 🍀',
      )
    })
  })

  test('another game gets the notice with its name only', async () => {
    unchanged()
    playing.mockResolvedValue('ASTRO BOT')
    await checkUser(user)
    expect(logTip).toHaveBeenCalledWith(
      user.id,
      'session',
      expect.stringMatching(/^🎮 .*ASTRO BOT[^\n]*$/),
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

  test('the briefing adds the guide’s tip, a missable still open and a trophy almost done', () => {
    const ctx = {
      game,
      title: makeTitle(),
      guide: briefGuide,
      trophies: [
        ...trophies,
        makeTrophy({ id: 4, name: 'Colecionador', progressTarget: 50, progressValue: 34 }),
        makeTrophy({ id: 5, name: 'Longe', progressTarget: 10, progressValue: 2 }),
        makeTrophy({ id: 6, name: 'Extra', groupId: '001' }),
        makeTrophy({ id: 7, name: 'Platina', type: 'platinum' }),
      ],
    } as unknown as Parameters<typeof sessionNotice>[2]
    expect(sessionNotice(user, 'x', ctx)).toBe(
      [
        '🎮 Hora de jogar! Faltam 3 troféus para a platina de **Days Gone**.',
        '**Sugestão de próximo troféu**\nSeguindo o roteiro, o próximo a pipocar deve ser **Terceiro**.\nFaça algo',
        '**Dica**: Use o arco de longe.',
        '📍 **Neste trecho do jogo**\n• Compre o arco.',
        '⚠️ **Terceiro** é perdível: antes do capítulo 5.',
        '**Quase lá**: Colecionador, 34 de 50.',
        'Boa jogatina! 🍀',
      ].join('\n\n'),
    )
  })

  test('a trophy the roadmap leaves to a later phase is not the focus before then', () => {
    const guide = {
      roadmap: [
        { phase: 'Fase 1 — História', goal: '', trophies: ['Capítulo 1', 'Capítulo 2', 'Pinhas'] },
        { phase: 'Fase 2 — Seleção de capítulo', goal: '', trophies: ['Pinhas'] },
      ],
      tricks: [{ trophy: 'Pinhas', trick: 'Carregue cada disparo.', source: 'x' }],
    } as unknown as Guide
    const ctx = {
      guide,
      trophies: [
        makeTrophy({ id: 1, name: 'Capítulo 1', earned: true }),
        makeTrophy({ id: 2, name: 'Capítulo 2' }),
        makeTrophy({ id: 3, name: 'Pinhas' }),
      ],
    }
    expect(todaysFocus(ctx).trophy?.name).toBe('Capítulo 2')
    // With the rest of the phase done, it is the focus again.
    ctx.trophies[1] = makeTrophy({ id: 2, name: 'Capítulo 2', earned: true })
    expect(todaysFocus(ctx).trophy?.name).toBe('Pinhas')
  })

  test('the stretch the player is in lists its collectibles and drops tips about trophies they have', () => {
    const guide = {
      milestones: [
        { after: null, tips: [{ kind: 'warning', text: 'Guarde facas.', trophy: null }] },
        {
          after: 'Capítulo 1',
          tips: [
            { kind: 'collectible', text: 'Souvenir 1: na tenda do mercado.', trophy: 'Lembranças' },
            { kind: 'collectible', text: 'Flor 1/5: a caminho da torre.', trophy: 'Herbalista' },
          ],
        },
        { after: 'Capítulo 2', tips: [{ kind: 'item', text: 'Pegue a besta.', trophy: null }] },
      ],
    } as unknown as Guide
    const ctx = {
      game,
      title: makeTitle(),
      guide,
      groups: null,
      owned: false,
      trophies: [
        makeTrophy({ id: 1, name: 'Capítulo 1', earned: true }),
        makeTrophy({ id: 2, name: 'Capítulo 2' }),
        makeTrophy({ id: 3, name: 'Lembranças' }),
        makeTrophy({ id: 4, name: 'Herbalista', earned: true }),
      ],
    } as unknown as NonNullable<Parameters<typeof sessionNotice>[2]>
    expect(sessionNotice(user, 'x', ctx)).toContain(
      '📍 **Neste trecho do jogo**\n1 colecionável aqui: 1 Souvenir.\n• **Souvenir 1**\nNa tenda do mercado.\n\n',
    )
    expect(sessionNotice(user, 'x', ctx)).not.toContain('Flor 1/5')
    // Opened again with nothing new: one line, and the stretch's collectibles still there.
    expect(sessionNotice(user, 'x', ctx, true)).toContain('de novo')
    expect(sessionNotice(user, 'x', ctx, true)).toContain(
      '\n\n📍 **Neste trecho do jogo**\n1 colecionável aqui: 1 Souvenir.\n• **Souvenir 1**\nNa tenda do mercado.',
    )
    // Several tips are set apart by a blank line.
    ctx.trophies[3] = makeTrophy({ id: 4, name: 'Herbalista' })
    expect(sessionNotice(user, 'x', ctx)).toContain(
      '• **Souvenir 1**\nNa tenda do mercado.\n\n• **Flor 1/5**\nA caminho da torre.',
    )
  })

  test('the focus is a missable first, then a trophy with a trick, then the next in order', () => {
    const base = [
      makeTrophy({ id: 3, name: 'Terceiro' }),
      makeTrophy({ id: 4, name: 'Quarto' }),
      makeTrophy({ id: 5, name: 'Quinto' }),
    ]
    const focusOf = (guide: object) =>
      sessionNotice(user, 'x', {
        game,
        title: makeTitle(),
        trophies: base,
        guide: {
          roadmap: [{ phase: 'F', goal: '', trophies: ['Terceiro', 'Quarto', 'Quinto'] }],
          ...guide,
        },
      } as never)
        .split('deve ser **')[1]
        .split('**')[0]
    expect(focusOf({})).toBe('Terceiro')
    expect(focusOf({ tricks: [{ trophy: 'Quinto', trick: 't', source: '' }] })).toBe('Quinto')
    expect(
      focusOf({
        tricks: [{ trophy: 'Quinto', trick: 't', source: '' }],
        missables: [{ trophy: 'Quarto', when: 'já', how: '' }],
      }),
    ).toBe('Quarto')
  })

  test('a trophy notice keeps the session focus, and names the next one when it was earned', () => {
    const guide = {
      roadmap: [{ phase: 'F', goal: '', trophies: ['Terceiro', 'Quarto', 'Quinto'] }],
      tricks: [
        { trophy: 'Quarto', trick: 'Use o arco.', source: '' },
        { trophy: 'Quinto', trick: 't', source: '' },
      ],
    }
    const ctxWith = (earned: number[]) =>
      ({
        game,
        title: makeTitle(),
        guide,
        trophies: [3, 4, 5].map((id) =>
          makeTrophy({
            id,
            name: ['Terceiro', 'Quarto', 'Quinto'][id - 3],
            detail: `Faça o ${id}`,
            earned: earned.includes(id),
          }),
        ),
      }) as never as Parameters<typeof focusNotice>[1]
    // The session named Quarto (it has a trick). Earning Terceiro does not move it.
    const other = ctxWith([3])
    expect(focusAfter(other, [other.trophies[0]])).toMatchObject({
      phase: 'F',
      changed: false,
      trophy: { name: 'Quarto' },
      trick: 'Use o arco.',
    })
    expect(focusNotice(user, other, [other.trophies[0]])).toBe(
      'A sugestão de próximo troféu continua sendo **Quarto**.',
    )
    // Earning Quarto, the focus, names the next one by the same rule.
    const same = ctxWith([4])
    expect(focusAfter(same, [same.trophies[1]])).toMatchObject({
      changed: true,
      trophy: { name: 'Quinto' },
    })
    expect(focusNotice(user, same, [same.trophies[1]])).toBe(
      '**Sugestão de próximo troféu**\nSeguindo o roteiro, o próximo a pipocar deve ser **Quinto**.\nFaça o 5',
    )
    // Nothing left in the base game: no focus line, only the phase that just closed.
    const all = ctxWith([3, 4, 5])
    expect(focusNotice(user, all, [all.trophies[2]])).toBe('🎉 Fechou a F do roteiro!')
  })

  test('phases are counted, never a place: story done and back for side activities', () => {
    // The roadmap puts the story's end and the side activities in phase 1; the player finished the
    // story, earned a phase 3 trophy and left phase 1's activities open.
    const guide = {
      roadmap: [
        {
          phase: 'Fase 1 — Campanha',
          goal: '',
          trophies: ['Days Done', 'Caçador de  Emboscadas', 'Saqueadores'],
        },
        { phase: 'Fase 2 — Hordas', goal: '', trophies: ['Horda'] },
        { phase: 'Fase 3 — Limpeza', goal: '', trophies: ['Variedade', 'Burnout'] },
      ],
    }
    const names = [
      'Days Done',
      'Caçador de  Emboscadas',
      'Saqueadores',
      'Horda',
      'Variedade',
      'Burnout',
    ]
    const ctx = (earned: string[]) =>
      ({
        game,
        title: makeTitle(),
        guide,
        trophies: names.map((name, i) =>
          makeTrophy({ id: i + 1, name, detail: `Faça ${name}`, earned: earned.includes(name) }),
        ),
      }) as never as Parameters<typeof focusNotice>[1]
    const now = ctx(['Days Done', 'Caçador de  Emboscadas', 'Variedade'])
    const emboscadas = now.trophies[1]
    const focus = focusAfter(now, [emboscadas])
    expect(focus).toMatchObject({
      phases: [
        { short: 'Fase 1', left: 1 },
        { short: 'Fase 2', left: 1 },
        { short: 'Fase 3', left: 1 },
      ],
      trophy: { name: 'Saqueadores' },
      phase: 'Fase 1',
      behind: true,
      changed: true,
    })
    expect(focusNotice(user, now, [emboscadas])).toBe(
      '**Sugestão de próximo troféu**\nPelo momento em que você está, vale buscar **Saqueadores**, que ficou para trás.\nFaça Saqueadores',
    )
    const session = sessionNotice(user, 'Days Gone', now)
    expect(session).toContain('🎮 Hora de jogar! Faltam 3 troféus para a platina de **Days Gone**.')
    expect(session).toEndWith('Boa jogatina! 🍀')
    expect(session).toContain('vale buscar **Saqueadores**, que ficou para trás.')
    expect(session).not.toMatch(/Fase|está na|segue na|continua na/)
    // The trophy's own notice shows its name with one space.
    expect(unlockNotice(user, now, [emboscadas])).toContain('🏆 **Caçador de Emboscadas** (')
    // Someone at the start is not "behind": the focus is the next step, with no phase remark.
    const start = ctx([])
    expect(todaysFocus(start)).toMatchObject({
      phase: 'Fase 1',
      behind: false,
      trophy: { name: 'Days Done' },
    })
  })

  test('without a game in context, only the game being played, in English too', () => {
    const en = { ...user, locale: 'en' as const }
    expect(sessionNotice(en, 'Days Gone')).toBe(
      '🎮 Time to play **Days Gone**. Have a good session! 🍀',
    )
    expect(sessionNotice(user, 'Days Gone')).toBe(
      '🎮 Hora de jogar **Days Gone**. Boa jogatina! 🍀',
    )
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

  test('a game Nexo recommended opens glad the player followed it, from Nexo or plain', async () => {
    getTitle.mockResolvedValue(undefined)
    recent.mockResolvedValue([started()])
    const fiveDaysAgo = new Date(Date.now() - 5.5 * 86_400_000).toISOString()
    const last = spyOn(recs, 'lastRecommended').mockResolvedValue({
      at: fiveDaysAgo,
      source: 'pick',
      why: 'Curto depois de um longo',
    })
    const tip = spyOn(nexo, 'proactiveTip').mockResolvedValue('Que bom!')
    await checkUser(user)
    expect(last).toHaveBeenCalledWith(user.id, game.id, 30)
    expect(tip.mock.calls[0][3]).toEqual({ daysAgo: 5, why: 'Curto depois de um longo' })

    // Plain: one of the lines, always the same for a game, before the start notice.
    config.automatic.notices = false
    await checkUser(user)
    const text = logTip.mock.calls.find((c) => c[1] === 'start')?.[2] ?? ''
    expect(text).toEndWith(
      'Você começou Days Gone. O guia da platina está no PlatJourney.\n\nAntes de começar:\n• Jogue no Difícil.',
    )
    expect(text.split('\n\n')[0]).toBe(followedNotice(user, game.id))
    expect(followedNotice(user, game.id)).toBe(followedNotice(user, game.id))
    expect(
      new Set(['game:1', 'game:2', 'game:3', 'game:4'].map((g) => followedNotice(user, g))).size,
    ).toBe(4)
  })

  test('a recommendation that cannot be read leaves the start notice as it is', async () => {
    spyOn(recs, 'lastRecommended').mockRejectedValue(new Error('db down'))
    expect(await followedRecommendation(user, game.id)).toBeNull()
  })

  test('new trophies get one reaction from Nexo, with the route in it', async () => {
    const reaction = spyOn(nexo, 'unlockReaction').mockResolvedValue('Boa!')
    await checkUser(user)
    expect(reaction.mock.calls[0][2].map((t) => t.id)).toEqual([2])
    expect(reaction.mock.calls[0][3]).toBe('Agora vale saber:\n• Compre o arco.')
    expect(send.mock.calls.map((c) => c[1])).toEqual(['Boa!'])
  })

  test('a chapter trophy hands Nexo the common tips and adds the next stretch’s missables and collectibles as written', async () => {
    getGuide.mockResolvedValue({
      milestones: [
        { after: null, tips: [{ kind: 'warning', text: 'Jogue no Difícil.', trophy: null }] },
        {
          after: 'Segundo',
          tips: [
            { kind: 'item', text: 'Compre o arco.', trophy: null },
            {
              kind: 'collectible',
              text: 'Souvenir 3/21, Um túmulo: no jardim cercado.',
              trophy: 'Lembranças',
            },
            { kind: 'missable', text: 'Não mate o guarda das docas.', trophy: 'Piedade' },
          ],
        },
      ],
    } as unknown as Guide)
    const reaction = spyOn(nexo, 'unlockReaction').mockResolvedValue('Boa!')
    await checkUser(user)
    expect(reaction.mock.calls[0][3]).toBe('Agora vale saber:\n• Compre o arco.')
    // The missable comes first, by name; the collectibles are counted before the list.
    const apart =
      '📍 **Neste trecho do jogo**\n1 colecionável aqui: 1 Souvenir.\n• ⚠️ **Piedade** é perdível: Não mate o guarda das docas.\n\n• **Souvenir 3/21, Um túmulo**\nNo jardim cercado.'
    expect(reaction.mock.calls[0][4]).toBe(apart)
    // The plain notice ends with the same block.
    config.automatic.notices = false
    send.mockClear()
    getTitle.mockResolvedValue(row())
    await checkUser({ ...user, id: 'user:w2' })
    expect(send.mock.calls.at(-1)?.[1]).toEndWith(`Agora vale saber:\n• Compre o arco.\n\n${apart}`)
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
    spyOn(Math, 'random').mockReturnValue(0)
    const reaction = spyOn(nexo, 'unlockReaction')
    await checkUser(user)
    expect(reaction).not.toHaveBeenCalled()
    const text =
      '🏆 **Segundo** (ouro, 12,5% de quem joga) em **Days Gone**\n\nMetade do caminho! Daqui pra frente a platina só fica mais perto. Metade do jogo base: 2 de 3 troféus.\n\nAgora vale saber:\n• Compre o arco.'
    expect(logTip).toHaveBeenCalledWith(user.id, 'unlock', text, game.id)
    expect(send.mock.calls).toEqual([['42', text]])
  })

  test('a missable just earned gets a line of relief, and a tip about a listed missable says so', async () => {
    getGuide.mockResolvedValue({
      missables: [
        { trophy: 'Segundo', when: 'No capítulo 2.', how: 'Leia a carta.' },
        { trophy: 'Terceiro', when: 'No capítulo 3.', how: 'Poupe o guarda.' },
      ],
      milestones: [
        { after: null, tips: [] },
        {
          after: 'Segundo',
          tips: [{ kind: 'trophy', text: 'Poupe o guarda.', trophy: 'Terceiro' }],
        },
      ],
    } as unknown as Guide)
    const cheer = '🎯 Perdível no bolso: **Segundo**. Um susto a menos no caminho da platina.'
    const tip = '📍 **Neste trecho do jogo**\n• ⚠️ **Terceiro** é perdível: Poupe o guarda.'
    const reaction = spyOn(nexo, 'unlockReaction').mockResolvedValue('Boa!')
    await checkUser(user)
    expect(reaction.mock.calls[0][3]).toBeUndefined()
    expect(reaction.mock.calls[0][4]).toBe(`${cheer}\n\n${tip}`)
    config.automatic.notices = false
    send.mockClear()
    getTitle.mockResolvedValue(row())
    await checkUser({ ...user, id: 'user:w3' })
    const text = send.mock.calls.at(-1)?.[1] ?? ''
    expect(text.split('\n\n')[1]).toBe(cheer)
    expect(text).toEndWith(tip)
  })

  test('a player who turned Nexo’s notices off gets the plain one', async () => {
    const reaction = spyOn(nexo, 'unlockReaction')
    await checkUser({ ...user, ai_notices: false })
    expect(reaction).not.toHaveBeenCalled()
    expect(send.mock.calls[0][1]).toStartWith('🏆 **Segundo**')
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

  test('the first trophy of a game watched with none earned gets its notice', async () => {
    getTitle.mockResolvedValue(row({ earned: 0, earned_ids: [] }))
    spyOn(psn, 'titleTrophies').mockResolvedValue([
      trophies[0],
      { ...trophies[1], earned: false },
      trophies[2],
    ])
    recent.mockResolvedValue([makeTitle({ earned: 1 })])
    const reaction = spyOn(nexo, 'unlockReaction').mockResolvedValue('Boa!')
    await checkUser(user)
    expect(reaction.mock.calls[0][2].map((t) => t.id)).toEqual([1])
    expect(send.mock.calls.map((c) => c[1])).toEqual(['Boa!'])
  })

  test('a title stored with trophies but no ids was never watched: its old trophies stay quiet', async () => {
    getTitle.mockResolvedValue(row({ earned: 10, earned_ids: [] }))
    const reaction = spyOn(nexo, 'unlockReaction')
    await checkUser(user)
    expect(reaction).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
    expect(saveEarned).toHaveBeenCalledWith(user.id, 'NPWR1_00', [1, 2])
  })

  test('the first sync of an old game sends nothing', async () => {
    getTitle.mockResolvedValue(undefined)
    const tip = spyOn(nexo, 'proactiveTip')
    await checkUser(user)
    expect(tip).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
    expect(saveEarned).toHaveBeenCalledWith(user.id, 'NPWR1_00', [1, 2])
  })

  test('a trophy list that lagged behind the summary is read again on the next sweep', async () => {
    const reaction = spyOn(nexo, 'unlockReaction').mockResolvedValue('Boa!')
    const list = spyOn(psn, 'titleTrophies')
    // First sweep: the summary already says 10 earned, the list still has only the first trophy.
    list.mockResolvedValueOnce([trophies[0], { ...trophies[1], earned: false }, trophies[2]])
    getTitle.mockResolvedValue(row({ earned_ids: [1], earned: 9 }))
    recent.mockResolvedValue([makeTitle({ earned: 2 })])
    await checkUser(user)
    expect(reaction).not.toHaveBeenCalled()
    // Second sweep: the summary is unchanged, but the list is read again and has the trophy.
    getTitle.mockResolvedValue(
      row({ earned_ids: [1], earned: 2, last_updated_at: '2026-05-01T10:00:00.000Z' }),
    )
    await checkUser(user)
    expect(reaction.mock.calls[0][2].map((t) => t.id)).toEqual([2])
  })

  test('an unchanged title reuses the loaded context', async () => {
    // The summary and the list agree: two trophies earned.
    recent.mockResolvedValue([makeTitle({ earned: 2 })])
    getTitle.mockResolvedValue(
      row({ earned_ids: [1, 2], earned: 2, last_updated_at: '2026-05-01T10:00:00.000Z' }),
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
  test('the chat can talk about another game while the game played stays; picking that one again drops the pick', async () => {
    getGuide.mockResolvedValue(undefined)
    spyOn(requests, 'requestGuide').mockResolvedValue(undefined)
    const playing = await setCurrent(user, makeTitle())
    const other = await setChat(
      user,
      makeTitle({ npCommunicationId: 'NPWR2_00', name: 'Far Cry 3' }),
    )
    expect(getCurrent(user)).toBe(playing)
    expect(getChat(user)).toBe(other)
    expect(await setChat(user, makeTitle())).toBe(playing)
    expect(getChat(user)).toBe(playing)
  })

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
    expect(oauthRepo.pruneOauth).toHaveBeenCalled()
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

test('a game outside the library becomes the chat game with its list, nothing earned and the stored guide', async () => {
  const trophy = { id: 0, name: 'Platina', type: 'platinum', earned: false } as psn.TrophyStatus
  spyOn(psn, 'catalogTrophies').mockResolvedValue({
    np: 'NPWR9',
    platform: 'PS5',
    trophies: [trophy],
  })
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  const ask = spyOn(requests, 'requestGuide').mockResolvedValue(undefined)
  const game = {
    id: 'game:9',
    name: 'Jogo Exemplo',
    np_communication_ids: ['NPWR9'],
    cover_url: null,
  } as never
  const ctx = await setChatFromCatalog({ id: 'user:z' } as never, game)
  expect(ctx?.owned).toBe(false)
  expect(ctx?.title).toMatchObject({
    npCommunicationId: 'NPWR9',
    progress: 0,
    earned: 0,
    total: 1,
    platform: 'PS5',
  })
  expect(ctx?.title.definedByType.platinum).toBe(1)
  expect(ask).toHaveBeenCalledWith('game:9')
  // Only the chat follows it: the game being played stays as it was.
  expect(getChat({ id: 'user:z' } as never)).toBe(ctx as never)
  expect(getCurrent({ id: 'user:z' } as never)).toBeUndefined()
  spyOn(psn, 'catalogTrophies').mockResolvedValue(null)
  expect(await setChatFromCatalog({ id: 'user:y' } as never, game)).toBeNull()
})

test('a loaded game is used as is; the demo player is never checked', async () => {
  const ctx = await setChatFromCatalogStub()
  expect(await chatOrCheck({ id: 'user:cc' } as never)).toBe(ctx as never)
  expect(await chatOrCheck({ id: 'user:none', demo: true } as never)).toBeUndefined()
})

async function setChatFromCatalogStub() {
  spyOn(psn, 'catalogTrophies').mockResolvedValue({ np: 'NPWR8', platform: 'PS5', trophies: [] })
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  spyOn(requests, 'requestGuide').mockResolvedValue(undefined)
  const game = {
    id: 'game:8',
    name: 'Jogo Exemplo',
    np_communication_ids: ['NPWR8'],
    cover_url: null,
  } as never
  return setChatFromCatalog({ id: 'user:cc' } as never, game)
}
