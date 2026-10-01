import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import * as aiModule from '../src/ai.ts'
import * as plugins from '../src/plugins.ts'
import { dismissRecommendation, recommendationReport, recommendations } from '../src/recommend.ts'
import * as games from '../src/repository/game.ts'
import * as guides from '../src/repository/guide.ts'
import * as interests from '../src/repository/interest.ts'
import type { RecommendationRow } from '../src/repository/recommendation.ts'
import * as recs from '../src/repository/recommendation.ts'
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
  expect(result.profile).toEqual(user.taste_profile as never)
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
  const replace = spyOn(recs, 'replaceRecommendations').mockResolvedValue(undefined)
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
  const result = await recommendations(user, [title], [owned])
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
    dismissed: [{ name: 'Dismissed', reason: 'too_long' }],
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
  spyOn(recs, 'replaceRecommendations').mockResolvedValue(undefined)
  spyOn(users, 'updateUser').mockResolvedValue(undefined)
  spyOn(aiModule, 'ai').mockResolvedValue({ profile: null, items: [] })
  expect(await recommendations(user, [makeTitle()], [], true)).toEqual({
    profile: null as never,
    items: [],
    generatedAt: null,
  })
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
      items: [item, { ...item, hasMissables: false }],
      generatedAt: null,
    }),
  ).toBe(
    [
      'Seu perfil: Explorador',
      'Gêneros: RPG, Ação',
      '',
      'Próximas platinas pro seu gosto:',
      '1. Picked (PS5) — 3/10, ~20h, tem missables\n   Parecido',
      '2. Picked (PS5) — 3/10, ~20h\n   Parecido',
    ].join('\n'),
  )
  expect(recommendationReport({ profile: null, items: [item], generatedAt: null })).toStartWith(
    'Próximas platinas',
  )
})

test('an empty report asks to try again', () => {
  expect(recommendationReport({ profile: null, items: [], generatedAt: null })).toBe(
    'Ainda não tenho recomendações. Tenta de novo em 1 minuto.',
  )
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
    items: [],
    generatedAt: null,
    reason: 'no-library',
  })
  expect(ai).not.toHaveBeenCalled()
  expect(around).not.toHaveBeenCalled()
})
