import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import * as games from '../src/repository/game.ts'
import * as interests from '../src/repository/interest.ts'
import * as recs from '../src/repository/recommendation.ts'
import type { GuideFacts } from '../src/repository/similar.ts'
import * as graph from '../src/repository/similar.ts'
import {
  breaksRules,
  catalogLinks,
  quickPicks,
  relatedOrder,
  type Seed,
  scoreCandidates,
  seedWeights,
  seriesCandidates,
  similarPicks,
  similarToGame,
  titleWeight,
  toPick,
} from '../src/similar.ts'
import { counts, makeGame, makeTitle, makeUser } from './fixtures.ts'

const NOW = new Date('2026-10-15T00:00:00Z').getTime()
const recent = '2026-10-01T00:00:00Z'
const old = '2025-01-01T00:00:00Z'

afterEach(() => mock.restore())

const seed = (game: string, weight: number, strong = true): Seed => ({
  game,
  name: `Name ${game}`,
  weight,
  strong,
  platinum: false,
})

test('a platinum weighs 3, half done 2, anything else 1, and a recent title 1 more', () => {
  const plat = makeTitle({ earnedByType: counts(1, 1, 1, 1), progress: 100, lastUpdated: old })
  expect(titleWeight(plat, NOW)).toBe(3)
  expect(titleWeight({ ...plat, lastUpdated: recent }, NOW)).toBe(4)
  expect(titleWeight(makeTitle({ progress: 50, lastUpdated: old }), NOW)).toBe(2)
  expect(titleWeight(makeTitle({ progress: 49, lastUpdated: old }), NOW)).toBe(1)
  expect(titleWeight(makeTitle({ progress: 10, lastUpdated: recent }), NOW)).toBe(2)
})

test('seeds are the catalog games of the titles, the heaviest copy of each', () => {
  const a = makeGame({ id: 'game:1', name: 'A' })
  const library = [
    makeTitle({ npCommunicationId: 'NP1', progress: 10, lastUpdated: old }),
    makeTitle({ npCommunicationId: 'NP2', progress: 60, lastUpdated: old }),
    makeTitle({ npCommunicationId: 'NP3', progress: 100, lastUpdated: old }),
  ]
  const seeds = seedWeights(
    library,
    new Map([
      ['NP1', a],
      ['NP2', a],
    ]),
    NOW,
  )
  expect([...seeds.values()]).toEqual([
    { game: 'game:1', name: 'A', weight: 2, strong: true, platinum: false },
  ])
})

test('candidates add up the seeds that lead to them, IGDB rank and co-platinums', () => {
  const seeds = new Map([
    ['game:1', seed('game:1', 3)],
    ['game:2', seed('game:2', 1)],
  ])
  const scored = scoreCandidates(
    seeds,
    [
      { seed: 'game:1', game: 'game:10', rank: 9 },
      { seed: 'game:2', game: 'game:10', rank: 9 },
      { seed: 'game:1', game: 'game:11', rank: 0 },
      { seed: 'game:2', game: 'game:12', rank: 20 },
      // A seed pointing at another seed is not a candidate.
      { seed: 'game:1', game: 'game:2', rank: 0 },
      { seed: 'game:9', game: 'game:13', rank: 0 },
    ],
    [
      { user: 'user:a', game: 'game:12' },
      { user: 'user:a', game: 'game:12' },
      { user: 'user:b', game: 'game:12' },
      { user: 'user:c', game: 'game:99' },
    ],
  )
  expect(scored.map((c) => [c.game, c.score])).toEqual([
    ['game:12', 5],
    ['game:10', 4.1],
    ['game:11', 3.5],
  ])
  expect(scored[1].because).toEqual(['Name game:1', 'Name game:2'])
})

