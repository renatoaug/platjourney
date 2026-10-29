import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { browseGuides, forgetBrowseCache, PAGE_SIZE, showcase } from '../src/browse.ts'
import type { CatalogCard } from '../src/repository/game.ts'
import * as games from '../src/repository/game.ts'
import type { GuideSummary } from '../src/repository/guide.ts'
import * as guides from '../src/repository/guide.ts'

const card = (id: string, name: string, extra: Partial<CatalogCard> = {}): CatalogCard => ({
  id,
  name,
  cover_url: null,
  platforms: ['PS4'],
  release_year: 2020,
  rating: null,
  ...extra,
})
const summary = (game: string, difficulty: number, hours: number): GuideSummary => ({
  game,
  difficulty,
  hours,
  playthroughs: 1,
  hasMissables: false,
  hasOnline: false,
  unobtainable: null,
  deep: true,
})

let cards: ReturnType<typeof spyOn>
let match: ReturnType<typeof spyOn>

beforeEach(() => {
  forgetBrowseCache()
  cards = spyOn(games, 'catalogCards').mockResolvedValue([
    card('game:1', 'Bravo', { rating: 90, platforms: ['PS5', 'PS4'], genres: ['RPG'] }),
    card('game:2', 'Alpha', { rating: 70, genres: ['RPG', 'Puzzle'] }),
    card('game:3', 'Charlie', { rating: 80, platforms: ['PS Vita'], genres: ['Puzzle'] }),
    card('game:4', 'Alpha Two'),
  ])
  spyOn(guides, 'guideSummaries').mockResolvedValue([
    { ...summary('game:1', 7, 60), hasMissables: true, playthroughs: 2 },
    summary('game:2', 2, 30),
    { ...summary('game:3', 2, 5), hasOnline: true },
  ])
  match = spyOn(games, 'matchCatalog').mockResolvedValue([])
})

afterEach(() => mock.restore())

const names = async (opts: Parameters<typeof browseGuides>[0]) =>
  (await browseGuides(opts)).items.map((i) => i.name)

test('without a search it lists the games with a guide, best rated first', async () => {
  const page = await browseGuides({})
  expect(page).toMatchObject({ page: 1, size: PAGE_SIZE, total: 3 })
  expect(page.items.map((i) => i.name)).toEqual(['Bravo', 'Charlie', 'Alpha'])
  expect(page.items[0].guide).toEqual({
    difficulty: 7,
    hours: 60,
    playthroughs: 2,
    hasMissables: true,
    hasOnline: false,
    unobtainable: null,
    deep: true,
  })
})

test('it sorts by name, by difficulty and by hours', async () => {
  expect(await names({ sort: 'name' })).toEqual(['Alpha', 'Bravo', 'Charlie'])
  expect(await names({ sort: 'easiest' })).toEqual(['Charlie', 'Alpha', 'Bravo'])
  expect(await names({ sort: 'shortest' })).toEqual(['Charlie', 'Alpha', 'Bravo'])
  expect(await names({ sort: 'nonsense' })).toEqual(['Bravo', 'Charlie', 'Alpha'])
})

test('it filters by platform and ignores unknown ones', async () => {
  expect(await names({ platform: 'PS Vita' })).toEqual(['Charlie'])
  expect(await names({ platform: 'PS5' })).toEqual(['Bravo'])
  expect(await names({ platform: 'Xbox' })).toHaveLength(3)
})

test('a search covers the catalog, games with a guide first, in relevance order', async () => {
  match.mockResolvedValue(['game:4', 'game:2', 'game:9'])
  const page = await browseGuides({ query: 'alpha' })
  expect(match).toHaveBeenCalledWith('alpha')
  expect(page.items.map((i) => [i.name, i.guide !== null])).toEqual([
    ['Alpha', true],
    ['Alpha Two', false],
  ])
  expect(await names({ query: 'alpha', sort: 'name' })).toEqual(['Alpha', 'Alpha Two'])
  expect(await names({ query: 'a' })).toEqual(['Bravo', 'Charlie', 'Alpha'])
})

