/** The interests list: filter chips, ten per page, and drag to reorder what is still to platinum. */
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { defineMessages, Language, type Translator, useLocale, useMessages } from '../../i18n/i18n'
import { fmtDate, fmtHours, pct } from '../../lib/format'
import type { Interest } from '../../lib/types'
import { Cover } from '../../ui/cover'
import { Icon } from '../../ui/icon'
import { Pager } from '../../ui/pager'
import { Sk } from '../../ui/skeleton'
import { EmptyState } from '../../ui/states'
import { type GoalFilter, goalState, started } from './season'
import './interest-list.css'

const messages = defineMessages({
  [Language.PtBR]: {
    filters: {
      all: 'Todos',
      playing: 'Em andamento',
      pending: 'Não começados',
      done: 'Platinados',
    },
    list: {
      platinumed: 'platinado',
      notStarted: 'não começou',
      drag: 'Arrastar',
      removeLabel: 'Remover {name} dos interesses',
      remove: 'Remover dos interesses',
      pages: 'Páginas de interesses',
      emptyFilter: 'Nada por aqui com esse filtro.',
      recommended: 'Recomendado pelo Nexo em {date}',
      fromReleases: 'Salvo dos lançamentos em {date}',
      nextPick: 'Próxima platina, escolhida pelo Nexo em {date}',
      sale: '{discount}% off · {price} na PS Store',
      saleUntil: '{discount}% off · {price} até {date}',
      plus: 'Incluso no PS Plus {tier}',
      mine: 'No seu PS Plus {tier}: jogue sem pagar',
    },
  },
  [Language.En]: {
    filters: {
      all: 'All',
      playing: 'In progress',
      pending: 'Not started',
      done: 'Platinumed',
    },
    list: {
      platinumed: 'platinumed',
      notStarted: 'not started',
      drag: 'Drag',
      removeLabel: 'Remove {name} from interests',
      remove: 'Remove from interests',
      pages: 'Interest pages',
      emptyFilter: 'Nothing here with this filter.',
      recommended: 'Recommended by Nexo on {date}',
      fromReleases: 'Saved from new releases on {date}',
      nextPick: 'Next platinum, picked by Nexo on {date}',
      sale: '{discount}% off · {price} on the PS Store',
      saleUntil: '{discount}% off · {price} until {date}',
      plus: 'Included with PS Plus {tier}',
      mine: 'In your PS Plus {tier}: play at no cost',
    },
  },
})

const GOAL_PAGE_SIZE = 10

const FILTERS: GoalFilter[] = ['all', 'playing', 'pending', 'done']

interface Ghost {
  id: string
  top: number
  left: number
  width: number
  lifted: boolean
  settling: boolean
}

const TIER_NAMES = { essential: 'Essential', extra: 'Extra', deluxe: 'Deluxe' } as const

/** The game's price on the PS Store when it is on sale or in PS Plus. */
function DealTag({ deal }: { deal: NonNullable<Interest['deal']> }) {
  const t = useMessages(messages)
  const locale = useLocale()
  const price = (deal.price / 100).toLocaleString(locale, {
    style: 'currency',
    currency: deal.currency,
  })
  const tier = TIER_NAMES[deal.plusTier ?? 'extra']
  if (deal.mine)
    return (
      <small className="goal-deal mine">
        <Icon name="tag" />
        {t('list.mine', { tier })}
      </small>
    )
  const text =
    deal.discount > 0
      ? deal.endsAt
        ? t('list.saleUntil', {
            discount: deal.discount,
            price,
            date: new Date(deal.endsAt).toLocaleDateString(locale, {
              day: 'numeric',
              month: 'short',
            }),
          })
        : t('list.sale', { discount: deal.discount, price })
      : t('list.plus', { tier })
  return (
    <small className={`goal-deal${deal.discount > 0 ? ' sale' : ''}`}>
      <Icon name="tag" />
      {text}
    </small>
  )
}

