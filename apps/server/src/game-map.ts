/** A game's interactive map: its points (what to collect, where) and the picture under them, cut
 * in tiles. Both come from a folder per game (config.mapsDir); the app holds no game's data. */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from './config.ts'

export interface MapCategory {
  id: string
  /** The name in each language the app speaks. */
  name: Record<string, string>
  /** An icon of the app's sprite. */
  icon: string
}

export interface MapPoint {
  id: string
  category: string
  lng: number
  lat: number
  title?: string
  /** How to get there, in each language the app speaks (or one text for all). */
  detail?: string | Record<string, string>
  /** Placed on its district, not on its spot. */
  approx?: boolean
}

export interface GameMap {
  /** The look under the tiles where the picture ends: the sea, the paper of an old map, or the
   * app's own night for a map drawn in its colors. */
  background: 'water' | 'paper' | 'dark'
  minZoom: number
  maxZoom: number
  /** Changes whenever the tiles are cut again, so browsers never mix in the ones they kept. */
  version?: number
  /** The deepest zoom the tiles have; past it the map enlarges the last ones. */
  tileMaxZoom: number
  center: [number, number]
  /** The whole world [west, south, east, north]: the map opens fitting it on any screen. */
  bounds?: [number, number, number, number]
  zoom: number
  /** The credit the map's license asks for; empty when it asks none (public domain). */
  attribution: string
  /** Where the tiles load from when the maps are published apart; else the app's own route. */
  tiles?: string
  categories: MapCategory[]
  points: MapPoint[]
}

/** The catalog's number of a game (game:25076 -> 25076), or null for anything else. */
const gameNumber = (game: string) => /^game:(\d{1,12})$/.exec(game)?.[1] ?? null

// A published map is read again after this long: an update shows up within minutes.
const PUBLISHED_TTL_MS = 5 * 60_000
const published = new Map<string, { at: number; map: GameMap | null }>()

/** A published map, read again after a few minutes; a failed read keeps the last good one. */
async function publishedMap(base: string, n: string): Promise<GameMap | null> {
  const kept = published.get(n)
  if (kept && Date.now() - kept.at < PUBLISHED_TTL_MS) return kept.map
  const res = await fetch(`${base}/${n}/map.json`).catch(() => null)
  // A game without a map (404) is remembered too, so it is not asked for on every visit.
  if (!res || (!res.ok && res.status !== 404)) return kept?.map ?? null
  const read = res.ok ? ((await res.json()) as GameMap) : null
  // The version in the address: a map cut again is never mixed with tiles a browser kept.
  const map = read
    ? { ...read, tiles: `${base}/${n}/tiles/{z}/{x}/{y}.webp?v=${read.version ?? 1}` }
    : null
  published.set(n, { at: Date.now(), map })
  return map
}

export async function gameMap(game: string): Promise<GameMap | null> {
  const n = gameNumber(game)
  if (!n) return null
  if (config.mapsUrl) return publishedMap(config.mapsUrl, n)
  if (!config.mapsDir) return null
  try {
    return JSON.parse(await readFile(join(config.mapsDir, n, 'map.json'), 'utf8')) as GameMap
  } catch {
    return null
  }
}

/** For tests: forgets the published maps read. */
export const forgetPublishedMaps = () => published.clear()

/** One tile of a game's map, or null when the map or that tile does not exist. */
export async function mapTile(
  game: string,
  z: number,
  x: number,
  y: number,
): Promise<Buffer | null> {
  const n = gameNumber(game)
  const valid = [z, x, y].every((v) => Number.isInteger(v) && v >= 0) && z <= 12
  if (!config.mapsDir || !n || !valid) return null
  try {
    return await readFile(join(config.mapsDir, n, 'tiles', String(z), String(x), `${y}.webp`))
  } catch {
    return null
  }
}
