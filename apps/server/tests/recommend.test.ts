import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import * as aiModule from '../src/ai.ts'
import * as plugins from '../src/plugins.ts'
import {
  dismissRecommendation,
  effectiveProfile,
  emptyPrefs,
  readPrefs,
  recommendationReport,
  recommendations,
} from '../src/recommend.ts'
import * as games from '../src/repository/game.ts'
import * as guides from '../src/repository/guide.ts'
import * as interests from '../src/repository/interest.ts'
import type { RecommendationRow } from '../src/repository/recommendation.ts'
import * as recs from '../src/repository/recommendation.ts'
import * as graph from '../src/repository/similar.ts'
import * as users from '../src/repository/user.ts'
import { makeGame, makeTitle, makeUser } from './fixtures.ts'

const user = makeUser({ taste_profile: { summary: 'Gosta de mundo aberto', genres: ['RPG'] } })
const owned = makeGame({ id: 'game:1', name: 'Owned' })
const dismissed = makeGame({ id: 'game:2', name: 'Dismissed' })
const picked = makeGame({ id: 'game:3', name: 'Picked' })
const byName = makeGame({ id: 'game:4', name: 'By Name' })
const saved = makeGame({ id: 'game:5', name: 'Saved' })

const row = (over: Partial<RecommendationRow> = {}): RecommendationRow => ({
  id: 'recommendation:r1',
  game: picked,
  platform: 'PS5',
  difficulty: 3,
  hours: 20,
  playthroughs: 1,
  has_difficulty_trophy: false,
  has_missables: true,
  why: 'Parecido',
  similar_to: ['Owned'],
  generated_at: new Date().toISOString(),
  ...over,
})

beforeEach(() => {
  // Nothing shown before, unless a test says otherwise.
  spyOn(recs, 'seenGames').mockResolvedValue([])
  spyOn(plugins, 'aroundModel')
})

afterEach(() => mock.restore())

test('a fresh batch is served from the database without the model', async () => {
  spyOn(recs, 'listRecommendations').mockResolvedValue([
    row(),
    row({
      game: byName,
      playthroughs: undefined,
      has_difficulty_trophy: undefined,
      similar_to: undefined as never,
    }),
  ])
  spyOn(guides, 'getGuide').mockResolvedValue({ playthroughs: 2, difficultyTrophy: 'Insano' })
  const ai = spyOn(aiModule, 'ai')
  const result = await recommendations(user, [], [])
  expect(ai).not.toHaveBeenCalled()
  expect(result.profile).toEqual(effectiveProfile(user.taste_profile as never, emptyPrefs()))
  expect(result.items[0]).toMatchObject({
    game: picked,
    playthroughs: 1,
    hasDifficultyTrophy: false,
  })
  expect(result.items[1]).toMatchObject({
    game: byName,
    playthroughs: 2,
    hasDifficultyTrophy: true,
    similarTo: [],
  })
})

test('a guide without those facts leaves them unknown', async () => {
  spyOn(recs, 'listRecommendations').mockResolvedValue([
    row({ playthroughs: undefined, has_difficulty_trophy: undefined }),
  ])
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  const [item] = (await recommendations(makeUser(), [], [])).items
  expect(item).toMatchObject({ playthroughs: null, hasDifficultyTrophy: null })
})

