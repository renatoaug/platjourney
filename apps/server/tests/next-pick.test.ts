import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import * as aiModule from '../src/ai.ts'
import { nextPick } from '../src/next-pick.ts'
import * as plugins from '../src/plugins.ts'
import * as ranking from '../src/ranking.ts'
import * as games from '../src/repository/game.ts'
import * as guides from '../src/repository/guide.ts'
import * as interests from '../src/repository/interest.ts'
import { makeGame, makeTitle, makeUser } from './fixtures.ts'

const user = makeUser({ taste_profile: { summary: 'Gosta de mundo aberto' } })
const started = makeGame({ id: 'game:1', name: 'Days Gone', np_communication_ids: ['NPWR1'] })
const fresh = makeGame({ id: 'game:2', name: 'Inside' })
const done = makeGame({ id: 'game:3', name: 'Elden Ring', np_communication_ids: ['NPWR3'] })

beforeEach(() => {
  spyOn(plugins, 'aroundModel')
  spyOn(ranking, 'loadGroups').mockResolvedValue(null)
})

afterEach(() => mock.restore())

const saved = (...gs: (typeof started)[]) =>
  gs.map((game, i) => ({ id: `interest:${i}`, game, year: 2026, position: i }))

test('nothing saved means no pick and no model', async () => {
  spyOn(interests, 'listInterests').mockResolvedValue([])
  const ai = spyOn(aiModule, 'ai')
  expect(await nextPick(user, [], 'pt-BR', 2026)).toBeNull()
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
  const pick = await nextPick(user, [playing, platinum], 'en', 2026)
  expect(pick).toEqual({
    game: { id: 'game:2', name: 'Inside', cover_url: null },
    why: 'Curto depois de um longo',
    firstStep: 'Comece pelo capítulo 1',
  })
  const [path, body] = ai.mock.calls[0] as [string, Record<string, unknown>]
  expect(path).toBe('/interests/next')
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
  expect((await nextPick(user, [], 'pt-BR', 2026))?.game.id).toBe('game:1')
  spyOn(aiModule, 'ai').mockResolvedValue(null)
  expect(await nextPick(user, [], 'pt-BR', 2026)).toBeNull()
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
  await nextPick(user, [playing, platinum], 'pt-BR', 2026)
  const body = ai.mock.calls[0][1] as { choices: { game: string; progress: number }[] }
  expect(body.choices.map((c) => [c.game, c.progress])).toEqual([['game:1', 50]])

  // Counting DLC: the PSN total, and the platinumed game still out (only its DLC is left).
  await nextPick(makeUser({ include_dlc_progress: true }), [playing, platinum], 'pt-BR', 2026)
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
  expect(await nextPick(user, [platinum], 'pt-BR', 2026)).toBeNull()
  expect(ai).not.toHaveBeenCalled()
})

test('the game being played is what the pick comes after, unless it is the only one left', async () => {
  spyOn(interests, 'listInterests').mockResolvedValue(saved(started, fresh))
  const now = new Date().toISOString()
  const playing = makeTitle({ npCommunicationId: 'NPWR1', progress: 74, lastUpdated: now })
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map([['NPWR1', started]]))
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  const ai = spyOn(aiModule, 'ai').mockResolvedValue({ game: 'game:2', why: 'x', firstStep: 'y' })
  await nextPick(user, [playing], 'pt-BR', 2026)
  const body = ai.mock.calls[0][1] as { choices: { game: string }[]; playing: unknown }
  expect(body.choices.map((c) => c.game)).toEqual(['game:2'])
  expect(body.playing).toEqual([{ name: 'Days Gone', progress: 74 }])

  spyOn(interests, 'listInterests').mockResolvedValue(saved(started))
  await nextPick(user, [playing], 'pt-BR', 2026)
  const only = ai.mock.calls[1][1] as { choices: { game: string }[]; playing: unknown }
  expect(only.choices.map((c) => c.game)).toEqual(['game:1'])
  expect(only.playing).toEqual([])
})
