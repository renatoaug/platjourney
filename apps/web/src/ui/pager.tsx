/** Pager for a paged list: "1–24 de 399" on the left; previous, page numbers and next on the right. The first and last pages are always among the numbers, so there are no separate jump buttons. `look="arrows"` is the small one for a band of cards: previous, "1/3", next. Renders nothing when everything fits on one page. */
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { Icon } from './icon'
import './pager.css'

const messages = defineMessages({
  [Language.PtBR]: {
    pager: {
      label: 'Páginas',
      range: '{start}–{end} de {total}',
      previous: 'Página anterior',
      next: 'Próxima página',
      page: 'Página {page}',
      count: 'Página {page} de {pages}',
    },
  },
  [Language.En]: {
    pager: {
      label: 'Pages',
      range: '{start}–{end} of {total}',
      previous: 'Previous page',
      next: 'Next page',
      page: 'Page {page}',
      count: 'Page {page} of {pages}',
    },
  },
})

/** The page numbers to show: the first, the last and the current one with its neighbours; null marks a gap. A gap of a single page shows that page instead. */
export function pageItems(page: number, pages: number): (number | null)[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages))
  const sorted = [...keep].sort((a, b) => a - b)
  const out: (number | null)[] = []
  for (const p of sorted) {
    const prev = out.length ? (out[out.length - 1] as number) : 0
    if (p - prev === 2) out.push(prev + 1)
    else if (p - prev > 2) out.push(null)
    out.push(p)
  }
  return out
}

export function Pager({
  page,
  size,
  total,
  onPage,
  label,
  disabled = false,
  look = 'numbers',
}: {
  page: number
  size: number
  total: number
  onPage: (page: number) => void
  label?: string
  /** While a change is being saved, like the rest of the list. */
  disabled?: boolean
  /** `arrows`: only previous and next with "1/3" between them, for a band's head line. */
  look?: 'numbers' | 'arrows'
}) {
  const t = useMessages(messages)
  const pages = Math.max(1, Math.ceil(total / size))
  if (pages <= 1) return null
  const start = (page - 1) * size
  const arrow = (to: number, name: string, icon: string, off: boolean) => (
    <button
      type="button"
      className="pager-arrow"
      disabled={disabled || off}
      aria-label={name}
      onClick={() => onPage(to)}
    >
      <Icon name={icon} />
    </button>
  )
  if (look === 'arrows')
    return (
      <nav className="pager pager-arrows" aria-label={label ?? t('pager.label')}>
        {arrow(page - 1, t('pager.previous'), 'chevron-left', page === 1)}
        <span className="pager-count" title={t('pager.count', { page, pages })}>
          {page}/{pages}
        </span>
        {arrow(page + 1, t('pager.next'), 'chevron-right', page === pages)}
      </nav>
    )
  return (
    <nav className="pager" aria-label={label ?? t('pager.label')}>
      <span>
        {t('pager.range', { start: start + 1, end: Math.min(start + size, total), total })}
      </span>
      <div className="pager-pages">
        {arrow(page - 1, t('pager.previous'), 'chevron-left', page === 1)}
        {pageItems(page, pages).map((p, i) =>
          p === null ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: a gap has no identity of its own
            <span key={`gap-${i}`} className="pager-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className="pager-page"
              disabled={disabled}
              aria-label={t('pager.page', { page: p })}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => p !== page && onPage(p)}
            >
              {p}
            </button>
          ),
        )}
        {arrow(page + 1, t('pager.next'), 'chevron-right', page === pages)}
      </div>
    </nav>
  )
}