test('a stale or forced batch is researched, filtered and stored', async () => {
  const list = spyOn(recs, 'listRecommendations')
    .mockResolvedValueOnce([row({ generated_at: '2020-01-01T00:00:00Z' })])
    .mockResolvedValueOnce([row({ game: saved })])
  spyOn(recs, 'listDismissed').mockResolvedValue([
    { game: dismissed, reason: 'too_long' },
    // Turned down before the player bought it: not a taste signal any more.
    { game: owned },
  ])
  spyOn(interests, 'listInterests').mockResolvedValue([
    { id: 'interest:i', game: saved, year: 2026, position: 1 },
  ])
  const title = makeTitle({ npCommunicationId: 'NPOWN', name: 'Owned' })
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map([['NPOWN', owned]]))
  spyOn(games, 'getGame').mockImplementation((async (id: string) =>
    id === 'game:3' ? picked : undefined) as never)
  spyOn(games, 'gameByName').mockImplementation((async (name: string) =>
    name === 'Dismissed'
      ? dismissed
      : name === 'Owned'
        ? owned
        : name === 'Made Up'
          ? undefined
          : byName) as never)
  const replace = spyOn(recs, 'saveRecommendations').mockResolvedValue(undefined)
  const update = spyOn(users, 'updateUser').mockResolvedValue(undefined)
  const profile = { summary: 'Novo', genres: ['Ação'], traits: [], avoid: [] }
  const item = (name: string, game: string | null, over: Record<string, unknown> = {}) => ({
    name,
    platform: 'PS5',
    difficulty: 5,
    hours: 40,
    playthroughs: null,
    hasDifficultyTrophy: null,
    why: 'porque',
    hasMissables: false,
    game,
    similarTo: [],
    ...over,
  })
  const ai = spyOn(aiModule, 'ai').mockResolvedValue({
    profile,
    items: [
      item('Picked', 'game:3', { playthroughs: 2, hasDifficultyTrophy: true }),
      item('By Name', null, { playthroughs: 0 }),
      item('Gone', 'game:404'),
      item('Owned', null),
      item('Dismissed', null),
      // Not in the catalog: dropped, never created.
      item('Made Up', null),
    ],
  })
  // The graph's candidates go along, best first, without what is excluded.
  spyOn(graph, 'similarEdges').mockResolvedValue([
    { seed: 'game:1', game: 'game:7', rank: 3 },
    { seed: 'game:1', game: 'game:8', rank: 0 },
    { seed: 'game:1', game: 'game:2', rank: 1 },
  ])
  const peers = spyOn(graph, 'peerPlatinums').mockResolvedValue([])
  const result = await recommendations(user, [title], [owned])
  expect(peers).toHaveBeenCalledWith(user.id, ['game:1'], ['game:7', 'game:8', 'game:2'])
  expect(ai).toHaveBeenCalledWith('/recommend', {
    library: [
      {
        name: 'Owned',
        progress: 50,
        lastUpdated: title.lastUpdated,
        earnedByType: title.earnedByType,
        game: 'game:1',
      },
    ],
    exclude: ['game:1', 'game:2', 'game:5'],
    candidates: ['game:8', 'game:7'],
    dismissed: [{ name: 'Dismissed', reason: 'too_long' }],
    seen: [],
    preferences: { likes: [], avoid: [], wrong: [], filters: {} },
  })
  const base = {
    platform: 'PS5',
    difficulty: 5,
    hours: 40,
    has_missables: false,
    why: 'porque',
    similar_to: [],
  }
  expect(replace).toHaveBeenCalledWith('user:u1', [
    { game: 'game:3', ...base, playthroughs: 2, has_difficulty_trophy: true },
    { game: 'game:4', ...base },
    { game: 'game:4', ...base },
  ])
  expect(update).toHaveBeenCalledWith('user:u1', { taste_profile: profile })
  expect(list).toHaveBeenCalledTimes(2)
  expect(result.profile).toEqual(profile)
  expect(result.items.map((i) => i.game.id)).toEqual(['game:5'])
})

test('an empty batch is generated even with no previous one', async () => {
  spyOn(recs, 'listRecommendations').mockResolvedValue([])
  spyOn(recs, 'listDismissed').mockResolvedValue([])
  spyOn(interests, 'listInterests').mockResolvedValue([])
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map())
  spyOn(recs, 'saveRecommendations').mockResolvedValue(undefined)
  spyOn(users, 'updateUser').mockResolvedValue(undefined)
  const ai = spyOn(aiModule, 'ai').mockResolvedValue({ profile: null, items: [] })
  // The graph cannot be read (its edges are not written yet): the service searches by taste alone.
  spyOn(graph, 'similarEdges').mockRejectedValue(new Error('no table'))
  expect(await recommendations(user, [makeTitle()], [], true)).toEqual({
    profile: null as never,
    baseProfile: null,
    prefs: emptyPrefs(),
    items: [],
    generatedAt: null,
  })
  expect(ai.mock.calls[0][1]).toMatchObject({ candidates: [] })
})

test('dismissing a recommendation stores the dismissal and its reason', async () => {
  const dismiss = spyOn(recs, 'dismiss').mockResolvedValue(undefined)
  await dismissRecommendation(user, 'game:3', 'played')
  expect(dismiss).toHaveBeenCalledWith('user:u1', 'game:3', 'played')
})

test('the report lists each pick with its profile', () => {
  const item = {
    game: picked,
    platform: 'PS5',
    difficulty: 3,
    hours: 20,
    playthroughs: 1,
    hasDifficultyTrophy: false,
    why: 'Parecido',
    hasMissables: true,
    similarTo: [],
  }
  expect(
    recommendationReport({
      profile: { summary: 'Explorador', genres: ['RPG', 'Ação'], traits: [], avoid: [] },
      prefs: emptyPrefs(),
      items: [item, { ...item, hasMissables: false }],
      generatedAt: null,
    }),
  ).toBe(
    [
      'Seu perfil: Explorador',
      'Gêneros: RPG, Ação',
      '',
      'Próximas platinas pro seu gosto:',
      '1. Picked (PS5): 3/10, ~20h, tem missables\n   Parecido',
      '2. Picked (PS5): 3/10, ~20h\n   Parecido',
    ].join('\n'),
  )
  expect(
    recommendationReport({ profile: null, prefs: emptyPrefs(), items: [item], generatedAt: null }),
  ).toStartWith('Próximas platinas')
})