/** The status column: platinumed, the progress or not started, then the hours played. */
function rowStatus(g: Interest, t: Translator<typeof messages>) {
  const played = g.hours != null ? ` · ${fmtHours(g.hours)}` : ''
  if (g.done) return `${t('list.platinumed')}${played}`
  return `${started(g) ? `${g.progress}%` : t('list.notStarted')}${played}`
}

/** Where the game came from: a Nexo recommendation or the releases list. */
function SavedFrom({ g }: { g: Interest }) {
  const t = useMessages(messages)
  if (g.recommendedAt)
    return (
      <small className="goal-recommended">
        <img src="/nexo-avatar.svg" alt="" />
        {t('list.recommended', { date: fmtDate(g.recommendedAt) })}
      </small>
    )
  if (g.source === 'releases' && g.savedAt)
    return (
      <small className="goal-recommended">
        <Icon name="clock" />
        {t('list.fromReleases', { date: fmtDate(g.savedAt) })}
      </small>
    )
  return null
}

function Row({
  g,
  onRemove,
  busy,
  readOnly,
}: {
  g: Interest
  onRemove?: () => void
  busy?: boolean
  readOnly?: boolean
}) {
  const t = useMessages(messages)
  const st = rowStatus(g, t)
  return (
    <>
      {g.done || readOnly ? (
        <span className="goal-grip placeholder" />
      ) : (
        <span className="goal-grip" data-grip aria-hidden="true" data-tip={t('list.drag')}>
          <Icon name="grip" />
        </span>
      )}
      <span className={`goal-game-status${g.done ? ' complete' : ''}`}>
        <Icon name={g.done ? 'check' : 'circle'} />
      </span>
      <Cover url={g.game.cover_url} name={g.game.name} className="goal-cover" />
      <Link className="name" to={`/title/game/${encodeURIComponent(g.game.id)}`}>
        {g.game.name}
        {g.nextPickAt && !g.done ? (
          <small className="goal-recommended next">
            <img src="/nexo-avatar.svg" alt="" />
            {t('list.nextPick', { date: fmtDate(g.nextPickAt) })}
          </small>
        ) : null}
        {g.deal && !g.done ? <DealTag deal={g.deal} /> : null}
        <SavedFrom g={g} />
        {!g.done && started(g) ? (
          <div className="bar small">
            <i style={{ width: `${pct(g.progress)}%` }} />
          </div>
        ) : null}
      </Link>
      <span className="st">{st}</span>
      {!readOnly && (
        <button
          type="button"
          className="goal-remove"
          aria-label={t('list.removeLabel', { name: g.game.name })}
          data-tip={t('list.remove')}
          data-remove={g.id}
          disabled={busy}
          onClick={onRemove}
        >
          <Icon name="trash" />
        </button>
      )}
    </>
  )
}