test('each rule drops a guide that breaks it, and unknown facts pass', () => {
  const facts: GuideFacts = {
    game: 'game:1',
    difficulty: 7,
    hours: 40,
    playthroughs: 2,
    hasMissables: true,
    hasOnline: false,
    onlineTrophies: 0,
    difficultyTrophy: 'Hard',
  }
  expect(breaksRules(facts, {})).toBe(false)
  expect(breaksRules(facts, { noMissables: true })).toBe(true)
  expect(breaksRules(facts, { onePlaythrough: true })).toBe(true)
  expect(breaksRules(facts, { noDifficultyTrophy: true })).toBe(true)
  expect(breaksRules(facts, { noOnline: true })).toBe(false)
  expect(breaksRules({ ...facts, onlineTrophies: 2 }, { noOnline: true })).toBe(true)
  expect(breaksRules({ ...facts, hasOnline: true }, { noOnline: true })).toBe(true)
  expect(breaksRules(facts, { maxHours: 40 })).toBe(false)
  expect(breaksRules(facts, { maxHours: 39 })).toBe(true)
  expect(breaksRules(facts, { maxDifficulty: 6 })).toBe(true)
  expect(breaksRules(facts, { maxDifficulty: 7 })).toBe(false)
  const unknown = { game: 'game:1' }
  expect(
    breaksRules(unknown, {
      noMissables: true,
      noOnline: true,
      onePlaythrough: true,
      noDifficultyTrophy: true,
      maxHours: 1,
      maxDifficulty: 1,
    }),
  ).toBe(false)
})

test('a pick shows the guide facts and the newest platform', () => {
  const game = makeGame({ platforms: ['PS4', 'PS5'] })
  expect(
    toPick(
      game,
      { game: game.id, playthroughs: 0, difficultyTrophy: null },
      ['A', 'B'],
      new Set(['B']),
    ),
  ).toEqual({
    game,
    platform: 'PS5',
    difficulty: 0,
    hours: 0,
    playthroughs: null,
    hasMissables: false,
    hasDifficultyTrophy: false,
    because: ['A', 'B'],
    platinumed: ['B'],
  })
  const vita = makeGame({ platforms: ['PS Vita'] })
  expect(toPick(vita, { game: vita.id, playthroughs: 2 }, [])).toMatchObject({
    platform: 'PS Vita',
    playthroughs: 2,
    hasDifficultyTrophy: null,
  })
})

test('quick picks are short and easy, the best six', () => {
  const c = (hours: number | null, difficulty: number | null) => ({
    facts: { game: 'g', hours, difficulty },
  })
  const list = [
    c(5, 2),
    c(0, 2),
    c(11, 2),
    c(10, 3),
    c(5, 4),
    c(5, null),
    ...Array(8).fill(c(1, 1)),
  ]
  const quick = quickPicks(list)
  expect(quick).toHaveLength(6)
  expect(quick.slice(0, 2)).toEqual([c(5, 2), c(10, 3)])
})

test('series candidates put expansions and base games first, then the same series', () => {
  const liked = [seed('game:1', 4), seed('game:2', 2)]
  const result = seriesCandidates(
    liked,
    [
      { expansion: 'game:10', base: 'game:1' },
      { expansion: 'game:2', base: 'game:11' },
      { expansion: 'game:12', base: 'game:77' },
    ],
    [{ id: 'game:2', series: [5] }],
    [
      { id: 'game:13', series: [5, 6] },
      { id: 'game:11', series: [5] },
      { id: 'game:2', series: [5] },
      { id: 'game:14', series: [5] },
      { id: 'game:15', series: [9] },
    ],
    new Set(['game:14']),
  )
  expect(result).toEqual([
    { game: 'game:10', close: true, weight: 4, because: ['Name game:1'] },
    { game: 'game:11', close: true, weight: 2, because: ['Name game:2'] },
    { game: 'game:13', close: false, weight: 2, because: ['Name game:2'] },
  ])
})

test('a game page lists expansions and base game, then similar by rank, then series, once', () => {
  expect(
    relatedOrder(
      'game:1',
      [
        { expansion: 'game:2', base: 'game:1' },
        { expansion: 'game:1', base: 'game:3' },
      ],
      [
        { game: 'game:5', rank: 4 },
        { game: 'game:2', rank: 0 },
        { game: 'game:4', rank: 1 },
      ],
      [{ id: 'game:4' }, { id: 'game:6' }, { id: 'game:1' }],
    ),
  ).toEqual([
    { game: 'game:2', relation: 'expansion' },
    { game: 'game:3', relation: 'base' },
    { game: 'game:4', relation: 'similar' },
    { game: 'game:5', relation: 'similar' },
    { game: 'game:6', relation: 'series' },
  ])
})

