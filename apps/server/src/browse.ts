// The guide browser: every game with a guide, or every catalog game matching a search, filtered by
// platform, sorted and paged. Catalog and guides change a few times a day at most, so both are read
// once and kept for a few minutes.
import { type CatalogCard, catalogCards, matchCatalog } from './repository/game.ts'
import { type GuideSummary, guideSummaries } from './repository/guide.ts'

export const SORTS = ['rating', 'name', 'easiest', 'shortest'] as const
export type Sort = (typeof SORTS)[number]
export const PLATFORMS = ['PS5', 'PS4', 'PS3', 'PS Vita'] as const
export const PAGE_SIZE = 24

export interface BrowseItem extends CatalogCard {
  guide: Omit<GuideSummary, 'game'> | null
}
export interface BrowsePage {
  page: number
  size: number
  total: number
  items: BrowseItem[]
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
// Games without a guide have no difficulty or hours; they go last in those orders.
const ORDERS: Record<Sort, (a: BrowseItem, b: BrowseItem) => number> = {
  rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || byName(a, b),
  name: byName,
  easiest: (a, b) =>
    (a.guide?.difficulty ?? 99) - (b.guide?.difficulty ?? 99) ||
    (a.guide?.hours ?? 1e9) - (b.guide?.hours ?? 1e9) ||
    byName(a, b),
  shortest: (a, b) =>
    (a.guide?.hours ?? 1e9) - (b.guide?.hours ?? 1e9) ||
    (a.guide?.difficulty ?? 99) - (b.guide?.difficulty ?? 99) ||
    byName(a, b),
}

export async function browseGuides(opts: {
  query?: string
  platform?: string
  sort?: string
  page?: number
}): Promise<BrowsePage> {
  const { cards, guides } = await data()
  const query = opts.query?.trim() ?? ''
  // One letter is not a search yet: the list stays as it was.
  const searching = query.length >= 2
  const ids = searching ? await matchCatalog(query) : [...guides.keys()]
  const platform = PLATFORMS.find((p) => p === opts.platform)
  const sort: Sort = SORTS.find((s) => s === opts.sort) ?? (searching ? 'name' : 'rating')
  let items: BrowseItem[] = []
  for (const id of ids) {
    const card = cards.get(id)
    if (!card || (platform && !card.platforms.includes(platform))) continue
    const guide = guides.get(id)
    items.push({ ...card, guide: guide ? withoutGame(guide) : null })
  }
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
  }
}

function withoutGame({ game: _game, ...rest }: GuideSummary): Omit<GuideSummary, 'game'> {
  return rest
}
