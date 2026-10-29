import jpeg from 'jpeg-js'
import { plain, q, rid } from './db.ts'
import { type Game, gameRef } from './repository/game.ts'

// A game's color: the strongest hue of its catalog picture, as a light color the pages tint their
// background and labels with. Read once per picture and kept in game_tint; a new picture is read
// again. The picture comes at a small IGDB size, which is plenty for an average.

const picture = (g: Pick<Game, 'art_url' | 'cover_url'>) => g.art_url ?? g.cover_url ?? null

const small = (url: string) => url.replace(/\/t_[a-z0-9_]+\//, '/t_screenshot_med/')

function hsl(r: number, g: number, b: number): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255]
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === rr
      ? (gg - bb) / d + (gg < bb ? 6 : 0)
      : max === gg
        ? (bb - rr) / d + 2
        : (rr - gg) / d + 4
  return [h * 60, s, l]
}

function hex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** The tint of an RGBA pixel buffer: hues in 24 bins, each pixel weighted by how vivid it is. */
export function tintOf(px: Uint8Array): string {
  const bins = Array.from({ length: 24 }, () => ({ w: 0, h: 0, s: 0 }))
  for (let i = 0; i < px.length; i += 16) {
    const [h, s, l] = hsl(px[i], px[i + 1], px[i + 2])
    if (l < 0.12 || l > 0.9 || s < 0.18) continue
    const w = s * (1 - Math.abs(l - 0.5) * 1.6)
    const bin = bins[Math.floor(h / 15) % 24]
    bin.w += w
    bin.h += h * w
    bin.s += s * w
  }
  const best = bins.reduce((a, b) => (b.w > a.w ? b : a))
  // A grey picture keeps the brand's own hue.
  if (!best.w) return hex(82, 0.6, 0.64)
  return hex(best.h / best.w, Math.min(0.75, Math.max(0.45, best.s / best.w)), 0.64)
}

const reading = new Set<string>()

async function readTint(game: Pick<Game, 'id' | 'name'>, url: string): Promise<void> {
  const res = await fetch(small(url))
  if (!res.ok) throw new Error(`picture ${res.status}`)
  const { data } = jpeg.decode(new Uint8Array(await res.arrayBuffer()), {
    useTArray: true,
    maxMemoryUsageInMB: 64,
  })
  const key = game.id.replace(/^game:/, '')
  await q('UPSERT $id MERGE { game: $game, color: $color, picture: $url } RETURN NONE', {
    id: rid('game_tint', key),
    game: gameRef(game.id),
    color: tintOf(data),
    url,
  })
}

type Tinted = Pick<Game, 'id' | 'name' | 'art_url' | 'cover_url'>

/** Each game's tint by id. Games whose picture has none yet are read in the background and
 * show up tinted on a later load. */
export async function tints(games: Tinted[]): Promise<Map<string, string>> {
  const unique = [...new Map(games.map((g) => [g.id, g])).values()]
  if (!unique.length) return new Map()
  // The color only decorates the page: a failed read sends it without one, and reads nothing new.
  const rows = await q<{ game: string; color: string; picture: string }[]>(
    'SELECT game, color, picture FROM game_tint WHERE game IN $games',
    { games: unique.map((g) => gameRef(g.id)) },
  )
    .then(plain)
    .catch(() => null)
  if (!rows) return new Map()
  const stored = new Map(rows.map((r) => [String(r.game), r]))
  const out = new Map<string, string>()
  for (const game of unique) {
    const url = picture(game)
    const row = stored.get(game.id)
    if (row) out.set(game.id, row.color)
    if (!url || row?.picture === url || reading.has(game.id)) continue
    reading.add(game.id)
    readTint(game, url)
      .catch((e) => console.error(`tint of ${game.name} failed:`, (e as Error).message))
      .finally(() => reading.delete(game.id))
  }
  return out
}

/** The games with their `tint` set, when known. */
export async function withTints<T extends Tinted>(games: T[]): Promise<(T & { tint?: string })[]> {
  const found = await tints(games)
  return games.map((g) => (found.has(g.id) ? { ...g, tint: found.get(g.id) } : g))
}
