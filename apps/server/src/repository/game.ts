import { gameId, one, plain, q, type RecordId } from '../db.ts'
import { type CatalogEntry, normalizeName, resolveGame } from '../igdb.ts'
import type { TitleProgress } from '../psn.ts'

export interface Game {
  id: string // "game:19561"
  name: string
  slug: string
  aliases: string[]
  platforms: string[]
  igdb_id: number | null
  np_communication_ids: string[]
  cover_url: string | null
  art_url?: string | null
  genres: string[]
  themes: string[]
  modes: string[]
  summary: string | null
  release_year: number | null
  rating: number | null
}

export const gameRef = (id: string): RecordId => gameId(id.replace(/^game:/, ''))

export async function getGame(id: string): Promise<Game | undefined> {
  return plain(await one<Game>('SELECT * OMIT embedding FROM $id', { id: gameRef(id) }))
}

async function gameByNp(np: string): Promise<Game | undefined> {
  return plain(
    await one<Game>('SELECT * OMIT embedding FROM game WHERE $np IN np_communication_ids LIMIT 1', {
      np,
    }),
  )
}

// Normalized name and alias → game id for the whole catalog. Built once (the
// catalog has thousands of rows, each with an embedding) and kept up to date by
// the writes below, so resolving a library of hundreds of titles stays cheap.
let names: Map<string, string> | null = null
function remember(g: Pick<Game, 'id' | 'name' | 'aliases'>): void {
  if (!names) return
  for (const n of [g.name, ...g.aliases]) {
    const key = normalizeName(n)
    if (!names.has(key)) names.set(key, g.id)
  }
}
async function nameIndex(): Promise<Map<string, string>> {
  if (names) return names
  const rows = plain(
    await q<Pick<Game, 'id' | 'name' | 'aliases'>[]>('SELECT id, name, aliases FROM game'),
  )
  names = new Map()
  for (const g of rows) remember(g)
  return names
}

// Name lookup against canonical names and aliases, accent/case/symbol-insensitive.
export async function gameByName(name: string): Promise<Game | undefined> {
  const id = (await nameIndex()).get(normalizeName(name))
  return id ? getGame(id) : undefined
}

async function gameBySlug(slug: string): Promise<Game | undefined> {
  return plain(
    await one<Game>('SELECT * OMIT embedding FROM game WHERE slug = $slug LIMIT 1', { slug }),
  )
}

// Another copy of a game already in the catalog (PS3 and Vita lists, a played
// title named slightly differently): remember the new list id and name on it.
async function attach(game: Game, name: string, np?: string): Promise<Game> {
  const aliases = new Set(game.aliases)
  if (name !== game.name) aliases.add(name)
  const nps = new Set([...game.np_communication_ids, ...(np ? [np] : [])])
  await q('UPDATE $id SET aliases = $aliases, np_communication_ids = $nps', {
    id: gameRef(game.id),
    aliases: [...aliases],
    nps: [...nps],
  })
  const updated = { ...game, aliases: [...aliases], np_communication_ids: [...nps] }
  remember(updated)
  return updated
}

export async function upsertFromCatalog(
  entry: CatalogEntry | null,
  name: string,
  np?: string,
  platform?: string,
): Promise<Game> {
  const key = entry ? String(entry.id) : `psn_${np ?? normalizeName(name).replace(/ /g, '_')}`
  const existing = plain(await one<Game>('SELECT * OMIT embedding FROM $id', { id: gameId(key) }))
  const slug = entry?.slug ?? existing?.slug ?? normalizeName(name).replace(/ /g, '-')
  if (!existing) {
    // The slug is unique: a game already holding it is this same game.
    const same = await gameBySlug(slug)
    if (same) return attach(same, name, np)
  }
  const aliases = new Set([...(existing?.aliases ?? []), ...(entry?.aliases ?? [])])
  const canonicalName = entry?.name ?? existing?.name ?? name
  if (name !== canonicalName) aliases.add(name)
  const nps = new Set([...(existing?.np_communication_ids ?? []), ...(np ? [np] : [])])
  const data = {
    name: canonicalName,
    slug,
    aliases: [...aliases],
    platforms: entry?.platforms ?? existing?.platforms ?? (platform ? [platform] : []),
    igdb_id: entry?.id,
    np_communication_ids: [...nps],
    cover_url: entry?.cover_url ?? existing?.cover_url ?? undefined,
    art_url: entry?.art_url ?? existing?.art_url ?? undefined,
    genres: entry?.genres ?? existing?.genres ?? [],
    themes: entry?.themes ?? existing?.themes ?? [],
    modes: entry?.modes ?? existing?.modes ?? [],
    summary: entry?.summary ?? existing?.summary ?? undefined,
    release_year: entry?.release_year ?? existing?.release_year ?? undefined,
    rating: entry?.rating ?? existing?.rating ?? undefined,
  }
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== null && v !== undefined),
  )
  try {
    await q('UPSERT $id MERGE $data RETURN NONE', { id: gameId(key), data: clean })
    const game = (await getGame(key)) as Game
    remember(game)
    return game
  } catch (e) {
    // Two requests resolving the same new game at once: the other one won.
    const same = /already contains/.test((e as Error).message) ? await gameBySlug(slug) : undefined
    if (same) return attach(same, name, np)
    throw e
  }
}

