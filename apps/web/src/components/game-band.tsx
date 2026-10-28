/** Game cards in a paged grid: the one card style of every recommendation list (Nexo's picks, games
 * like the player's, short platinums, the same series, a game's similar games). A card has the cover
 * (with an optional tag and actions over it), the name, the facts as icons, the difficulty and a
 * short reason. The section has one slim head line (eyebrow and title on the left, the pages on the
 * right) and six cards a page. */

import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { fmtPlayTime } from '../lib/format'
import type { Game } from '../lib/types'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { Pager } from '../ui/pager'
import { repeat, Sk } from '../ui/skeleton'
import { DifficultyMeter } from './difficulty-meter'
import { titleHref } from './tip'
import './game-band.css'

const messages = defineMessages({
  [Language.PtBR]: {
    hours: '~{time}',
    hoursTitle: 'Tempo estimado para a platina',
    runs: {
      one: '{count} jogada',
      other: '{count} jogadas',
    },
    missables: 'Há troféus perdíveis',
    online: 'Há troféus online',
    difficultyTrophy: 'Há troféu que exige jogar em uma dificuldade específica',
    pages: 'Páginas de {title}',
  },
  [Language.En]: {
    hours: '~{time}',
    hoursTitle: 'Estimated time to platinum',
    runs: {
      one: '{count} playthrough',
      other: '{count} playthroughs',
    },
    missables: 'Has missable trophies',
    online: 'Has online trophies',
    difficultyTrophy: 'A trophy requires playing on a specific difficulty',
    pages: '{title} pages',
  },
})

/** Cards a page: one row at desktop width, two or three rows on smaller screens. */
const SHELF_PAGE = 6

export interface CardItem {
  game: Game
  difficulty: number
  hours: number
  playthroughs?: number | null
  hasMissables?: boolean
  hasOnline?: boolean
  hasDifficultyTrophy?: boolean | null
  /** A word over the cover, like "Expansão". */
  tag?: string
  /** A short muted line at the end of the card. */
  reason?: ReactNode
  /** The reason's full text, for the tooltip when it is clamped. */
  reasonTitle?: string
  /** How many lines the reason keeps (2 by default). */
  reasonLines?: 2 | 3
}

/** One fact as an icon, named for screen readers and in the tooltip. */
function CardFact({
  icon,
  label,
  children,
}: {
  icon: string
  label: string
  children?: ReactNode
}) {
  return (
    <span className="band-fact" role="img" aria-label={label} data-tip={label}>
      <Icon name={icon} />
      {children}
    </span>
  )
}

/** What is known and true about the platinum: time, playthroughs, missables, online, a difficulty
 * trophy. Unknown facts are left out. */
function CardFacts({ item }: { item: CardItem }) {
  const t = useMessages(messages)
  const runs = item.playthroughs
  return (
    <span className="band-meta">
      {item.hours > 0 && (
        <span title={t('hoursTitle')}>
          <Icon name="clock" /> {t('hours', { time: fmtPlayTime(item.hours) })}
        </span>
      )}
      {runs && Number.isInteger(runs) && runs > 0 ? (
        <CardFact icon="refresh" label={t('runs', { count: runs })}>
          {runs}
        </CardFact>
      ) : null}
      {item.hasMissables && <CardFact icon="warning" label={t('missables')} />}
      {item.hasOnline && <CardFact icon="globe" label={t('online')} />}
      {item.hasDifficultyTrophy && <CardFact icon="trophy" label={t('difficultyTrophy')} />}
    </span>
  )
}

/** A game card. The difficulty sits on the cover's bottom, `actions` over its corner, outside the
 * links. `meta` takes the place of the usual facts line (the library's own facts). The name, facts
 * and reason stay under the cover; `progress` is pinned to the bottom, so it lines up across a row
 * whatever the names take. */
