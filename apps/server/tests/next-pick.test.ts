import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import * as aiModule from '../src/ai.ts'
import { nextPick, pickHistory } from '../src/next-pick.ts'
import * as plugins from '../src/plugins.ts'
import * as ranking from '../src/ranking.ts'
import * as games from '../src/repository/game.ts'
import * as guides from '../src/repository/guide.ts'
import * as interests from '../src/repository/interest.ts'
import * as recs from '../src/repository/recommendation.ts'
import * as prices from '../src/repository/store-price.ts'
import * as similar from '../src/similar.ts'
import { makeGame, makeTitle, makeUser } from './fixtures.ts'

const user = makeUser({ taste_profile: { summary: 'Gosta de mundo aberto' } })
const started = makeGame({ id: 'game:1', name: 'Days Gone', np_communication_ids: ['NPWR1'] })
const fresh = makeGame({ id: 'game:2', name: 'Inside' })
const done = makeGame({ id: 'game:3', name: 'Elden Ring', np_communication_ids: ['NPWR3'] })

const AT = '2026-10-18T10:00:00Z'
// The pick as stored: the row the repository writes, its game read back.
const stored = (data: Parameters<typeof recs.savePick>[1]) =>
  ({
    ...data,
    id: 'recommendation:1',
    game: [started, fresh, done].find((g) => g.id === data.game) ?? { id: data.game, name: '?' },
    created_at: AT,
  }) as never

beforeEach(() => {
  spyOn(plugins, 'aroundModel')
  spyOn(interests, 'markNextPick').mockResolvedValue()
  spyOn(ranking, 'loadGroups').mockResolvedValue(null)
  spyOn(recs, 'listDismissed').mockResolvedValue([])
  spyOn(recs, 'recentPickGames').mockResolvedValue([])
  spyOn(recs, 'savePick').mockImplementation(async (_user, data) => stored(data))
})

afterEach(() => mock.restore())

const saved = (...gs: (typeof started)[]) =>
  gs.map((game, i) => ({ id: `interest:${i}`, game, year: 2026, position: i }))

test('nothing saved means no pick and no model', async () => {
  spyOn(interests, 'listInterests').mockResolvedValue([])
  const ai = spyOn(aiModule, 'ai')
  expect(await nextPick(user, [], 'pt-BR', {}, 2026)).toBeNull()
  expect(ai).not.toHaveBeenCalled()
})

test('the service gets each saved game with its guide and progress, and the last platinums', async () => {
  spyOn(interests, 'listInterests').mockResolvedValue(saved(started, fresh))
  const playing = makeTitle({ npCommunicationId: 'NPWR1', name: 'Days Gone', progress: 40 })
  const platinum = makeTitle({
    npCommunicationId: 'NPWR3',
    name: 'Elden Ring',
    earnedByType: { bronze: 1, silver: 1, gold: 1, platinum: 1 },
  })
  spyOn(games, 'gamesForTitles').mockResolvedValue(
    new Map([
      ['NPWR1', started],
      ['NPWR3', done],
    ]),
  )
  spyOn(guides, 'getGuide').mockImplementation(async (id: string) =>
    id === 'game:1'
      ? ({
          difficulty: 3,
          hours: 70,
          playthroughs: 1,
          hasMissables: false,
          hasOnline: false,
        } as never)
      : id === 'game:3'
        ? ({ difficulty: 6, hours: 100 } as never)
        : undefined,
  )
  const ai = spyOn(aiModule, 'ai').mockResolvedValue({
    game: 'game:2',
    why: 'Curto depois de um longo',
    firstStep: 'Comece pelo capítulo 1',
  })
  const pick = await nextPick(user, [playing, platinum], 'en', {}, 2026)
  expect(pick).toEqual({
    id: 'recommendation:1',
    game: { id: 'game:2', name: 'Inside', cover_url: null },
    why: 'Curto depois de um longo',
    firstStep: 'Comece pelo capítulo 1',
    mood: null,
    scope: 'interests',
    ownedOnly: false,
    fits: true,
    recommender: 'nexo',
    at: AT,
  })
  expect(interests.markNextPick).toHaveBeenCalledWith(user.id, 'game:2')
  expect(recs.savePick).toHaveBeenCalledWith(user.id, {
    game: 'game:2',
    why: 'Curto depois de um longo',
    first_step: 'Comece pelo capítulo 1',
    scope: 'interests',
    owned_only: false,
    fits: true,
  })
  const [path, body] = ai.mock.calls[0] as [string, Record<string, unknown>]
  expect(path).toBe('/pick')
  expect(body.scope).toBe('interests')
  expect(body.mood).toBeUndefined()
  expect(body.locale).toBe('en')
  expect(body.profile).toBe('Gosta de mundo aberto')
  expect(body.choices).toEqual([
    {
      game: 'game:1',
      name: 'Days Gone',
      owned: true,
      progress: 40,
      difficulty: 3,
      hours: 70,
      playthroughs: 1,
      hasMissables: false,
      hasOnline: false,
    },
    {
      game: 'game:2',
      name: 'Inside',
      owned: false,
      progress: null,
      difficulty: null,
      hours: null,
      playthroughs: null,
      hasMissables: null,
      hasOnline: null,
    },
  ])
  expect(body.recent).toEqual([{ name: 'Elden Ring', hours: 100, difficulty: 6 }])
  expect(plugins.aroundModel).toHaveBeenCalled()
})