test('catalog links keep games in the catalog, their IGDB rank and an expansion base', () => {
  const byIgdb = new Map([
    [1, 'game:1'],
    [2, 'game:2'],
    [3, 'game:3'],
  ])
  expect(
    catalogLinks('game:1', { similar: [9, 2, 1, 3, 2], parent: 3, series: [7, 7, 8] }, byIgdb),
  ).toEqual({
    similar: [
      { game: 'game:2', rank: 1 },
      { game: 'game:3', rank: 3 },
    ],
    base: 'game:3',
    series: [7, 8],
  })
  expect(catalogLinks('game:1', { similar: [], parent: 99, series: [] }, byIgdb).base).toBeNull()
  expect(catalogLinks('game:1', { similar: [], parent: 1, series: [] }, byIgdb).base).toBeNull()
})

const user = makeUser({ taste_prefs: { filters: { maxHours: 30 } } })

beforeEach(() => {
  spyOn(recs, 'listDismissed').mockResolvedValue([])
  spyOn(interests, 'listInterests').mockResolvedValue([])
  spyOn(graph, 'peerPlatinums').mockResolvedValue([])
  spyOn(graph, 'expansionLinks').mockResolvedValue([])
  spyOn(graph, 'seriesOf').mockResolvedValue([])
  spyOn(graph, 'guidedInSeries').mockResolvedValue([])
  spyOn(graph, 'gamesByIds').mockImplementation(async (ids) =>
    ids.map((id) => makeGame({ id, name: `Game ${id}` })),
  )
})

test('without a library nothing is searched', async () => {
  const edges = spyOn(graph, 'similarEdges')
  expect(await similarPicks(user, [], [])).toEqual({
    items: [],
    quick: [],
    series: [],
    reason: 'no-library',
  })
  expect(edges).not.toHaveBeenCalled()
})

test('similar picks keep guided games the player has not, by their rules', async () => {
  const played = makeGame({ id: 'game:1', name: 'Played' })
  const done = makeGame({ id: 'game:2', name: 'Done' })
  spyOn(games, 'gamesForTitles').mockResolvedValue(
    new Map([
      ['NP1', played],
      ['NP2', done],
    ]),
  )
  spyOn(recs, 'listDismissed').mockResolvedValue([{ game: makeGame({ id: 'game:12' }) }])
  spyOn(interests, 'listInterests').mockResolvedValue([
    { id: 'interest:1', game: makeGame({ id: 'game:13' }), year: 2026, position: 0 },
  ])
  spyOn(graph, 'similarEdges').mockResolvedValue(
    ['game:10', 'game:11', 'game:12', 'game:13', 'game:14', 'game:15', 'game:16'].map(
      (game, i) => ({
        seed: i === 0 ? 'game:2' : 'game:1',
        game,
        rank: i,
      }),
    ),
  )
  // Two players who platinumed a seed also platinumed game:15: it climbs above the platinum's pick.
  const peers = spyOn(graph, 'peerPlatinums').mockResolvedValue([
    { user: 'user:x', game: 'game:15' },
    { user: 'user:y', game: 'game:15' },
  ])
  const facts = spyOn(graph, 'guideFacts').mockResolvedValue([
    { game: 'game:10', hours: 8, difficulty: 2 },
    { game: 'game:11', hours: 20, difficulty: 5, playthroughs: 1 },
    { game: 'game:12', hours: 5, difficulty: 1 },
    { game: 'game:13', hours: 5, difficulty: 1 },
    // Breaks the player's rule of 30 hours at most.
    { game: 'game:14', hours: 60, difficulty: 2 },
    { game: 'game:15', hours: 25, difficulty: 4 },
  ])
  const library = [
    makeTitle({ npCommunicationId: 'NP1', progress: 20, lastUpdated: old }),
    makeTitle({ npCommunicationId: 'NP2', earnedByType: counts(1, 1, 1, 1), lastUpdated: old }),
  ]
  const owned = makeGame({ id: 'game:16' })
  const result = await similarPicks(user, library, [owned])
  expect(peers.mock.calls[0][0]).toBe(user.id)
  // Owned, dismissed and saved games never reach the guide lookup.
  expect(facts.mock.calls[0][0]).toEqual(['game:15', 'game:10', 'game:11', 'game:14'])
  expect(result.items.map((p) => [p.game.id, p.because])).toEqual([
    ['game:15', ['Played']],
    ['game:10', ['Done']],
    ['game:11', ['Played']],
  ])
  expect(result.items[2]).toMatchObject({ hours: 20, difficulty: 5, playthroughs: 1 })
  expect(result.quick.map((p) => p.game.id)).toEqual(['game:10'])
  expect(result.series).toEqual([])
  expect(result.reason).toBeUndefined()
})

