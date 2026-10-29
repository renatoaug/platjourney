// The guide browser: every game with a guide, or every catalog game matching a search, filtered by
// platform, sorted and paged. Catalog and guides change a few times a day at most, so both are read
// once and kept for a few minutes.
import { type CatalogCard, catalogCards, matchCatalog } from './repository/game.ts'
import { type GuideSummary, guideSummaries } from './repository/guide.ts'

export const SORTS = ['rating', 'name', 'easiest', 'shortest'] as const
export type Sort = (typeof SORTS)[number]
export const PLATFORMS = ['PS5', 'PS4', 'PS3', 'PS Vita'] as const
export const PAGE_SIZE = 24
// The difficulty bands, each its own range of the guide's 1 to 10.
export const BANDS = { easy: [1, 3], medium: [4, 5], hard: [6, 7], brutal: [8, 10] } as const
const inBand = (d: number, [lo, hi]: readonly [number, number]) => d >= lo && d <= hi
export type BandKey = keyof typeof BANDS
export const HOURS = [10, 25, 50, 100] as const
// Genres listed in the filter, most common first.
const GENRES_SHOWN = 12

export interface BrowseItem extends CatalogCard {
  guide: Omit<GuideSummary, 'game'> | null
}
export interface Facets {
  difficulty: Record<BandKey, number>
  hours: Record<string, number>
  noMissables: number
  onePlaythrough: number
  noOnline: number
  genres: { name: string; count: number }[]
}
export interface BrowsePage {
  page: number
  size: number
  total: number
  items: BrowseItem[]
  /** How many games each filter would leave, with the other filters applied. */
  facets: Facets
  /** Covers of the best rated games with a guide, the same whatever the filters: the page's top. */
  collage: string[]
}

// Covers in the top's collage.
const COLLAGE = 14
// Covers on the sign-in screen's wall.
const SHOWCASE = 36

export interface BrowseFilters {
  difficulty?: string
  hours?: string
  noMissables?: boolean
  onePlaythrough?: boolean
  noOnline?: boolean
  genre?: string
}

type Check = (i: BrowseItem) => boolean
/** Each filter as a check; a filter about the guide leaves out games without one. */
function checks(f: BrowseFilters): Record<keyof BrowseFilters, Check | null> {
  const band = f.difficulty && f.difficulty in BANDS ? BANDS[f.difficulty as BandKey] : null
  const hours = HOURS.find((h) => String(h) === f.hours) ?? null
  return {
    difficulty: band ? (i) => !!i.guide && inBand(i.guide.difficulty, band) : null,
    hours: hours ? (i) => !!i.guide && i.guide.hours > 0 && i.guide.hours <= hours : null,
    noMissables: f.noMissables ? (i) => !!i.guide && !i.guide.hasMissables : null,
    onePlaythrough: f.onePlaythrough ? (i) => !!i.guide && i.guide.playthroughs === 1 : null,
    noOnline: f.noOnline ? (i) => !!i.guide && !i.guide.hasOnline : null,
    genre: f.genre ? (i) => (i.genres ?? []).includes(f.genre as string) : null,
  }
}

const passes = (i: BrowseItem, all: Record<string, Check | null>, except?: string) =>
  Object.entries(all).every(([k, c]) => k === except || !c || c(i))

function facetsOf(items: BrowseItem[], f: BrowseFilters): Facets {
  const all = checks(f)
  const without = (k: keyof BrowseFilters) => items.filter((i) => passes(i, all, k))
  const count = (list: BrowseItem[], c: Check) => list.reduce((n, i) => n + (c(i) ? 1 : 0), 0)
  const byBand = without('difficulty')
  const byHours = without('hours')
  const genres = new Map<string, number>()
  for (const i of without('genre'))
    for (const g of i.genres ?? []) genres.set(g, (genres.get(g) ?? 0) + 1)
  return {
    difficulty: Object.fromEntries(
      Object.entries(BANDS).map(([k, range]) => [
        k,
        count(byBand, (i) => !!i.guide && inBand(i.guide.difficulty, range)),
      ]),
    ) as Record<BandKey, number>,
    hours: Object.fromEntries(
      HOURS.map((h) => [
        String(h),
        count(byHours, (i) => !!i.guide && i.guide.hours > 0 && i.guide.hours <= h),
      ]),
    ),
    noMissables: count(without('noMissables'), (i) => !!i.guide && !i.guide.hasMissables),
    onePlaythrough: count(
      without('onePlaythrough'),
      (i) => !!i.guide && i.guide.playthroughs === 1,
    ),
    noOnline: count(without('noOnline'), (i) => !!i.guide && !i.guide.hasOnline),
    genres: [...genres]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, GENRES_SHOWN)
      .map(([name, n]) => ({ name, count: n })),
  }
}