export function InterestList({
  interests,
  filter,
  page: wanted,
  onFilter,
  onPage,
  busy = false,
  readOnly = false,
  newGameId,
  onRemove,
  onReorder,
}: {
  interests: Interest[]
  filter: GoalFilter
  page: number
  onFilter: (filter: GoalFilter) => void
  onPage: (page: number) => void
  busy?: boolean
  /** The demo: no removing and no dragging. */
  readOnly?: boolean
  /** The game just added: its row slides in and glows once. */
  newGameId?: string | null
  onRemove: (interestId: string) => void
  /** Saves the full order of the open interests. */
  onReorder: (ids: string[]) => Promise<unknown>
}) {
  const t = useMessages(messages)
  // Manual order for what is still to do; platinumed ones sink to the bottom.
  const open = interests.filter((g) => !g.done)
  const done = interests.filter((g) => g.done)
  const filtered = [...open, ...done].filter((g) => filter === 'all' || goalState(g) === filter)
  const page = Math.min(wanted, Math.max(1, Math.ceil(filtered.length / GOAL_PAGE_SIZE)))
  const shown = filtered.slice((page - 1) * GOAL_PAGE_SIZE, page * GOAL_PAGE_SIZE)

  // While dragging (and until the new order is saved) the visible open rows follow this order.
  const [order, setOrder] = useState<string[] | null>(null)
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropped, setDropped] = useState<string | null>(null)
  const rows = useRef(new Map<string, HTMLLIElement>())
  const list = useRef<HTMLUListElement>(null)
  const flipBefore = useRef<Map<string, number> | null>(null)
  const stopDrag = useRef<(() => void) | null>(null)
  const scrollToList = useRef(false)

  useEffect(() => () => stopDrag.current?.(), [])

  useEffect(() => {
    if (!scrollToList.current) return
    scrollToList.current = false
    list.current?.scrollIntoView({ block: 'nearest' })
  })

  // Neighbours slide out of the way of the dragged row (FLIP).
  useLayoutEffect(() => {
    const before = flipBefore.current
    if (!before) return
    flipBefore.current = null
    for (const [id, li] of rows.current) {
      if (id === dragging) continue
      const delta = (before.get(id) ?? 0) - li.getBoundingClientRect().top
      if (!delta) continue
      li.style.transition = 'none'
      li.style.transform = `translateY(${delta}px)`
      requestAnimationFrame(() => {
        li.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)'
        li.style.transform = ''
      })
    }
  })

  const shownOpen = shown.filter((g) => !g.done)
  const visible = order
    ? [
        ...order.flatMap((id) => shownOpen.filter((g) => g.id === id)),
        ...shownOpen.filter((g) => !order.includes(g.id)),
      ]
    : shownOpen
  const rendered = [...visible, ...shown.filter((g) => g.done)]

  // The list shows one page or one filter at a time: put the reordered visible ids back into
  // their slots in the full order of open interests, leaving the hidden ones where they were.
  const fullOrder = (ids: string[]) => {
    const all = open.map((g) => g.id)
    const moved = new Set(ids)
    const queue = [...ids]
    return all.length ? all.map((id) => (moved.has(id) ? (queue.shift() ?? id) : id)) : ids
  }

  // Pointer-based drag (mouse and touch); the ghost settles into its slot on release.
  const startDrag = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    const li = rows.current.get(id)
    if (!li || busy || readOnly || stopDrag.current) return
    event.preventDefault()
    // Hide the grip's "Arrastar" tooltip: the global host hides on mouseout of a [data-tip].
    event.currentTarget.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
    const r = li.getBoundingClientRect()
    const offsetY = event.clientY - r.top
    let current = visible.map((g) => g.id)
    let lastTarget: string | null = null
    setOrder(current)
    setDragging(id)
    setGhost({
      id,
      top: r.top + window.scrollY,
      left: r.left,
      width: r.width,
      lifted: false,
      settling: false,
    })
    requestAnimationFrame(() => setGhost((g) => g && { ...g, lifted: true }))
    document.body.classList.add('is-dragging')

    const move = (e: PointerEvent) => {
      e.preventDefault()
      const y = e.clientY
      setGhost((g) => g && { ...g, top: y - offsetY + window.scrollY })
      const others = current.filter((x) => x !== id)
      const target = others.find((x) => {
        const box = rows.current.get(x)?.getBoundingClientRect()
        return box ? y < box.top + box.height / 2 : false
      })
      const key = target ?? 'end'
      if (key === lastTarget) return
      lastTarget = key
      flipBefore.current = new Map(
        [...rows.current].map(([rowId, row]) => [rowId, row.getBoundingClientRect().top]),
      )
      const next = [...others]
      next.splice(target ? next.indexOf(target) : next.length, 0, id)
      current = next
      setOrder(next)
    }
    const detach = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
      document.body.classList.remove('is-dragging')
      stopDrag.current = null
    }
    const up = () => {
      detach()
      const slot = rows.current.get(id)?.getBoundingClientRect()
      // Glide the ghost into the slot, then reveal the real row with a soft flash.
      setGhost((g) => g && { ...g, top: (slot?.top ?? 0) + window.scrollY, settling: true })
      setTimeout(() => {
        setGhost(null)
        setDragging(null)
        setDropped(id)
        setTimeout(() => setDropped((d) => (d === id ? null : d)), 600)
      }, 180)
      onReorder(fullOrder(current)).finally(() => setOrder(null))
    }
    stopDrag.current = detach
    document.addEventListener('pointermove', move, { passive: false })
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
  }

  const ghostItem = ghost && interests.find((g) => g.id === ghost.id)
  const rowClass = (g: Interest) =>
    [
      goalState(g),
      g.game.id === newGameId && 'is-new',
      g.id === dragging && 'dragging',
      g.id === dropped && 'dropped',
    ]
      .filter(Boolean)
      .join(' ')

  return (
    <>
      <div className="chips goal-filters">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            className={`chip${filter === key ? ' active' : ''}`}
            data-goal-filter={key}
            disabled={busy}
            onClick={() => onFilter(key)}
          >
            {t(`filters.${key}`)}
            <span className="chip-count">
              {key === 'all'
                ? interests.length
                : interests.filter((g) => goalState(g) === key).length}
            </span>
          </button>
        ))}
      </div>
      {shown.length ? (
        <>
          <ul className="goal-list" ref={list}>
            {rendered.map((g) => (
              <li
                key={g.id}
                ref={(el) => {
                  if (el) rows.current.set(g.id, el)
                  return () => {
                    rows.current.delete(g.id)
                  }
                }}
                className={rowClass(g)}
                data-id={g.id}
                data-game={g.game.id}
                data-draggable={g.done || readOnly ? undefined : ''}
                onPointerDown={(event) => {
                  if ((event.target as HTMLElement).closest('[data-grip]')) startDrag(event, g.id)
                }}
              >
                <Row g={g} busy={busy} readOnly={readOnly} onRemove={() => onRemove(g.id)} />
              </li>
            ))}
          </ul>
          <Pager
            page={page}
            size={GOAL_PAGE_SIZE}
            total={filtered.length}
            disabled={busy}
            label={t('list.pages')}
            onPage={(next) => {
              scrollToList.current = true
              onPage(next)
            }}
          />
        </>
      ) : (
        <EmptyState>{t('list.emptyFilter')}</EmptyState>
      )}
      {ghost &&
        ghostItem &&
        createPortal(
          <li
            className={`${goalState(ghostItem)}${ghostItem.game.id === newGameId ? ' is-new' : ''} drag-ghost${ghost.lifted ? ' lifted' : ''}`}
            data-id={ghostItem.id}
            data-game={ghostItem.game.id}
            inert
            style={{
              width: ghost.width,
              left: ghost.left,
              top: ghost.top,
              ...(ghost.settling && {
                transition: 'top 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.18s ease',
                transform: 'rotate(0) scale(1)',
              }),
            }}
          >
            <Row g={ghostItem} />
          </li>,
          document.body,
        )}
    </>
  )
}

export function InterestListSkeleton() {
  return (
    <>
      <div className="chips goal-filters">
        <Sk w="70px" h={30} />
        <Sk w="110px" h={30} />
        <Sk w="120px" h={30} />
        <Sk w="100px" h={30} />
      </div>
      <ul className="goal-list">
        {Array.from({ length: 6 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows
          <li key={i}>
            <Sk w="22px" h={28} />
            <Sk w="29px" h={29} style={{ borderRadius: '50%' }} />
            <Sk w="34px" h={46} style={{ borderRadius: 'var(--radius-tag)' }} />
            <span className="name">
              <Sk w="55%" h={12} />
            </span>
            <Sk w="60px" h={10} />
            <Sk w="30px" h={30} />
          </li>
        ))}
      </ul>
    </>
  )
}
