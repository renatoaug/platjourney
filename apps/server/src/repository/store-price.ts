import { plain, q } from '../db.ts'
import type { PlusTier, StorePrice } from '../psstore.ts'
import { gameRef } from './game.ts'

export interface StoredPrice extends StorePrice {
  game: string
}

/** The last price read for each of these games. */
export async function pricesFor(games: string[]): Promise<Map<string, StoredPrice>> {
  if (!games.length) return new Map()
  const rows = plain(
    await q<
      {
        game: string
        base: number
        price: number
        discount: number
        ends_at: string | null
        plus: boolean
        plus_price: number | null
        plus_tier: PlusTier | null
        currency: string
      }[]
    >(
      'SELECT game, base, price, discount, ends_at, plus, plus_price, plus_tier, currency FROM store_price WHERE game IN $games',
      {
        games: games.map(gameRef),
      },
    ),
  )
  return new Map(
    rows.map((r) => [
      String(r.game),
      {
        game: String(r.game),
        base: r.base,
        price: r.price,
        discount: r.discount,
        endsAt: r.ends_at ?? null,
        plus: r.plus,
        plusPrice: r.plus_price ?? null,
        plusTier: r.plus_tier ?? null,
        currency: r.currency,
      },
    ]),
  )
}

export async function savePrice(game: string, p: StorePrice): Promise<void> {
  await q(
    `UPSERT store_price SET game = $game, base = $base, price = $price, discount = $discount,
       ends_at = $ends, plus = $plus, plus_price = $plusPrice, plus_tier = $plusTier, currency = $currency WHERE game = $game`,
    {
      game: gameRef(game),
      base: p.base,
      price: p.price,
      discount: p.discount,
      ends: p.endsAt ? new Date(p.endsAt) : undefined,
      plus: p.plus,
      plusPrice: p.plusPrice ?? undefined,
      plusTier: p.plusTier ?? undefined,
      currency: p.currency,
    },
  )
}

/** Every game someone saved in their interests that has a store page, with who saved it and does
 * not own it yet (a game in their PSN library is no deal for them). */
export async function interestsWithStore(): Promise<
  { game: string; name: string; store_url: string; users: string[] }[]
> {
  const saved = plain(
    await q<{ game: string; name: string; store_url: string; users: string[] }[]>(
      `SELECT game, game.name AS name, game.store_url AS store_url, array::group(user) AS users
       FROM interest WHERE game.store_url != NONE GROUP BY game, name, store_url`,
    ),
  )
  const owned = plain(
    await q<{ game: string; users: string[] }[]>(
      'SELECT game, array::group(user) AS users FROM title WHERE game IN $games GROUP BY game',
      { games: saved.map((r) => r.game) },
    ),
  )
  const owners = new Map(owned.map((r) => [String(r.game), new Set(r.users.map(String))]))
  return saved.map((r) => {
    const own = owners.get(String(r.game))
    return {
      ...r,
      game: String(r.game),
      users: r.users.map(String).filter((u) => !own?.has(u)),
    }
  })
}