// A PSN title maps to exactly one catalog game; unknown titles are resolved
// through IGDB once and remembered by their np_communication_id.
export async function gameForTitle(title: TitleProgress): Promise<Game> {
  const known = await gameByNp(title.npCommunicationId)
  if (known) return known
  const entry = await resolveGame(title.name).catch(() => null)
  return upsertFromCatalog(entry, title.name, title.npCommunicationId, title.platform)
}

// Many titles at once: one query for everything already in the catalog. Unknown
// titles go through IGDB, or, with `viaIgdb` off, are matched by name only and
// left out when nothing matches (for features that only compare against the
// catalog, where a game IGDB would have to look up cannot be a match anyway).
// Keyed by np_communication_id.
export async function gamesForTitles(
  titles: TitleProgress[],
  viaIgdb = true,
): Promise<Map<string, Game>> {
  const out = new Map<string, Game>()
  if (titles.length === 0) return out
  const rows = plain(
    await q<Game[]>(
      'SELECT * OMIT embedding FROM game WHERE np_communication_ids CONTAINSANY $nps',
      { nps: titles.map((t) => t.npCommunicationId) },
    ),
  )
  for (const g of rows) for (const np of g.np_communication_ids) out.set(np, g)
  for (const t of titles) {
    if (out.has(t.npCommunicationId)) continue
    const game = viaIgdb ? await gameForTitle(t) : await gameByName(t.name)
    if (game) out.set(t.npCommunicationId, game)
  }
  return out
}

export async function gameForName(name: string, platform?: string): Promise<Game> {
  const known = await gameByName(name)
  if (known) return known
  const entry = await resolveGame(name).catch(() => null)
  return upsertFromCatalog(entry, name, undefined, platform)
}

// Search only existing catalog records; never create a game from free text.
// Every catalog game whose name or alias has all the words of the query, exact and prefix matches
// first; empty for less than two characters.
export async function matchCatalog(query: string): Promise<string[]> {
  const needle = normalizeName(query.slice(0, 100))
  if (needle.length < 2) return []
  const matches = [...(await nameIndex())]
    .filter(([name]) => needle.split(' ').every((word) => name.includes(word)))
    .sort(
      ([a], [b]) =>
        Number(b === needle) - Number(a === needle) ||
        Number(b.startsWith(needle)) - Number(a.startsWith(needle)) ||
        a.localeCompare(b),
    )
  return [...new Set(matches.map(([, id]) => id))]
}

export async function searchCatalog(query: string): Promise<Game[]> {
  const ids = (await matchCatalog(query)).slice(0, 8)
  const games = await Promise.all(ids.map(getGame))
  return games.filter((g): g is Game => Boolean(g))
}

export type CatalogCard = Pick<
  Game,
  'id' | 'name' | 'cover_url' | 'platforms' | 'release_year' | 'rating'
>

// What a list of games shows, for the whole catalog: a few fields per game, no embedding.
export async function catalogCards(): Promise<CatalogCard[]> {
  return plain(
    await q<CatalogCard[]>('SELECT id, name, cover_url, platforms, release_year, rating FROM game'),
  )
}
