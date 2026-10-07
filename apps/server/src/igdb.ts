import { config } from './config.ts'

// IGDB (Twitch) is the game catalog: identity, cover art and metadata for every
// PlayStation title, including the ones the player does not own.

const PLATFORMS: Record<number, string> = { 48: 'PS4', 167: 'PS5', 9: 'PS3', 46: 'PS Vita' }
const PS_PLATFORM_IDS = Object.keys(PLATFORMS).map(Number)
// game_type: 0 main, 1 dlc, 2 expansion, 3 bundle, 4 standalone expansion, 5 mod,
// 6 episode, 7 season, 8 remake, 9 remaster, 10 expanded, 11 port, 12 fork, 13 pack, 14 update.
const EDITION_TYPES = new Set([3, 9, 10, 11, 14])
const MAIN_TYPES = new Set([0, 3, 4, 8, 9, 10, 11, 14])

export interface IgdbGame {
  id: number
  name: string
  slug: string
  game_type: number
  parent_game?: number
  version_parent?: number
  platforms?: number[]
  alternative_names?: { name: string }[]
  cover?: { image_id: string }
  artworks?: { image_id: string }[]
  screenshots?: { image_id: string }[]
  genres?: { name: string }[]
  themes?: { name: string }[]
  game_modes?: { name: string }[]
  summary?: string
  first_release_date?: number
  total_rating?: number
  total_rating_count?: number
}

const FIELDS =
  'name,slug,game_type,parent_game,version_parent,platforms,alternative_names.name,cover.image_id,artworks.image_id,screenshots.image_id,genres.name,themes.name,game_modes.name,summary,first_release_date,total_rating,total_rating_count'

let token: { value: string; expiresAt: number } | null = null
let lastCall = 0

async function accessToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt - 60_000) return token.value
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${config.igdb.clientId}&client_secret=${config.igdb.clientSecret}&grant_type=client_credentials`,
    { method: 'POST' },
  )
  const data = (await res.json()) as { access_token: string; expires_in: number }
  token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return token.value
}

// IGDB allows 4 requests/second; space calls out instead of retrying on 429.
async function igdb<T>(endpoint: string, body: string): Promise<T> {
  const wait = 260 - (Date.now() - lastCall)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: { 'Client-ID': config.igdb.clientId, Authorization: `Bearer ${await accessToken()}` },
    body,
  })
  if (!res.ok) throw new Error(`igdb ${endpoint}: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

const coverUrl = (imageId?: string) =>
  imageId ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg` : null
// A screenshot is always a 16:9 scene of the game; artwork varies (logos, thin banners, posters),
// so it is only the fallback.
export const artUrl = (game: Pick<IgdbGame, 'artworks' | 'screenshots'>) => {
  const id = game.screenshots?.[0]?.image_id ?? game.artworks?.[0]?.image_id
  return id ? `https://images.igdb.com/igdb/image/upload/t_1080p/${id}.jpg` : null
}

export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function gameById(id: number): Promise<IgdbGame | null> {
  const rows = await igdb<IgdbGame[]>('games', `fields ${FIELDS}; where id = ${id};`)
  return rows[0] ?? null
}

// Searches PlayStation games and picks the best match for a PSN title name.
// PSN names carry noise IGDB does not know: "™ Trophies" suffixes, glued symbols.
function cleanPsnName(name: string): string {
  return (
    name
      .replace(/[®™©]/g, ' ')
      .replace(/\s+trophies$/i, '')
      // Quotes and backslashes would end or escape the search string in the query.
      .replace(/["\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

async function searchGame(name: string): Promise<IgdbGame | null> {
  const clean = cleanPsnName(name)
  const rows = await igdb<IgdbGame[]>(
    'games',
    `search "${clean}"; fields ${FIELDS}; where platforms = (${PS_PLATFORM_IDS.join(',')}) & game_type = (${[...MAIN_TYPES].join(',')}); limit 8;`,
  )
  if (rows.length === 0) return null
  const wanted = normalizeName(clean)
  const score = (g: IgdbGame) => {
    const names = [g.name, ...(g.alternative_names ?? []).map((a) => a.name)].map(normalizeName)
    if (names.includes(wanted)) return 3
    if (names.some((n) => n.startsWith(wanted) || wanted.startsWith(n))) return 2
    if (names.some((n) => n.includes(wanted) || wanted.includes(n))) return 1
    return 0
  }
  return [...rows].sort((a, b) => score(b) - score(a))[0]
}

// Editions, remasters and ports collapse onto the original game so the catalog
// has one record per game, whatever the player's PSN copy is called.
export async function canonical(game: IgdbGame): Promise<IgdbGame> {
  const parentId = EDITION_TYPES.has(game.game_type)
    ? (game.parent_game ?? game.version_parent)
    : undefined
  if (!parentId) return game
  const parent = await gameById(parentId)
  return parent ?? game
}

export interface CatalogEntry {
  id: number
  name: string
  slug: string
  aliases: string[]
  platforms: string[]
  cover_url: string | null
  art_url: string | null
  genres: string[]
  themes: string[]
  modes: string[]
  summary: string | null
  release_year: number | null
  rating: number | null
}

// Keep aliases a person would type: latin script, no executables or internal codenames.
const usefulAlias = (a: string) =>
  /^[\x20-\x7e\u00a0-\u024f\u2018\u2019\u201c\u201d\u2013\u2014™®]+$/.test(a) &&
  !/\.exe$/i.test(a) &&
  !/\\/.test(a)

export function toCatalog(game: IgdbGame, extraAliases: string[] = []): CatalogEntry {
  const aliases = new Set(
    [...(game.alternative_names ?? []).map((a) => a.name), ...extraAliases].filter(usefulAlias),
  )
  aliases.delete(game.name)
  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    aliases: [...aliases],
    platforms: (game.platforms ?? []).map((p) => PLATFORMS[p]).filter(Boolean),
    cover_url: coverUrl(game.cover?.image_id),
    art_url: artUrl(game),
    genres: (game.genres ?? []).map((g) => g.name),
    themes: (game.themes ?? []).map((t) => t.name),
    modes: (game.game_modes ?? []).map((m) => m.name),
    summary: game.summary ?? null,
    release_year: game.first_release_date
      ? new Date(game.first_release_date * 1000).getUTCFullYear()
      : null,
    rating: game.total_rating != null ? Math.round(game.total_rating) : null,
  }
}

// Resolves a PSN title (or any name) to its canonical catalog entry, keeping the
// searched name as an alias so later lookups hit without another search.
export async function resolveGame(name: string): Promise<CatalogEntry | null> {
  const hit = await searchGame(name)
  if (!hit) return null
  const main = await canonical(hit)
  const aliases = main.id === hit.id ? [name] : [name, hit.name]
  return toCatalog(main, aliases)
}

// Main PlayStation games with enough ratings to be worth recommending, most rated first.
export async function popularGames(
  minRatings: number,
  offset = 0,
  limit = 500,
): Promise<IgdbGame[]> {
  return igdb<IgdbGame[]>(
    'games',
    `fields ${FIELDS}; where platforms = (48,167) & game_type = 0 & total_rating_count > ${minRatings}; sort total_rating_count desc; limit ${limit}; offset ${offset};`,
  )
}