test('a pick the service could not tie to a saved game falls back to the first one', async () => {
  spyOn(interests, 'listInterests').mockResolvedValue(saved(started, fresh))
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map())
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  spyOn(aiModule, 'ai').mockResolvedValue({ game: 'game:99', why: 'x', firstStep: 'y' })
  expect((await nextPick(user, [], 'pt-BR', {}, 2026))?.game.id).toBe('game:1')
  spyOn(aiModule, 'ai').mockResolvedValue(null)
  expect(await nextPick(user, [], 'pt-BR', {}, 2026)).toBeNull()
})

const groups = (earned: number, total: number) =>
  ({ base: { earned, total }, dlc: { earned: 0, total: 10 } }) as never

test('a saved game already platinumed is left out, and DLC counts only when the profile says', async () => {
  spyOn(interests, 'listInterests').mockResolvedValue(saved(started, done))
  const playing = makeTitle({ npCommunicationId: 'NPWR1', name: 'Days Gone', progress: 30 })
  const platinum = makeTitle({
    npCommunicationId: 'NPWR3',
    name: 'Elden Ring',
    progress: 85,
    earnedByType: { bronze: 1, silver: 1, gold: 1, platinum: 1 },
  })
  spyOn(games, 'gamesForTitles').mockResolvedValue(
    new Map([
      ['NPWR1', started],
      ['NPWR3', done],
    ]),
  )
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  spyOn(ranking, 'loadGroups').mockResolvedValue(groups(20, 40))
  const ai = spyOn(aiModule, 'ai').mockResolvedValue({ game: 'game:1', why: 'x', firstStep: 'y' })
  await nextPick(user, [playing, platinum], 'pt-BR', {}, 2026)
  const body = ai.mock.calls[0][1] as { choices: { game: string; progress: number }[] }
  expect(body.choices.map((c) => [c.game, c.progress])).toEqual([['game:1', 50]])

  // Counting DLC: the PSN total, and the platinumed game still out (only its DLC is left).
  await nextPick(makeUser({ include_dlc_progress: true }), [playing, platinum], 'pt-BR', {}, 2026)
  const withDlc = ai.mock.calls[1][1] as { choices: { game: string; progress: number }[] }
  expect(withDlc.choices.map((c) => [c.game, c.progress])).toEqual([['game:1', 30]])
})

test('every saved game already done means no pick and no model', async () => {
  spyOn(interests, 'listInterests').mockResolvedValue(saved(done))
  const platinum = makeTitle({
    npCommunicationId: 'NPWR3',
    earnedByType: { bronze: 1, silver: 1, gold: 1, platinum: 1 },
  })
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map([['NPWR3', done]]))
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  const ai = spyOn(aiModule, 'ai')
  expect(await nextPick(user, [platinum], 'pt-BR', {}, 2026)).toBeNull()
  expect(ai).not.toHaveBeenCalled()
})