test('an empty report asks to try again', () => {
  expect(
    recommendationReport({ profile: null, prefs: emptyPrefs(), items: [], generatedAt: null }),
  ).toBe('Ainda não tenho recomendações. Tenta de novo em 1 minuto.')
})

test('the demo keeps its stored batch, however old, and never asks the model', async () => {
  spyOn(recs, 'listRecommendations').mockResolvedValue([
    row({ generated_at: '2020-01-01T00:00:00Z' }),
  ])
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  const ai = spyOn(aiModule, 'ai')
  const demo = makeUser({ demo: true })
  const result = await recommendations(demo, [], [], true)
  expect(result.items).toHaveLength(1)
  expect(result.generatedAt).toBe('2020-01-01T00:00:00Z')
  expect(ai).not.toHaveBeenCalled()
})

test('an empty library is not searched', async () => {
  spyOn(recs, 'listRecommendations').mockResolvedValue([])
  const ai = spyOn(aiModule, 'ai')
  const around = plugins.aroundModel as unknown as ReturnType<typeof spyOn>
  expect(await recommendations(user, [], [], true)).toEqual({
    profile: null,
    prefs: emptyPrefs(),
    items: [],
    generatedAt: null,
    reason: 'no-library',
  })
  expect(ai).not.toHaveBeenCalled()
  expect(around).not.toHaveBeenCalled()
})

test("the player's changes reshape the model's profile and survive a new one", () => {
  const prefs = readPrefs({
    added: { genres: ['Metroidvania', ' metroidvania '], traits: ['jogos curtos'], avoid: [] },
    removed: { genres: ['Terror'], traits: [], avoid: [] },
    filters: { noOnline: true, maxHours: 999, maxDifficulty: 'x', noMissables: 'yes' },
  })
  expect(prefs?.added.genres).toEqual(['Metroidvania'])
  expect(prefs?.filters).toEqual({ noOnline: true, maxHours: 500 })
  const model = { summary: 'Você...', genres: ['RPG', 'terror'], traits: ['longas'], avoid: [] }
  expect(effectiveProfile(model, prefs ?? emptyPrefs())).toEqual({
    summary: 'Você...',
    genres: ['RPG', 'Metroidvania'],
    traits: ['longas', 'jogos curtos'],
    avoid: [],
  })
  expect(effectiveProfile(null, emptyPrefs())).toBeNull()
  expect(readPrefs('nope')).toBeNull()
  expect(readPrefs({ added: { genres: 'x' } })).toBeNull()
  expect(readPrefs(undefined)).toEqual(emptyPrefs())
})

test('a new batch sends what the player said to the service', async () => {
  spyOn(recs, 'listRecommendations').mockResolvedValue([])
  spyOn(recs, 'listDismissed').mockResolvedValue([])
  spyOn(interests, 'listInterests').mockResolvedValue([])
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map())
  spyOn(recs, 'saveRecommendations').mockResolvedValue(undefined)
  spyOn(users, 'updateUser').mockResolvedValue(undefined)
  const ai = spyOn(aiModule, 'ai').mockResolvedValue({ profile: null, items: [] })
  const said = makeUser({
    taste_prefs: {
      added: { genres: ['Soulslike'], traits: [], avoid: ['terror'] },
      removed: { genres: [], traits: ['longas'], avoid: [] },
      filters: { noMissables: true },
    },
  })
  await recommendations(said, [makeTitle()], [], true)
  expect((ai.mock.calls[0][1] as { preferences: unknown }).preferences).toEqual({
    likes: ['Soulslike'],
    avoid: ['terror'],
    wrong: ['longas'],
    filters: { noMissables: true },
  })
})

test('a change of preferences answers with the stored batch, never a new one', async () => {
  spyOn(recs, 'listRecommendations').mockResolvedValue([])
  const ai = spyOn(aiModule, 'ai')
  const result = await recommendations(user, [makeTitle()], [], false, true)
  expect(result.items).toEqual([])
  expect(ai).not.toHaveBeenCalled()
})

test('games already shown go to the service apart, oldest first', async () => {
  spyOn(recs, 'listRecommendations').mockResolvedValue([])
  spyOn(recs, 'listDismissed').mockResolvedValue([])
  spyOn(recs, 'seenGames').mockResolvedValue(['game:7', 'game:8'])
  spyOn(interests, 'listInterests').mockResolvedValue([])
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map())
  spyOn(recs, 'saveRecommendations').mockResolvedValue(undefined)
  spyOn(users, 'updateUser').mockResolvedValue(undefined)
  const ai = spyOn(aiModule, 'ai').mockResolvedValue({ profile: null, items: [] })
  await recommendations(user, [makeTitle()], [], true)
  const body = ai.mock.calls[0][1] as { exclude: string[]; seen: string[] }
  expect(body.seen).toEqual(['game:7', 'game:8'])
  expect(body.exclude).toEqual([])
  expect(recs.seenGames).toHaveBeenCalledWith(user.id, 365)
})
