/** Beside the interests: the saved games the player can get for less right now. The ones their own
 * PS Plus already includes come first, then the PS Store sales, four at a time. Only shows when there
 * is one. */
import { useState } from 'react'
import { Link } from 'react-router'
import { defineMessages, Language, useLocale, useMessages } from '../../i18n/i18n'
import type { Interest } from '../../lib/types'
import { Cover } from '../../ui/cover'
import { Icon } from '../../ui/icon'
import { Pager } from '../../ui/pager'
import { titleHref } from '../tip'
import './deals-spotlight.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'MAIS BARATO AGORA',
    title: {
      one: '{count} jogo dos seus interesses sai por menos',
      other: '{count} jogos dos seus interesses saem por menos',
    },
    until: 'até {date}',
    plus: '{price} no PS Plus',
    mine: 'No seu PS Plus {tier}',
    free: 'Jogue sem pagar',
    plusBadge: 'PS Plus',
    store: 'Ver na PS Store',
    pages: 'Páginas de promoções',
    owned: 'Já tenho',
    ownedHint: 'Já tenho {name}: tirar das promoções',
  },
  [Language.En]: {
    eyebrow: 'CHEAPER NOW',
    title: {
      one: '{count} game in your interests costs less',
      other: '{count} games in your interests cost less',
    },
    until: 'until {date}',
    plus: '{price} with PS Plus',
    mine: 'In your PS Plus {tier}',
    free: 'Play at no cost',
    plusBadge: 'PS Plus',
    store: 'See on PS Store',
    pages: 'Deal pages',
    owned: 'I own it',
    ownedHint: 'I already own {name}: hide it from deals',
  },
})

const PAGE = 4
const TIER_NAMES = { essential: 'Essential', extra: 'Extra', deluxe: 'Deluxe' } as const

/** The saved games that cost less now: the player's own PS Plus ones first, then the deepest sales. */
function onSale(interests: Interest[]) {
  return interests
    .filter((i) => !i.done && i.deal && (i.deal.mine || i.deal.discount > 0))
    .sort(
      (a, b) =>
        Number(!!b.deal?.mine) - Number(!!a.deal?.mine) ||
        (b.deal?.discount ?? 0) - (a.deal?.discount ?? 0),
    )
}

/** One saved game on sale: its cover with the discount, the price and the store link. */
function DealCard({
  interest: i,
  onOwned,
}: {
  interest: Interest
  onOwned?: (i: Interest) => void
}) {
  const t = useMessages(messages)
  const locale = useLocale()
  const money = (cents: number, currency: string) =>
    (cents / 100).toLocaleString(locale, { style: 'currency', currency })
  const d = i.deal as NonNullable<Interest['deal']>
  const mine = !!d.mine
  return (
    <article className={`deal${mine ? ' mine' : ''}`}>
      <Link className="deal-game" to={titleHref(i.game.id)}>
        <Cover url={i.game.cover_url} name={i.game.name} className="deal-cover" />
        <span className="deal-off">{mine ? t('plusBadge') : `-${d.discount}%`}</span>
      </Link>
      <div className="deal-body">
        <Link className="deal-name" to={titleHref(i.game.id)}>
          {i.game.name}
        </Link>
        {mine ? (
          <span className="deal-price">
            <b>{t('mine', { tier: TIER_NAMES[d.plusTier ?? 'extra'] })}</b>
            <span className="deal-plus">{t('free')}</span>
          </span>
        ) : (
          <span className="deal-price">
            <b>{money(d.price, d.currency)}</b> <s>{money(d.base, d.currency)}</s>
          </span>
        )}
        {/* The end of the sale and the store link share a line. */}
        <div className="deal-meta">
          {!mine && (d.endsAt || d.plusPrice) ? (
            <span className="deal-until">
              {d.endsAt &&
                t('until', {
                  date: new Date(d.endsAt).toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'short',
                  }),
                })}
              {d.endsAt && d.plusPrice ? ' · ' : null}
              {d.plusPrice ? t('plus', { price: money(d.plusPrice, d.currency) }) : null}
            </span>
          ) : null}
          {d.storeUrl && (
            <a
              className="text-link deal-store"
              href={d.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('store')} <Icon name="arrow" />
            </a>
          )}
          {/* Bought or claimed but never started: PSN does not list it, so the player says so. */}
          {onOwned && (
            <button
              type="button"
              className="text-link deal-owned"
              aria-label={t('ownedHint', { name: i.game.name })}
              onClick={() => onOwned(i)}
            >
              {t('owned')}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export function DealsSpotlight({
  interests,
  onOwned,
}: {
  interests: Interest[]
  onOwned?: (i: Interest) => void
}) {
  const t = useMessages(messages)
  const [page, setPage] = useState(1)
  const shown = onSale(interests)
  if (!shown.length) return null
  const pages = Math.ceil(shown.length / PAGE)
  const at = Math.min(page, pages)
  return (
    <section className="deals" aria-labelledby="deals-title">
      {/* One slim line on top: the label and the count, with the pages on the right. */}
      <div className="deals-head">
        <span className="eyebrow">
          <Icon name="tag" /> {t('eyebrow')}
        </span>
        <h3 id="deals-title">{t('title', { count: shown.length })}</h3>
        {pages > 1 && (
          <Pager page={at} size={PAGE} total={shown.length} onPage={setPage} label={t('pages')} />
        )}
      </div>
      <div className="deals-row">
        {shown.slice((at - 1) * PAGE, at * PAGE).map((i) => (
          <DealCard key={i.id} interest={i} onOwned={onOwned} />
        ))}
      </div>
    </section>
  )
}
