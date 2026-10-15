// What the PlayStation Store asks for a game in Brazil, read from the game's store page: the price
// of its main edition, the discount and when it ends, and whether PS Plus includes it.

export const PLUS_TIERS = ['essential', 'extra', 'deluxe'] as const
export type PlusTier = (typeof PLUS_TIERS)[number]
const TIER_LABELS: Record<string, PlusTier> = {
  TIER_10: 'essential',
  TIER_20: 'extra',
  TIER_30: 'deluxe',
}

/** Whether a player's tier includes what a game asks (a higher tier has the lower ones' catalog). */
export const tierCovers = (mine: string | null | undefined, needed: PlusTier | null) =>
  !!needed && !!mine && PLUS_TIERS.indexOf(mine as PlusTier) >= PLUS_TIERS.indexOf(needed)

export interface StorePrice {
  /** In cents. */
  base: number
  price: number
  /** Percent off, 0 when not on sale. */
  discount: number
  /** When the discount ends, if the store says. */
  endsAt: string | null
  /** PS Plus members get it at no cost. */
  plus: boolean
  /** What PS Plus members pay when the store gives them a lower price, in cents. */
  plusPrice: number | null
  /** The PS Plus tier whose catalog includes it, when one does. */
  plusTier: PlusTier | null
  currency: string
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'

/** The Brazilian page of a store link from the catalog (any region, concept or product). */
export function brazilianPage(url: string): string | null {
  const m = url.match(
    /store\.playstation\.com\/(?:[a-z]{2}-[a-z]{2}\/)?(concept|product)\/([\w-]+)/i,
  )
  return m ? `https://store.playstation.com/pt-br/${m[1].toLowerCase()}/${m[2]}` : null
}

interface PriceJson {
  basePriceValue?: number
  discountedValue?: number
  displayDiscountText?: string | null
  serviceBranding?: string[]
  endTime?: string | null
  currencyCode?: string
  isFree?: boolean
  isTiedToSubscription?: boolean
  tierLabel?: string | null
}

/** Reads the prices in a store page; the first one sold outright is the main edition. */
export function parseStorePage(html: string): StorePrice | null {
  const prices: PriceJson[] = []
  const marker = '"price":{"__typename":"Price"'
  for (let at = html.indexOf(marker); at >= 0; at = html.indexOf(marker, at + 1)) {
    const json = objectAt(html, at + '"price":'.length)
    if (!json) continue
    try {
      prices.push(JSON.parse(json) as PriceJson)
    } catch {}
  }
  const main = prices.find(
    (p) => p.serviceBranding?.includes('NONE') && !p.isTiedToSubscription && p.basePriceValue,
  )
  if (!main?.basePriceValue) return null
  const base = main.basePriceValue
  const price = main.discountedValue ?? base
  const discount =
    price < base
      ? Number(main.displayDiscountText?.match(/\d+/)?.[0] ?? Math.round((1 - price / base) * 100))
      : 0
  // A members' price for the same edition, below what everyone pays.
  const member = prices.find(
    (p) =>
      p.serviceBranding?.includes('PS_PLUS') &&
      !p.isFree &&
      p.basePriceValue === base &&
      (p.discountedValue ?? base) < price,
  )
  const included = prices.find((p) => p.serviceBranding?.includes('PS_PLUS') && p.isFree)
  return {
    base,
    price,
    discount,
    endsAt: main.endTime ? new Date(Number(main.endTime)).toISOString() : null,
    plus: !!included,
    plusPrice: member?.discountedValue ?? null,
    // A catalog game without a tier named is in the lowest catalog that has games to play.
    plusTier: included ? (TIER_LABELS[included.tierLabel ?? ''] ?? 'extra') : null,
    currency: main.currencyCode ?? 'BRL',
  }
}

/** The JSON object that opens at `start`, counting braces outside strings. */
function objectAt(text: string, start: number): string | null {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (c === '"') i = stringEnd(text, i)
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1)
  }
  return null
}

/** The index of the quote that closes the string opening at `open`, skipping escapes. */
function stringEnd(text: string, open: number): number {
  for (let i = open + 1; i < text.length; i++) {
    if (text[i] === '\\') i++
    else if (text[i] === '"') return i
  }
  return text.length
}

export async function storePrice(url: string): Promise<StorePrice | null> {
  const page = brazilianPage(url)
  if (!page) return null
  const res = await fetch(page, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' } })
  if (!res.ok) return null
  return parseStorePage(await res.text())
}