const TTL_MS = 5 * 60_000
let cached: {
  at: number
  cards: Map<string, CatalogCard>
  guides: Map<string, GuideSummary>
} | null = null

async function data() {
  if (cached && Date.now() - cached.at < TTL_MS) return cached
  const [cards, guides] = await Promise.all([catalogCards(), guideSummaries()])
  cached = {
    at: Date.now(),
    cards: new Map(cards.map((c) => [c.id, c])),
    guides: new Map(guides.map((g) => [g.game, g])),
  }
  return cached
}

export function forgetBrowseCache(): void {
  cached = null
}

const byName = (a: BrowseItem, b: BrowseItem) => a.name.localeCompare(b.name)
// Games without a guide, or whose guide does not know them yet (0), go last in those orders.
const ORDERS: Record<Sort, (a: BrowseItem, b: BrowseItem) => number> = {
  rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || byName(a, b),
  name: byName,
  easiest: (a, b) =>
    (a.guide?.difficulty || 99) - (b.guide?.difficulty || 99) ||
    (a.guide?.hours || 1e9) - (b.guide?.hours || 1e9) ||
    byName(a, b),
  shortest: (a, b) =>
    (a.guide?.hours || 1e9) - (b.guide?.hours || 1e9) ||
    (a.guide?.difficulty || 99) - (b.guide?.difficulty || 99) ||
    byName(a, b),
}

export async function browseGuides(
  opts: {
    query?: string
    platform?: string
    sort?: string
    page?: number
  } & BrowseFilters,
): Promise<BrowsePage> {
  const { cards, guides } = await data()
  const query = opts.query?.trim() ?? ''
  // One letter is not a search yet: the list stays as it was.
  const searching = query.length >= 2
  const ids = searching ? await matchCatalog(query) : [...guides.keys()]
  const platform = PLATFORMS.find((p) => p === opts.platform)
  const sort: Sort = SORTS.find((s) => s === opts.sort) ?? (searching ? 'name' : 'rating')
  let items = itemsOf(ids, cards, guides, platform)
  const facets = facetsOf(items, opts)
  const all = checks(opts)
  items = items.filter((i) => passes(i, all))
  // A search keeps its relevance order unless another order was picked; games with a guide first.
  if (!searching || opts.sort) items.sort(ORDERS[sort])
  if (searching) items = [...items.filter((i) => i.guide), ...items.filter((i) => !i.guide)]
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const page = Math.min(pages, Math.max(1, Math.floor(opts.page ?? 1) || 1))
  return {
    page,
    size: PAGE_SIZE,
    total: items.length,
    items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    facets,
    collage: collageOf(cards, guides),
  }
}

/** What the sign-in screen shows before anyone signs in: the covers of the best rated games with a
 * guide and how many guides there are. Nothing about any player. */
export async function showcase(): Promise<{ covers: string[]; guides: number }> {
  const { cards, guides } = await data()
  return { covers: collageOf(cards, guides, SHOWCASE), guides: guides.size }
}

// The catalog cards for these ids, on the platform when one was picked, each with its guide.
function itemsOf(
  ids: string[],
  cards: Map<string, CatalogCard>,
  guides: Map<string, GuideSummary>,
  platform: (typeof PLATFORMS)[number] | undefined,
): BrowseItem[] {
  const items: BrowseItem[] = []
  for (const id of ids) {
    const card = cards.get(id)
    if (!card || (platform && !card.platforms.includes(platform))) continue
    const guide = guides.get(id)
    items.push({ ...card, guide: guide ? withoutGame(guide) : null })
  }
  return items
}

function collageOf(
  cards: Map<string, CatalogCard>,
  guides: Map<string, GuideSummary>,
  size = COLLAGE,
): string[] {
  return [...guides.keys()]
    .map((id) => cards.get(id))
    .filter((c): c is CatalogCard => !!c?.cover_url)
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
    .slice(0, size)
    .map((c) => c.cover_url as string)
}

function withoutGame({ game: _game, ...rest }: GuideSummary): Omit<GuideSummary, 'game'> {
  return rest
}