test('the game being played is what the pick comes after, unless it is the only one left', async () => {
  spyOn(interests, 'listInterests').mockResolvedValue(saved(started, fresh))
  const now = new Date().toISOString()
  const playing = makeTitle({ npCommunicationId: 'NPWR1', progress: 74, lastUpdated: now })
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map([['NPWR1', started]]))
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  const ai = spyOn(aiModule, 'ai').mockResolvedValue({ game: 'game:2', why: 'x', firstStep: 'y' })
  await nextPick(user, [playing], 'pt-BR', {}, 2026)
  const body = ai.mock.calls[0][1] as { choices: { game: string }[]; playing: unknown }
  expect(body.choices.map((c) => c.game)).toEqual(['game:2'])
  expect(body.playing).toEqual([{ name: 'Days Gone', progress: 74 }])

  spyOn(interests, 'listInterests').mockResolvedValue(saved(started))
  await nextPick(user, [playing], 'pt-BR', {}, 2026)
  const only = ai.mock.calls[1][1] as { choices: { game: string }[]; playing: unknown }
  expect(only.choices.map((c) => c.game)).toEqual(['game:1'])
  expect(only.playing).toEqual([])
})

test('asking again leaves out the games picked in the last day, until none is left', async () => {
  spyOn(interests, 'listInterests').mockResolvedValue(saved(started, fresh))
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map())
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  const ai = spyOn(aiModule, 'ai').mockResolvedValue({ game: 'game:2', why: 'x', firstStep: 'y' })
  const offered = () =>
    ((ai.mock.calls.at(-1) ?? [])[1] as { choices: { game: string }[] }).choices.map((c) => c.game)
  const recent = spyOn(recs, 'recentPickGames').mockResolvedValue(['game:1'])
  await nextPick(user, [], 'pt-BR', {}, 2026)
  expect(offered()).toEqual(['game:2'])
  expect(recent).toHaveBeenCalledWith(user.id, 'interests', 24)
  recent.mockResolvedValue(['game:1', 'game:2'])
  await nextPick(user, [], 'pt-BR', {}, 2026)
  expect(offered()).toEqual(['game:1', 'game:2'])
})

test('the mood goes to the service and comes back with the pick, trimmed and capped', async () => {
  spyOn(interests, 'listInterests').mockResolvedValue(saved(started, fresh))
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map())
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  const ai = spyOn(aiModule, 'ai').mockResolvedValue({
    game: 'game:2',
    why: 'Nada curto na lista',
    firstStep: 'y',
    fits: false,
  })
  const pick = await nextPick(user, [], 'pt-BR', { mood: `  algo curto${' '.repeat(200)}x` }, 2026)
  expect((ai.mock.calls[0][1] as { mood: string }).mood).toBe('algo curto')
  expect(pick).toMatchObject({ mood: 'algo curto', fits: false })
})

test('keeping to games the player has: the library and the PS Plus catalog', async () => {
  spyOn(interests, 'listInterests').mockResolvedValue(saved(started, fresh, done))
  const mine = makeTitle({ npCommunicationId: 'NPWR1', name: 'Days Gone', progress: 10 })
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map([['NPWR1', started]]))
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  const catalog = spyOn(prices, 'plusCatalog').mockResolvedValue(['game:3'])
  const ai = spyOn(aiModule, 'ai').mockResolvedValue({ game: 'game:3', why: 'x', firstStep: 'y' })
  const extra = makeUser({ ps_plus: 'extra' })
  const pick = await nextPick(extra, [mine], 'pt-BR', { ownedOnly: true }, 2026)
  expect(catalog).toHaveBeenCalledWith(['essential', 'extra'])
  const body = ai.mock.calls[0][1] as { choices: { game: string }[] }
  expect(body.choices.map((c) => c.game)).toEqual(['game:1', 'game:3'])
  expect(pick).toMatchObject({ ownedOnly: true, game: { id: 'game:3' } })

  // Nothing saved is one the player has: no pick and no model.
  catalog.mockResolvedValue([])
  spyOn(interests, 'listInterests').mockResolvedValue(saved(fresh))
  expect(await nextPick(user, [mine], 'pt-BR', { ownedOnly: true }, 2026)).toBeNull()
  expect(ai).toHaveBeenCalledTimes(1)
})