test('series picks come from the liked games and follow the same exclusions', async () => {
  const liked = makeGame({ id: 'game:1', name: 'Uncharted 4' })
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map([['NP1', liked]]))
  spyOn(graph, 'similarEdges').mockResolvedValue([])
  const links = spyOn(graph, 'expansionLinks').mockResolvedValue([
    { expansion: 'game:20', base: 'game:1' },
  ])
  spyOn(graph, 'seriesOf').mockResolvedValue([{ id: 'game:1', series: [3] }])
  spyOn(graph, 'guidedInSeries').mockResolvedValue([
    { id: 'game:21', series: [3] },
    { id: 'game:22', series: [3] },
  ])
  spyOn(graph, 'guideFacts').mockResolvedValue([
    { game: 'game:20', hours: 10, difficulty: 3 },
    { game: 'game:21', hours: 15, difficulty: 3 },
  ])
  const result = await similarPicks(
    user,
    [makeTitle({ npCommunicationId: 'NP1', progress: 80, lastUpdated: old })],
    [],
  )
  expect(links).toHaveBeenCalledWith(['game:1'])
  expect(result.series.map((p) => [p.game.id, p.because])).toEqual([
    ['game:20', ['Uncharted 4']],
    ['game:21', ['Uncharted 4']],
  ])
  expect(result.items).toEqual([])
})

test('a game that is only started does not lead to series picks', async () => {
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map([['NP1', makeGame({ id: 'game:1' })]]))
  spyOn(graph, 'similarEdges').mockResolvedValue([])
  spyOn(graph, 'guideFacts').mockResolvedValue([])
  const links = spyOn(graph, 'expansionLinks')
  await similarPicks(user, [makeTitle({ npCommunicationId: 'NP1', progress: 10 })], [])
  expect(links).toHaveBeenCalledWith([])
})

test('the similar games of a game are guided ones, related first, six at most', async () => {
  spyOn(graph, 'expansionLinks').mockResolvedValue([{ expansion: 'game:1', base: 'game:2' }])
  spyOn(graph, 'similarOf').mockResolvedValue(
    [3, 4, 5, 6, 7, 8, 9].map((n, rank) => ({ game: `game:${n}`, rank })),
  )
  spyOn(graph, 'seriesOf').mockResolvedValue([{ id: 'game:1', series: [1] }])
  const series = spyOn(graph, 'guidedInSeries').mockResolvedValue([{ id: 'game:10', series: [1] }])
  spyOn(graph, 'guideFacts').mockImplementation(async (ids) =>
    ids.filter((id) => id !== 'game:4').map((game) => ({ game, difficulty: 2, hours: 9 })),
  )
  const items = await similarToGame('game:1')
  expect(series).toHaveBeenCalledWith([1])
  expect(items.map((i) => [i.game.id, i.relation])).toEqual([
    ['game:2', 'base'],
    ['game:3', 'similar'],
    ['game:5', 'similar'],
    ['game:6', 'similar'],
    ['game:7', 'similar'],
    ['game:8', 'similar'],
  ])
  expect(items[0]).toMatchObject({ difficulty: 2, hours: 9 })
})
