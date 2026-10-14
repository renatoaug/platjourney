// Deals on the games in the players' interests: once a day the PlayStation Store price of each one
// is read, kept, and when a game goes on sale (or its sale gets deeper) everyone who saved it hears
// it, under the bell and on Telegram: one notice a day per player, listing every game that changed.
import { isDemo } from './demo.ts'
import { defineMessages, Language, translator } from './i18n.ts'
import { type StorePrice, storePrice, tierCovers } from './psstore.ts'
import { logTip } from './repository/activity.ts'
import { interestsWithStore, pricesFor, savePrice } from './repository/store-price.ts'
import { getUser } from './repository/user.ts'
import { sendMessage } from './telegram.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    sale: '**{name}** está com {discount}% de desconto na PS Store: {price}{until}. Está nos seus interesses.',
    plus: '**{name}** entrou no catálogo do seu PS Plus {tier}: dá para jogar sem pagar. Está nos seus interesses.',
    until: ' até {date}',
    digest: '{count} jogos dos seus interesses estão mais baratos na PS Store:',
    saleLine: '• **{name}**: {discount}% off, {price}{until}',
    plusLine: '• **{name}**: no seu PS Plus {tier}, sem pagar',
  },
  [Language.En]: {
    sale: '**{name}** is {discount}% off on the PS Store: {price}{until}. It is in your interests.',
    plus: '**{name}** joined your PS Plus {tier} catalog: you can play it at no cost. It is in your interests.',
    until: ' until {date}',
    digest: '{count} games in your interests cost less on the PS Store:',
    saleLine: '• **{name}**: {discount}% off, {price}{until}',
    plusLine: '• **{name}**: in your PS Plus {tier}, at no cost',
  },
})

const DAY = 86_400_000
// Spaced out, so the store sees a person's pace, not a crawler's.
const PAUSE_MS = 2_000

export const money = (cents: number, currency: string, locale: string) =>
  (cents / 100).toLocaleString(locale, { style: 'currency', currency })

/** A sale worth telling: the game was at full price before, or now costs less than it did. */
export function newSale(before: StorePrice | undefined, now: StorePrice): boolean {
  if (now.price >= now.base) return false
  return !before || before.price >= before.base || now.price < before.price
}

/** A game that just joined a PS Plus catalog. */
export const joinedPlus = (before: StorePrice | undefined, now: StorePrice) =>
  now.plus && !before?.plus

const TIER_NAMES = { essential: 'Essential', extra: 'Extra', deluxe: 'Deluxe' } as const

type News = { g: { game: string; name: string }; p: StorePrice; sale: boolean; plus: boolean }

/** Reads every saved game's price; answers how many went on sale. */
export async function checkDeals(pause = PAUSE_MS): Promise<number> {
  const games = await interestsWithStore()
  const before = await pricesFor(games.map((g) => g.game))
  let sales = 0
  // Everything a player should hear today, sent at the end as one notice.
  const news = new Map<string, News[]>()
  for (const g of games) {
    const now = await storePrice(g.store_url).catch(() => null)
    if (now) {
      await savePrice(g.game, now)
      const sale = newSale(before.get(g.game), now)
      const plus = joinedPlus(before.get(g.game), now)
      if (sale) sales++
      if (sale || plus)
        for (const id of g.users) news.set(id, [...(news.get(id) ?? []), { g, p: now, sale, plus }])
    }
    if (pause) await new Promise((r) => setTimeout(r, pause))
  }
  for (const [id, items] of news) await tell(id, items)
  return sales
}

/** One player's news of the day: a single game reads as a sentence; several, as one list. */
async function tell(userId: string, items: News[]) {
  const user = await getUser(userId)
  // The demo is read-only and shared: nothing new reaches its bell.
  if (!user || isDemo(user)) return
  const t = translator(messages, user)
  const locale = user.locale ?? Language.PtBR
  const until = (p: StorePrice) =>
    p.endsAt
      ? t('until', {
          // The month in full: an abbreviated one ends in a dot, right before the sentence's own.
          date: new Date(p.endsAt).toLocaleDateString(locale, { day: 'numeric', month: 'long' }),
        })
      : ''
  const told = items.flatMap(({ g, p, sale, plus }) => {
    // In the player's own PS Plus catalog, the price no longer matters to them.
    const tier = plus && p.plusTier && tierCovers(user.ps_plus, p.plusTier) ? p.plusTier : null
    if (tier) {
      const vars = { name: g.name, tier: TIER_NAMES[tier] }
      return [{ game: g.game, one: t('plus', vars), line: t('plusLine', vars) }]
    }
    if (!sale) return []
    const vars = {
      name: g.name,
      discount: p.discount,
      price: money(p.price, p.currency, locale),
      until: until(p),
    }
    return [{ game: g.game, one: t('sale', vars), line: t('saleLine', vars) }]
  })
  if (!told.length) return
  if (told.length === 1) return say(user, told[0].game, told[0].one)
  const lines = [t('digest', { count: told.length }), ...told.map((x) => x.line)]
  await say(user, undefined, lines.join('\n'))
}

async function say(
  user: { id: string; telegram_chat_id?: string | null },
  game: string | undefined,
  text: string,
) {
  await logTip(user.id, 'deal', text, game)
  if (user.telegram_chat_id)
    await sendMessage(user.telegram_chat_id, text).catch((e) =>
      console.warn('deal telegram failed:', (e as Error).message.slice(0, 80)),
    )
}

/** Runs it a few minutes after start and every day after. */
export function startDeals(): void {
  const run = () =>
    checkDeals()
      .then((n) => console.log(`deals: ${n} new sales`))
      .catch((e) => console.error('deals check failed:', e.message))
  setTimeout(run, 5 * 60_000).unref()
  setInterval(run, DAY).unref()
}