test('any game the player has: started ones first, then the PS Plus catalog, none turned down', async () => {
  spyOn(interests, 'listInterests').mockResolvedValue([])
  const older = makeTitle({ npCommunicationId: 'NPWR1', lastUpdated: '2026-01-01T00:00:00Z' })
  const newer = makeTitle({ npCommunicationId: 'NPWR3', lastUpdated: '2026-09-01T00:00:00Z' })
  spyOn(games, 'gamesForTitles').mockResolvedValue(
    new Map([
      ['NPWR1', started],
      ['NPWR3', done],
    ]),
  )
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  spyOn(prices, 'plusCatalog').mockResolvedValue(['game:2', 'game:5', 'game:1'])
  spyOn(games, 'getGame').mockImplementation(async (id) =>
    id === 'game:2'
      ? fresh
      : id === 'game:5'
        ? makeGame({ id: 'game:5', name: 'Gris' })
        : undefined,
  )
  spyOn(recs, 'listDismissed').mockResolvedValue([{ game: fresh }])
  const ai = spyOn(aiModule, 'ai').mockResolvedValue({ game: 'game:5', why: 'x', firstStep: 'y' })
  const pick = await nextPick(
    makeUser({ ps_plus: 'deluxe' }),
    [older, newer],
    'pt-BR',
    { scope: 'any', ownedOnly: true },
    2026,
  )
  const body = ai.mock.calls[0][1] as { choices: { game: string }[]; draw?: unknown }
  expect(body.choices.map((c) => c.game)).toEqual(['game:3', 'game:1', 'game:5'])
  expect(body.draw).toBeUndefined()
  expect(pick?.game.id).toBe('game:5')
  expect(interests.markNextPick).not.toHaveBeenCalled()
})

test('any game: the service draws by taste, past owned, turned down and just picked games', async () => {
  spyOn(interests, 'listInterests').mockResolvedValue([])
  const mine = makeTitle({ npCommunicationId: 'NPWR1', name: 'Days Gone' })
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map([['NPWR1', started]]))
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  spyOn(recs, 'listDismissed').mockResolvedValue([{ game: done }])
  spyOn(recs, 'recentPickGames').mockResolvedValue(['game:8'])
  const graph = spyOn(similar, 'graphCandidates').mockResolvedValue(['game:7'])
  const journey = makeGame({ id: 'game:7', name: 'Journey' })
  spyOn(games, 'getGame').mockImplementation(async (id) => (id === 'game:7' ? journey : undefined))
  const ai = spyOn(aiModule, 'ai').mockResolvedValue({ game: 'game:7', why: 'x', firstStep: 'y' })
  const pick = await nextPick(user, [mine], 'pt-BR', { scope: 'any', mood: 'fácil' }, 2026)
  const body = ai.mock.calls[0][1] as {
    choices: unknown[]
    draw: { exclude: string[]; candidates: string[]; library: { game: string }[] }
  }
  expect(body.choices).toEqual([])
  expect(body.draw.exclude).toEqual(['game:1', 'game:3', 'game:8'])
  expect(body.draw.candidates).toEqual(['game:7'])
  expect(body.draw.library[0].game).toBe('game:1')
  expect(graph.mock.calls[0][3]).toEqual(new Set(['game:1', 'game:3', 'game:8']))
  expect(pick).toMatchObject({ scope: 'any', mood: 'fácil', game: { id: 'game:7' } })

  // A drawn game the catalog does not know is no pick, and nothing is kept.
  ai.mockResolvedValue({ game: 'game:404', why: 'x', firstStep: 'y' })
  graph.mockRejectedValue(new Error('no edges'))
  expect(await nextPick(user, [mine], 'pt-BR', { scope: 'any' }, 2026)).toBeNull()
  expect(recs.savePick).toHaveBeenCalledTimes(1)
})

test('the history is the stored picks as the app shows them', async () => {
  spyOn(recs, 'listPicks').mockResolvedValue([
    {
      id: 'recommendation:9',
      game: fresh,
      why: 'w',
      first_step: 'f',
      mood: 'curto',
      scope: 'any',
      owned_only: true,
      fits: false,
      created_at: AT,
    },
    {
      id: 'recommendation:8',
      game: started,
      why: 'w',
      first_step: 'f',
      scope: 'interests',
      created_at: AT,
    },
  ])
  expect(await pickHistory(user)).toEqual([
    {
      id: 'recommendation:9',
      game: { id: 'game:2', name: 'Inside', cover_url: null },
      why: 'w',
      firstStep: 'f',
      mood: 'curto',
      scope: 'any',
      ownedOnly: true,
      fits: false,
      recommender: 'nexo',
      at: AT,
    },
    {
      id: 'recommendation:8',
      game: { id: 'game:1', name: 'Days Gone', cover_url: null },
      why: 'w',
      firstStep: 'f',
      mood: null,
      scope: 'interests',
      ownedOnly: false,
      fits: true,
      recommender: 'nexo',
      at: AT,
    },
  ])
})
