import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { browseGuides, forgetBrowseCache, PAGE_SIZE } from '../src/browse.ts'
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
    card('game:1', 'Bravo', { rating: 90, platforms: ['PS5', 'PS4'] }),
    card('game:2', 'Alpha', { rating: 70 }),
    card('game:3', 'Charlie', { rating: 80, platforms: ['PS Vita'] }),
    card('game:4', 'Alpha Two'),
  ])
  spyOn(guides, 'guideSummaries').mockResolvedValue([
    summary('game:1', 7, 60),
    summary('game:2', 2, 30),
    summary('game:3', 2, 5),
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
    playthroughs: 1,
    hasMissables: false,
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

test('catalog and guides are read once for a while', async () => {
  await browseGuides({})
  await browseGuides({ sort: 'name' })
  expect(cards).toHaveBeenCalledTimes(1)
})
