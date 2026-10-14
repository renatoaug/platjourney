import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { config } from '../src/config.ts'
import {
  artUrl,
  canonical,
  type IgdbGame,
  igdbImage,
  media,
  normalizeName,
  popularGames,
  resolveGame,
  toCatalog,
  withoutEdition,
} from '../src/igdb.ts'

const game = (over: Partial<IgdbGame> = {}): IgdbGame => ({
  id: 1,
  name: 'Ghost of Tsushima',
  slug: 'ghost-of-tsushima',
  game_type: 0,
  ...over,
})

let clock = 1_000_000

beforeEach(() => {
  spyOn(Date, 'now').mockImplementation(() => {
    clock += 10_000
    return clock
  })
})

afterEach(() => mock.restore())

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// Answers the Twitch token request and hands every IGDB query to `games`.
function igdbApi(games: (body: string) => unknown, status = 200) {
  return spyOn(globalThis, 'fetch').mockImplementation((async (url: string, init: RequestInit) => {
    if (url.startsWith('https://id.twitch.tv/'))
      return json({ access_token: 'tok', expires_in: 10_000_000 })
    if (status !== 200) return new Response('nope', { status })
    return json(games(String(init.body)))
  }) as never)
}

test('names lose accents, symbols and case', () => {
  expect(normalizeName('Pokémon™: Édition — Ünïcode®!')).toBe('pokemon edition unicode')
})

test('a catalog entry keeps only aliases a person would type', () => {
  const entry = toCatalog(
    game({
      alternative_names: [
        { name: 'Ghost of Tsushima' },
        { name: 'GoT' },
        { name: '対馬の亡霊' },
        { name: 'ghost.exe' },
        { name: 'C:\\ghost' },
      ],
      platforms: [48, 167, 6],
      cover: { image_id: 'abc' },
      screenshots: [{ image_id: 'shot' }],
      genres: [{ name: 'Adventure' }],
      themes: [{ name: 'Historical' }],
      game_modes: [{ name: 'Single player' }],
      summary: 'Samurai.',
      first_release_date: 1595548800,
      total_rating: 87.6,
      involved_companies: [
        { company: { name: 'Sucker Punch' }, developer: true },
        { company: { name: 'Sony' }, developer: false },
      ],
      websites: [
        { url: 'https://wiki.example/got', type: 2 },
        { url: 'https://suckerpunch.example/got', type: 1 },
      ],
    }),
    ['Ghost of Tsushima Director’s Cut'],
  )
  expect(entry).toEqual({
    id: 1,
    name: 'Ghost of Tsushima',
    slug: 'ghost-of-tsushima',
    aliases: ['GoT', 'Ghost of Tsushima Director’s Cut'],
    platforms: ['PS4', 'PS5'],
    cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/abc.jpg',
    art_url: 'https://images.igdb.com/igdb/image/upload/t_1080p/shot.jpg',
    genres: ['Adventure'],
    themes: ['Historical'],
    modes: ['Single player'],
    summary: 'Samurai.',
    release_year: 2020,
    rating: 88,
    screenshot_ids: ['shot'],
    developers: ['Sucker Punch'],
    website: 'https://suckerpunch.example/got',
    store_url: null,
    released_at: '2020-07-24',
    hypes: 0,
  })
})

test('a bare game has empty lists and null details', () => {
  expect(toCatalog(game())).toMatchObject({
    aliases: [],
    platforms: [],
    cover_url: null,
    summary: null,
    release_year: null,
    rating: null,
    screenshot_ids: [],
    developers: [],
    website: null,
    store_url: null,
    released_at: null,
    hypes: 0,
  })
})

test('a game without screenshots shows its artwork in the gallery', () => {
  expect(media({ artworks: [{ image_id: 'art' }] }).screenshot_ids).toEqual(['art'])
  expect(igdbImage('art', 't_screenshot_big')).toBe(
    'https://images.igdb.com/igdb/image/upload/t_screenshot_big/art.jpg',
  )
})

test('a PSN title resolves to the best matching game with its name kept as an alias', async () => {
  const fetch = igdbApi(() => [
    game({ id: 2, name: 'Ghost Recon' }),
    game({ id: 3, name: 'Ghost of Tsushima Legends' }),
    game({ id: 1, alternative_names: [{ name: 'Tsushima' }] }),
  ])
  const entry = await resolveGame('Ghost of Tsushima™ Trophies')
  expect(entry?.id).toBe(1)
  expect(entry?.aliases).toEqual(['Tsushima', 'Ghost of Tsushima™ Trophies'])
  const call = fetch.mock.calls.find(([url]) => String(url).includes('api.igdb.com'))
  expect(call?.[0]).toBe('https://api.igdb.com/v4/games')
  expect(String(call?.[1]?.body)).toStartWith('search "Ghost of Tsushima";')
  expect(call?.[1]?.headers).toMatchObject({ 'Client-ID': config.igdb.clientId })
})

test('quotes and backslashes in a name cannot escape the search string', async () => {
  const fetch = igdbApi(() => [])
  await resolveGame('Evil \\"; where id = 1; \\')
  const call = fetch.mock.calls.find(([url]) => String(url).includes('api.igdb.com'))
  expect(String(call?.[1]?.body)).toStartWith('search "Evil ; where id = 1;";')
})

test('a store name listing its consoles is searched without them', async () => {
  const fetch = igdbApi(() => [game({ id: 1 })])
  for (const name of [
    'Ghost of Tsushima PS4™ & PS5™',
    'Ghost of Tsushima PS4™ e PS5™',
    'Ghost of Tsushima (PS5)',
  ]) {
    await resolveGame(name)
    const call = fetch.mock.calls.filter(([url]) => String(url).includes('api.igdb.com')).at(-1)
    expect(String(call?.[1]?.body)).toStartWith('search "Ghost of Tsushima";')
  }
})

