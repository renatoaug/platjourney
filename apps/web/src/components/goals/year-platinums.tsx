/** The year's platinums: a month bar chart that filters, and the timeline grouped by month, six per page. */
import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { defineMessages, getLocale, Language, useMessages } from '../../i18n/i18n'
import { fmtHours } from '../../lib/format'
import type { YearGoals } from '../../lib/types'
import { Cover } from '../../ui/cover'
import { Icon } from '../../ui/icon'
import { Pager } from '../../ui/pager'
import { useKept } from './use-kept'
import '../guide.css'
import './year-platinums.css'

const messages = defineMessages({
  [Language.PtBR]: {
    year: {
      title: 'Platinas de {year}',
      filterLabel: 'Filtrar conquistas por mês',
      monthLabel: {
        one: '{month}: {count} platina',
        other: '{month}: {count} platinas',
      },
      recentFirst: 'Mais recentes primeiro',
      monthOf: 'Conquistas de {month}',
      showAll: 'Ver o ano todo',
      monthsWith: {
        one: '{count} meses com conquistas',
        other: '{count} meses com conquistas',
      },
      played: '· {hours} de jogo',
      order: 'Platina {n} do ano',
      emptyMonth: 'Nenhuma platina registrada neste mês.',
      pages: 'Páginas de platinas',
      pace: 'Ritmo do ano',
      average: 'Média',
      perPlatinum: '{hours} por platina',
      timed: { one: 'em {count} platina', other: 'em {count} platinas' },
      quickest: 'Mais rápida',
      longest: 'Mais longa',
      empty:
        'Sua primeira platina do ano começa com o próximo jogo. Cada conquista vai aparecer aqui.',
    },
    months: {
      jan: 'Jan',
      feb: 'Fev',
      mar: 'Mar',
      apr: 'Abr',
      may: 'Mai',
      jun: 'Jun',
      jul: 'Jul',
      aug: 'Ago',
      sep: 'Set',
      oct: 'Out',
      nov: 'Nov',
      dec: 'Dez',
    },
  },
  [Language.En]: {
    year: {
      title: '{year} platinums',
      filterLabel: 'Filter platinums by month',
      monthLabel: {
        one: '{month}: {count} platinum',
        other: '{month}: {count} platinums',
      },
      recentFirst: 'Most recent first',
      monthOf: 'Platinums in {month}',
      showAll: 'See the whole year',
      monthsWith: {
        one: '{count} month with platinums',
        other: '{count} months with platinums',
      },
      played: '· {hours} played',
      order: 'Platinum {n} of the year',
      emptyMonth: 'No platinum recorded this month.',
      pages: 'Platinum pages',
      pace: 'The year so far',
      average: 'Average',
      perPlatinum: '{hours} per platinum',
      timed: { one: 'over {count} platinum', other: 'over {count} platinums' },
      quickest: 'Quickest',
      longest: 'Longest',
      empty:
        'Your first platinum of the year starts with your next game. Every one will show up here.',
    },
    months: {
      jan: 'Jan',
      feb: 'Feb',
      mar: 'Mar',
      apr: 'Apr',
      may: 'May',
      jun: 'Jun',
      jul: 'Jul',
      aug: 'Aug',
      sep: 'Sep',
      oct: 'Oct',
      nov: 'Nov',
      dec: 'Dec',
    },
  },
})

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const
const PAGE_SIZE = 6

type Platinum = YearGoals['platinumed'][number]
const monthOf = (g: Platinum) => Number(g.at.slice(5, 7)) - 1