export function GameCard({
  item,
  actions,
  meta,
  progress,
}: {
  item: CardItem
  actions?: ReactNode
  meta?: ReactNode
  progress?: ReactNode
}) {
  const { game } = item
  const href = titleHref(game.id)
  return (
    <article className="band-card">
      <div className="band-art">
        {/* The cover repeats the body's link for the pointer; readers and the keyboard use the body. */}
        <Link className="band-cover-link" to={href} aria-hidden="true" tabIndex={-1}>
          <Cover url={game.cover_url} name={game.name} className="band-cover" />
        </Link>
        {item.tag && <span className="band-tag">{item.tag}</span>}
        {/* The difficulty on the bottom of the cover, as on the Guides tiles. */}
        {item.difficulty > 0 && (
          <span className="band-score">
            <DifficultyMeter value={item.difficulty} />
          </span>
        )}
      </div>
      {actions && <span className="band-actions">{actions}</span>}
      <Link className="band-body" to={href}>
        <b className="band-name">{game.name}</b>
        {meta ?? <CardFacts item={item} />}
        {item.reason && (
          <span className={`band-reason lines-${item.reasonLines ?? 2}`} title={item.reasonTitle}>
            {item.reason}
          </span>
        )}
        {progress && <span className="band-foot">{progress}</span>}
      </Link>
    </article>
  )
}

/** The card's shape while loading. */
function CardSkeleton() {
  return (
    <div className="band-card">
      <span className="band-art">
        <span className="band-cover sk" />
      </span>
      <span className="band-body">
        <Sk w="80%" h={12} />
        <Sk w="50%" h={10} />
        <Sk w="100%" h={18} />
      </span>
    </div>
  )
}

/** The section's six card skeletons, for a container's own loading state. */
export function ShelfSkeleton({ n = SHELF_PAGE }: { n?: number }) {
  return (
    <div className="band-row" aria-hidden="true">
      {repeat(n, () => (
        <CardSkeleton />
      ))}
    </div>
  )
}

interface ShelfProps {
  /** The heading's id; the section is labelled by it. */
  id: string
  eyebrow?: ReactNode
  title: string
  /** One quiet line under the title: what the shelf is built from. */
  lead?: ReactNode
  /** Buttons beside the title, before the pages. */
  actions?: ReactNode
  /** The cards, each with its key. */
  cards: ReactNode[]
  loading?: boolean
  /** Shown in place of the grid when there is no card (empty, filtered, error). Without it, the
   * section is left out. */
  fallback?: ReactNode
  /** Under the grid, like the taste profile under Nexo's picks. */
  footer?: ReactNode
  /** The section's id, for lists other parts of the page reach. */
  bodyId?: string
  /** `compact`: smaller cards, more to a row (the game page). */
  size?: 'regular' | 'compact'
  className?: string
}

/** The section: head line, then the page of cards, the skeleton, or the fallback. */
export function GameShelf({
  id,
  eyebrow,
  title,
  lead,
  actions,
  cards,
  loading = false,
  fallback,
  footer,
  bodyId,
  size = 'regular',
  className = '',
}: ShelfProps) {
  const t = useMessages(messages)
  const [page, setPage] = useState(1)
  if (!loading && !cards.length && !fallback) return null
  const pages = Math.max(1, Math.ceil(cards.length / SHELF_PAGE))
  const at = Math.min(page, pages)
  let body: ReactNode
  if (loading) body = <ShelfSkeleton />
  else if (cards.length)
    body = <div className="band-row">{cards.slice((at - 1) * SHELF_PAGE, at * SHELF_PAGE)}</div>
  else body = fallback
  return (
    <section
      id={bodyId}
      className={`game-band${size === 'compact' ? ' compact' : ''} ${className}`.trim()}
      aria-labelledby={id}
      aria-busy={loading || undefined}
    >
      {/* One slim line on top: the label and the title, the pages on the right. */}
      <div className="band-head">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 id={id}>{title}</h2>
        {actions && <span className="band-head-actions">{actions}</span>}
        {!loading && cards.length > SHELF_PAGE && (
          <Pager
            page={at}
            size={SHELF_PAGE}
            total={cards.length}
            onPage={setPage}
            label={t('pages', { title })}
            look="arrows"
          />
        )}
      </div>
      {lead && <p className="band-lead">{lead}</p>}
      <div className="band-content">{body}</div>
      {footer}
    </section>
  )
}