test('partial name matches rank above unrelated results', async () => {
  igdbApi(() => [game({ id: 4, name: 'Other' }), game({ id: 5, name: 'Astro Bot Rescue' })])
  expect((await resolveGame('Astro Bot'))?.id).toBe(5)
  igdbApi(() => [game({ id: 4, name: 'Other' }), game({ id: 6, name: 'The Astro Bot Story' })])
  expect((await resolveGame('Astro Bot'))?.id).toBe(6)
})

test('an edition resolves to its original game, keeping both names', async () => {
  igdbApi((body) =>
    body.startsWith('search')
      ? [game({ id: 10, name: 'Ghost DC', game_type: 10, parent_game: 1 })]
      : [game({ id: 1 })],
  )
  const entry = await resolveGame('Ghost DC')
  expect(entry?.id).toBe(1)
  expect(entry?.aliases).toEqual(['Ghost DC'])
})

test('between games with the same name, the PS4/PS5 one wins, then the newest', async () => {
  igdbApi(() => [
    game({ id: 20, name: 'Remake Exemplo', platforms: [9], first_release_date: 1_100_000_000 }),
    game({
      id: 21,
      name: 'Remake Exemplo',
      platforms: [48, 167],
      first_release_date: 1_600_000_000,
    }),
    game({ id: 22, name: 'Remake Exemplo', platforms: [48], first_release_date: 1_400_000_000 }),
  ])
  expect((await resolveGame('Remake Exemplo'))?.id).toBe(21)
})

test("a match on the game's own name beats one on an alternative name", async () => {
  igdbApi(() => [
    game({
      id: 31,
      name: 'Saga Exemplo Ragnarök',
      alternative_names: [{ name: 'Saga Exemplo Рагнарёк' }],
      platforms: [48, 167],
      first_release_date: 1_700_000_000,
    }),
    game({ id: 30, name: 'Saga Exemplo', platforms: [48], first_release_date: 1_500_000_000 }),
  ])
  expect((await resolveGame('Saga Exemplo'))?.id).toBe(30)
})

test("a store edition resolves to the game's own name, keeping the edition as an alias", async () => {
  const fetch = igdbApi((body) =>
    body.startsWith('search "Ghost of Tsushima"')
      ? [game({ id: 1 })]
      : [game({ id: 40, name: 'Ghost of Tsushima: Deluxe Edition' })],
  )
  const entry = await resolveGame('Ghost of Tsushima: Deluxe Edition')
  expect(entry?.id).toBe(1)
  expect(entry?.aliases).toEqual(['Ghost of Tsushima: Deluxe Edition'])
  const searches = fetch.mock.calls.filter(([url]) => String(url).includes('api.igdb.com'))
  expect(String(searches[0]?.[1]?.body)).toStartWith('search "Ghost of Tsushima";')
})

test('an edition suffix is cut from a name; other names are left alone', () => {
  expect(withoutEdition('Ghost of Tsushima: Deluxe Edition')).toBe('Ghost of Tsushima')
  expect(withoutEdition('Jogo Exemplo – Digital Deluxe Edition')).toBe('Jogo Exemplo')
  expect(withoutEdition('Jogo Exemplo Game of the Year Edition')).toBe('Jogo Exemplo')
  expect(withoutEdition('Ghost of Tsushima')).toBeNull()
  expect(withoutEdition('Deluxe Edition')).toBeNull()
})

test('nothing found resolves to null', async () => {
  igdbApi(() => [])
  expect(await resolveGame('Nope')).toBeNull()
})

test('a main game is its own canonical game', async () => {
  const fetch = igdbApi(() => [])
  const main = game({ game_type: 0, parent_game: 9 })
  expect(await canonical(main)).toBe(main)
  expect(fetch).not.toHaveBeenCalled()
})

test('an edition whose parent is gone stays itself', async () => {
  igdbApi(() => [])
  const remaster = game({ id: 11, game_type: 9, version_parent: 99 })
  expect(await canonical(remaster)).toBe(remaster)
})

test('a PS4/PS5 remaster of a game that never came to them keeps its own record', async () => {
  igdbApi(() => [game({ id: 59, name: 'Clássico Exemplo', platforms: [9] })])
  const remaster = game({ id: 50, game_type: 9, version_parent: 59, platforms: [167] })
  expect(await canonical(remaster)).toBe(remaster)
})

test('a remaster of a game already on PS4/PS5 collapses onto it', async () => {
  igdbApi(() => [game({ id: 60, name: 'Clássico Exemplo', platforms: [48] })])
  const remaster = game({ id: 61, game_type: 9, version_parent: 60, platforms: [167] })
  expect((await canonical(remaster)).id).toBe(60)
})

test('popular games are queried by rating count with paging', async () => {
  const fetch = igdbApi(() => [game()])
  expect(await popularGames(100, 500, 50)).toEqual([game()])
  const body = String(fetch.mock.calls.at(-1)?.[1]?.body)
  expect(body).toContain('total_rating_count > 100')
  expect(body).toContain('limit 50; offset 500;')
})

test('an IGDB error is raised with its status', async () => {
  igdbApi(() => [], 500)
  await expect(popularGames(1)).rejects.toThrow('igdb games: 500 nope')
})

test('the wide picture prefers a screenshot, then artwork', () => {
  const url = (id: string) => `https://images.igdb.com/igdb/image/upload/t_1080p/${id}.jpg`
  expect(artUrl({ artworks: [{ image_id: 'art' }], screenshots: [{ image_id: 'shot' }] })).toBe(
    url('shot'),
  )
  expect(artUrl({ artworks: [{ image_id: 'art' }] })).toBe(url('art'))
  expect(artUrl({})).toBeNull()
})