export function YearPlatinums({ goals: p, busy = false }: { goals: YearGoals; busy?: boolean }) {
  const t = useMessages(messages)
  // Month and page belong to one year; a new year starts from the whole list.
  const [view, setView] = useKept('goals.platinums', {
    year: p.year,
    month: null as number | null,
    page: 1,
  })
  const current = view.year === p.year ? view : { year: p.year, month: null, page: 1 }
  const box = useRef<HTMLDivElement>(null)
  const monthButtons = useRef<(HTMLButtonElement | null)[]>([])
  const pendingFocus = useRef<number | 'pager' | null>(null)

  useEffect(() => {
    const target = pendingFocus.current
    if (target === null) return
    pendingFocus.current = null
    if (target === 'pager') {
      box.current?.querySelector('.year-list-label')?.scrollIntoView({ block: 'nearest' })
      box.current
        ?.querySelector<HTMLButtonElement>('.pager button:not(:disabled)')
        ?.focus({ preventScroll: true })
    } else monthButtons.current[target]?.focus({ preventScroll: true })
  })

  const all = [...p.platinumed].sort((a, b) => b.at.localeCompare(a.at))
  const counts = MONTHS.map((_, month) => all.filter((g) => monthOf(g) === month).length)
  const max = Math.max(1, ...counts)
  const filtered = current.month === null ? all : all.filter((g) => monthOf(g) === current.month)
  const page = Math.min(current.page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const start = (page - 1) * PAGE_SIZE
  const groups = new Map<number, Platinum[]>()
  for (const g of filtered.slice(start, start + PAGE_SIZE)) {
    const list = groups.get(monthOf(g)) ?? []
    list.push(g)
    groups.set(monthOf(g), list)
  }

  const pickMonth = (month: number) => {
    setView({ year: p.year, month: current.month === month ? null : month, page: 1 })
    pendingFocus.current = month
  }
  const showAll = () => {
    pendingFocus.current = current.month
    setView({ year: p.year, month: null, page: 1 })
  }

  return (
    <div className="card year-card" id="year-platinums" ref={box}>
      <div className="year-heading">
        <h2>
          <Icon name="trophy" /> {t('year.title', { year: p.year })}
        </h2>
        <span className="key-count">{all.length}</span>
      </div>
      {all.length ? (
        <>
          {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would restyle this bar chart; the group role names it */}
          <div className="year-months" role="group" aria-label={t('year.filterLabel')}>
            {MONTHS.map((key, month) => (
              <button
                key={key}
                ref={(el) => {
                  monthButtons.current[month] = el
                }}
                type="button"
                data-plat-month={month}
                aria-pressed={current.month === month}
                aria-label={t('year.monthLabel', {
                  month: t(`months.${key}`),
                  count: counts[month],
                })}
                className={`year-month ${counts[month] ? 'has-plats' : ''}`}
                disabled={busy}
                onClick={() => pickMonth(month)}
              >
                <span className="year-month-value">{counts[month] || '–'}</span>
                <span className="year-month-bar" aria-hidden="true">
                  <i
                    style={{
                      height: `${counts[month] ? Math.max(5, (counts[month] / max) * 24) : 2}px`,
                    }}
                  />
                </span>
                <span>{t(`months.${key}`)}</span>
              </button>
            ))}
          </div>
          <div className="year-list-label">
            <span>
              {current.month === null
                ? t('year.recentFirst')
                : t('year.monthOf', { month: t(`months.${MONTHS[current.month]}`) })}
            </span>
            {current.month !== null ? (
              <button type="button" className="text-link" disabled={busy} onClick={showAll}>
                {t('year.showAll')}
              </button>
            ) : (
              <span>{t('year.monthsWith', { count: counts.filter(Boolean).length })}</span>
            )}
          </div>
          <div className="year-timeline">
            {groups.size ? (
              [...groups].map(([month, games]) => (
                <section key={month} className="year-month-group">
                  <h3>
                    {new Date(p.year, month, 1).toLocaleDateString(getLocale(), { month: 'long' })}
                  </h3>
                  <ul>
                    {games.map((g) => {
                      const order = all.length - all.indexOf(g)
                      return (
                        <li key={`${g.game.id}-${g.at}`}>
                          <Link
                            className="year-platinum"
                            to={`/title/game/${encodeURIComponent(g.game.id)}`}
                          >
                            <Cover
                              url={g.game.cover_url}
                              name={g.game.name}
                              className="year-cover"
                            />
                            <span className="year-game">
                              <b>{g.game.name}</b>
                              <span>
                                <time dateTime={g.at}>
                                  {new Date(`${g.at}T12:00:00`).toLocaleDateString(getLocale(), {
                                    day: '2-digit',
                                    month: '2-digit',
                                  })}
                                </time>
                                {g.hours != null ? (
                                  <span>{t('year.played', { hours: fmtHours(g.hours) })}</span>
                                ) : null}
                              </span>
                            </span>
                            {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the badge reads as "platina número N" */}
                            <span className="year-order" aria-label={t('year.order', { n: order })}>
                              #{String(order).padStart(2, '0')}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))
            ) : (
              <p className="year-empty">{t('year.emptyMonth')}</p>
            )}
          </div>
          <YearPace platinums={all} />
          <Pager
            page={page}
            size={PAGE_SIZE}
            total={filtered.length}
            label={t('year.pages')}
            onPage={(next) => {
              pendingFocus.current = 'pager'
              setView({ ...current, page: next })
            }}
          />
        </>
      ) : (
        <div className="year-empty">{t('year.empty')}</div>
      )}
    </div>
  )
}

/** The year's pace from the platinums with play time: the average, the quickest and the longest.
 * Needs two to compare. */
function YearPace({ platinums }: { platinums: Platinum[] }) {
  const t = useMessages(messages)
  const timed = platinums
    .filter((g): g is Platinum & { hours: number } => !!g.hours)
    .sort((a, b) => a.hours - b.hours)
  if (timed.length < 2) return null
  const quickest = timed[0]
  const longest = timed[timed.length - 1]
  const average = Math.round(timed.reduce((sum, g) => sum + g.hours, 0) / timed.length)
  return (
    <section className="year-pace" aria-label={t('year.pace')}>
      <div>
        <small>{t('year.average')}</small>
        <b>{t('year.perPlatinum', { hours: fmtHours(average) })}</b>
        <span>{t('year.timed', { count: timed.length })}</span>
      </div>
      <div>
        <small>{t('year.quickest')}</small>
        <b title={quickest.game.name}>{quickest.game.name}</b>
        <span>{fmtHours(quickest.hours)}</span>
      </div>
      <div>
        <small>{t('year.longest')}</small>
        <b title={longest.game.name}>{longest.game.name}</b>
        <span>{fmtHours(longest.hours)}</span>
      </div>
    </section>
  )
}