test('pages are clamped to what exists', async () => {
  cards.mockResolvedValue(
    Array.from({ length: PAGE_SIZE + 2 }, (_, i) => card(`game:${i}`, `Game ${i}`)),
  )
  spyOn(guides, 'guideSummaries').mockResolvedValue(
    Array.from({ length: PAGE_SIZE + 2 }, (_, i) => summary(`game:${i}`, 3, 10)),
  )
  forgetBrowseCache()
  expect((await browseGuides({ page: 2 })).items).toHaveLength(2)
  expect((await browseGuides({ page: 9 })).page).toBe(2)
  expect((await browseGuides({ page: -3 })).page).toBe(1)
})

test('the collage holds the covers of the best rated games with a guide, whatever the filters', async () => {
  cards.mockResolvedValue([
    card('game:1', 'Bravo', { rating: 90, cover_url: 'b.jpg' }),
    card('game:2', 'Alpha', { rating: 70, cover_url: 'a.jpg' }),
    card('game:3', 'Charlie', { rating: 80 }),
    card('game:4', 'Alpha Two', { rating: 99, cover_url: 'none.jpg' }),
  ])
  forgetBrowseCache()
  expect((await browseGuides({ difficulty: 'hard' })).collage).toEqual(['b.jpg', 'a.jpg'])
})

test('catalog and guides are read once for a while', async () => {
  await browseGuides({})
  await browseGuides({ sort: 'name' })
  expect(cards).toHaveBeenCalledTimes(1)
})

test('the guide filters narrow the list, each band its own range', async () => {
  expect(await names({ difficulty: 'easy' })).toEqual(['Charlie', 'Alpha'])
  expect(await names({ difficulty: 'hard' })).toEqual(['Bravo'])
  expect(await names({ difficulty: 'brutal' })).toEqual([])
  expect(await names({ hours: '10' })).toEqual(['Charlie'])
  expect(await names({ noMissables: true })).toEqual(['Charlie', 'Alpha'])
  expect(await names({ onePlaythrough: true })).toEqual(['Charlie', 'Alpha'])
  expect(await names({ noOnline: true })).toEqual(['Bravo', 'Alpha'])
  expect(await names({ genre: 'Puzzle', noOnline: true })).toEqual(['Alpha'])
  // An unknown band or hour limit is ignored.
  expect(await names({ difficulty: 'nope', hours: '7' })).toHaveLength(3)
})

test('each filter counts what it would leave, with the other filters applied', async () => {
  const { facets, total } = await browseGuides({ noOnline: true })
  expect(total).toBe(2)
  expect(facets.difficulty).toEqual({ easy: 1, medium: 0, hard: 1, brutal: 0 })
  expect(facets.hours).toEqual({ '10': 0, '25': 0, '50': 1, '100': 2 })
  // Its own count ignores itself: three games, two without online trophies.
  expect(facets.noOnline).toBe(2)
  expect(facets.noMissables).toBe(1)
  expect(facets.genres).toEqual([
    { name: 'RPG', count: 2 },
    { name: 'Puzzle', count: 1 },
  ])
})

test('the sign-in wall: the best rated covers of games with a guide, and how many guides', async () => {
  cards.mockResolvedValue([
    card('game:1', 'Bravo', { rating: 90, cover_url: 'b.jpg' }),
    card('game:2', 'Alpha', { rating: 70, cover_url: 'a.jpg' }),
    card('game:3', 'Charlie', { rating: 80 }),
    card('game:4', 'Delta', { rating: 99, cover_url: 'd.jpg' }),
  ])
  const wall = await showcase()
  // game:4 has no guide; game:3 has no cover.
  expect(wall.covers).toEqual(['b.jpg', 'a.jpg'])
  expect(wall.guides).toBe(3)
})
