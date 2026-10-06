/** Trophy list with search, filters, sorting, pagination and the per-trophy Nexo help. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import {
  defineMessages,
  Language,
  type MessageKey,
  type Translator,
  translator,
  useMessages,
} from '../i18n/i18n'
import { ApiError, api } from '../lib/api'
import { fmtDate, fmtRate } from '../lib/format'
import type { Trophy } from '../lib/types'
import { Icon } from '../ui/icon'
import { Markdown } from '../ui/markdown'
import { modelWorkDone } from '../ui/plugin-slot'
import { repeat, Sk } from '../ui/skeleton'
import { SourceNote, splitSource } from '../ui/source-note'
import { EmptyState } from '../ui/states'
import { toast } from '../ui/toast'
import './trophy-list.css'

const messages = defineMessages({
  [Language.PtBR]: {
    types: {
      platinum: 'Platina',
      gold: 'Ouro',
      silver: 'Prata',
      bronze: 'Bronze',
    },
    rarity: {
      ultraRare: 'Ultra rara',
      veryRare: 'Muito rara',
      rare: 'Rara',
      common: 'Comum',
    },
    help: {
      loading: 'Nexo está olhando o seu progresso e o guia…',
      title: 'Dica do Nexo',
      continueInChat: 'Continuar no chat',
      ask: 'Pedir dica',
      askAbout: 'Pedir dica sobre {name}',
      failed: 'Não conseguimos falar com o Nexo. Tente de novo.',
    },
    earned: 'Conquistado',
    earnedOn: 'Conquistado · {date}',
    heading: 'Troféus',
    empty: 'Os troféus deste jogo aparecem aqui assim que a PSN enviar a lista.',
    search: 'Buscar troféu',
    searchPlaceholder: 'Buscar por nome ou descrição',
    statusLabel: 'Status dos troféus',
    status: {
      all: 'Todos',
      pending: 'Pendentes',
      earned: 'Conquistados',
    },
    filters: 'Filtros',
    sortBy: 'Ordenar por',
    sort: {
      psn: 'Padrão (ordem da PSN)',
      pending: 'Pendentes primeiro',
      progress: 'Progresso',
      date: 'Conquista recente',
      rarity: 'Mais raros',
      common: 'Mais comuns',
      type: 'Tipo de troféu',
    },
    content: 'Conteúdo',
    group: {
      base: 'Jogo base',
      all: 'Jogo base + DLC',
      dlc: 'Só DLC',
      dlcShort: 'DLC',
    },
    onlyProgress: 'Só com progresso',
    results: '{from}–{to} de {total} troféus · {group}',
    noResults: 'Nenhum troféu encontrado',
    noResultsHint: 'Tente outro termo ou ajuste os filtros para ver mais troféus.',
    pages: 'Páginas de troféus',
    previousPage: 'Página anterior',
    nextPage: 'Próxima página',
    page: 'Página {n}',
  },
  [Language.En]: {
    types: {
      platinum: 'Platinum',
      gold: 'Gold',
      silver: 'Silver',
      bronze: 'Bronze',
    },
    rarity: {
      ultraRare: 'Ultra rare',
      veryRare: 'Very rare',
      rare: 'Rare',
      common: 'Common',
    },
    help: {
      loading: 'Nexo is checking your progress and the guide…',
      title: 'Nexo’s tip',
      continueInChat: 'Continue in chat',
      ask: 'Ask for a tip',
      askAbout: 'Ask for a tip on {name}',
      failed: 'We couldn’t reach Nexo. Try again.',
    },
    earned: 'Earned',
    earnedOn: 'Earned · {date}',
    heading: 'Trophies',
    empty: 'This game’s trophies show up here as soon as PSN sends the list.',
    search: 'Search trophies',
    searchPlaceholder: 'Search by name or description',
    statusLabel: 'Trophy status',
    status: {
      all: 'All',
      pending: 'Pending',
      earned: 'Earned',
    },
    filters: 'Filters',
    sortBy: 'Sort by',
    sort: {
      psn: 'Default (PSN order)',
      pending: 'Pending first',
      progress: 'Progress',
      date: 'Recently earned',
      rarity: 'Rarest',
      common: 'Most common',
      type: 'Trophy type',
    },
    content: 'Content',
    group: {
      base: 'Base game',
      all: 'Base game + DLC',
      dlc: 'DLC only',
      dlcShort: 'DLC',
    },
    onlyProgress: 'With progress only',
    results: '{from}–{to} of {total} trophies · {group}',
    noResults: 'No trophies found',
    noResultsHint: 'Try another term or adjust the filters to see more trophies.',
    pages: 'Trophy pages',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    page: 'Page {n}',
  },
})
const translate = translator(messages)

/** A trophy as /api/state and /api/title send it: trophies with a counter carry their progress. */
const TYPE_ORDER: Record<string, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3 }

type Sorter = (a: Trophy, b: Trophy) => number
const rate = (t: Trophy) => t.earnedRate ?? 0

const SORTERS: Record<string, Sorter> = {
  // The order the game itself uses, as the PSN shows it.
  psn: (a, b) => a.id - b.id,
  pending: (a, b) => Number(a.earned) - Number(b.earned) || rate(b) - rate(a),
  progress: (a, b) =>
    Number(a.earned) - Number(b.earned) ||
    (b.progressRate ?? -1) - (a.progressRate ?? -1) ||
    rate(b) - rate(a),
  date: (a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''),
  rarity: (a, b) => rate(a) - rate(b),
  common: (a, b) => rate(b) - rate(a),
  type: (a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9),
}

const TYPES: Record<string, MessageKey<typeof messages>> = {
  platinum: 'types.platinum',
  gold: 'types.gold',
  silver: 'types.silver',
  bronze: 'types.bronze',
}

// PSN's rarity tiers, rarest first; `rarity` (PSN's pt-BR label) is the fallback.
const RARITIES: MessageKey<typeof messages>[] = [
  'rarity.ultraRare',
  'rarity.veryRare',
  'rarity.rare',
  'rarity.common',
]

const rarityLabel = (t: Trophy, tr: Translator<typeof messages>) => {
  const key = t.rarityTier == null ? undefined : RARITIES[t.rarityTier]
  return key ? tr(key) : t.rarity
}

// Shared library controls for the current game and title pages.
const TROPHY_PAGE_SIZE = 8

type Status = 'all' | 'pending' | 'earned'
type Group = 'base' | 'all' | 'dlc'

interface SavedFilters {
  sort?: string
  group?: string
  status?: string
  onlyProgress?: boolean
  hideEarned?: boolean
}

function savedFilters(): SavedFilters {
  try {
    const f: unknown = JSON.parse(localStorage.getItem('trophyFilters') ?? '{}')
    return f && typeof f === 'object' ? (f as SavedFilters) : {}
  } catch {
    return {}
  }
}

// `np` is the trophy list's id on PSN; with it, trophies not yet earned get a
// "Pedir dica" button that asks Nexo about that trophy.
// Answers live outside the list, per trophy list, so they survive the list being
// remounted (leaving the page and coming back, the title page reloading).
// An answer is the text, or 'loading' while Nexo thinks.
// Exported so stories can show an answer without asking Nexo.
export const helpAnswers = new Map<string, Map<number, string>>()

function TrophyHelp({ answer }: { answer?: string }) {
  const t = useMessages(messages)
  if (!answer) return null
  if (answer === 'loading')
    return (
      <div className="trophy-help is-loading">
        <span className="typing">
          <i />
          <i />
          <i />
        </span>{' '}
        {t('help.loading')}
      </div>
    )
  const [body, source] = splitSource(answer)
  return (
    <div className="trophy-help">
      <div className="trophy-help-head">
        <img className="nexo-avatar" src="/nexo-avatar.svg" alt="" />
        <b>{t('help.title')}</b>
      </div>
      <div className="md">
        <Markdown text={body} />
        {source && <SourceNote text={source} />}
      </div>
      <Link className="text-link" to="/nexo">
        {t('help.continueInChat')} <Icon name="arrow" />
      </Link>
    </div>
  )
}

function TrophyCard({
  t,
  answers,
  onHelp,
}: {
  t: Trophy
  answers: Map<number, string> | null
  onHelp: (id: number) => void
}) {
  const tr = useMessages(messages)
  const help = answers && !t.earned
  return (
    <article className={`trophy-row ${t.earned ? 'is-earned' : ''}`}>
      <div className="trophy-art">
        {t.iconUrl ? <img src={t.iconUrl} alt="" loading="lazy" /> : <Icon name="trophy" />}
        {t.earned && (
          <span className="trophy-earned-mark" title={tr('earned')}>
            <Icon name="check" />
          </span>
        )}
      </div>
      <div className="trophy-row-content">
        <h4>{t.name}</h4>
        <p>{t.detail}</p>
        <div className="trophy-row-meta">
          <span className={`trophy-metal ${t.type}`}>
            <Icon name="trophy" />
            {TYPES[t.type] ? tr(TYPES[t.type]) : t.type}
          </span>
          {(t.rarity || t.rarityTier != null) && (
            <span>
              {fmtRate(t.earnedRate)}% · {rarityLabel(t, tr)}
            </span>
          )}
          {t.earned && (
            <span className="trophy-earned-date">
              {t.earnedAt ? tr('earnedOn', { date: fmtDate(t.earnedAt) }) : tr('earned')}
            </span>
          )}
        </div>
        {t.progressTarget && !t.earned ? (
          <div className="trophy-row-progress">
            <div className="bar small">
              <i style={{ width: `${Math.max(0, Math.min(100, t.progressRate ?? 0))}%` }} />
            </div>
            <span>
              {t.progressValue ?? 0}/{t.progressTarget} · {t.progressRate ?? 0}%
            </span>
          </div>
        ) : null}
        {help && <TrophyHelp answer={answers.get(t.id)} />}
      </div>
      {help && t.type !== 'platinum' && !answers.has(t.id) && (
        <button
          type="button"
          className="trophy-help-btn"
          aria-label={tr('help.askAbout', { name: t.name })}
          onClick={() => onHelp(t.id)}
        >
          <Icon name="nexo" />
          <span>{tr('help.ask')}</span>
        </button>
      )}
    </article>
  )
}

/** The list's own skeleton: the real controls, disabled, over placeholder rows. */
export function TrophyListSkeleton({ rows = 6 }: { rows?: number }) {
  const t = useMessages(messages)
  return (
    <>
      <div className="trophy-controls">
        <label className="trophy-search">
          <Icon name="search" />
          <input disabled aria-label={t('search')} placeholder={t('searchPlaceholder')} />
        </label>
        <div className="trophy-toolbar">
          {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would restyle the segmented control */}
          <div className="trophy-status" role="group">
            <button type="button" disabled aria-pressed="true">
              {t('status.all')}
            </button>
            <button type="button" disabled>
              {t('status.pending')}
            </button>
            <button type="button" disabled>
              {t('status.earned')}
            </button>
          </div>
          <details className="trophy-options">
            <summary>
              <Icon name="layers" /> {t('filters')} <Icon name="chevron-down" />
            </summary>
          </details>
        </div>
      </div>
      <div className="trophy-results">
        <Sk w="180px" h={11} />
      </div>
      <div className="trophy-rows">
        {repeat(rows, (i) => (
          <article className="trophy-row">
            <div className="trophy-art">
              <Sk w="100%" h={56} style={{ height: '100%', borderRadius: 'inherit' }} />
            </div>
            <div className="trophy-row-content">
              <h4>
                <Sk w={`${34 + ((i * 17) % 30)}%`} h={14} />
              </h4>
              <p>
                <Sk w={`${70 + ((i * 11) % 25)}%`} h={12} />
              </p>
              <div className="trophy-row-meta">
                <Sk w="64px" h={20} style={{ borderRadius: 'var(--radius-pill)' }} />
                <Sk w="96px" h={20} style={{ borderRadius: 'var(--radius-pill)' }} />
              </div>
            </div>
          </article>
        ))}
      </div>
      <nav className="trophy-pagination">
        <Sk w="30px" h={30} />
        <Sk w="30px" h={30} />
        <Sk w="30px" h={30} />
      </nav>
    </>
  )
}

/**
 * The inside of a trophies card: its heading with the count, then the controls, rows and pages.
 * `trophies` null is still loading. `prefix` keeps the control ids apart (`t` on the game screen,
 * `title-t` on a title page); `np` turns on "Pedir dica", which needs the player's progress.
 */
export function TrophyList({
  trophies,
  prefix = 't',
  np,
}: {
  trophies: Trophy[] | null
  prefix?: string
  np?: string | null
}) {
  const t = useMessages(messages)
  const { me } = useApp()
  const [saved] = useState(savedFilters)
  const [status, setStatus] = useState<Status>(() =>
    saved.status === 'all' || saved.status === 'pending' || saved.status === 'earned'
      ? saved.status
      : saved.hideEarned
        ? 'pending'
        : 'all',
  )
  const [group, setGroup] = useState<Group>(() =>
    saved.group === 'base' || saved.group === 'all' || saved.group === 'dlc' ? saved.group : 'base',
  )
  const [onlyProgress, setOnlyProgress] = useState(!!saved.onlyProgress)
  // A sort picked by hand sticks, here and on the next games; until then it follows the game.
  const [chosenSort, setChosenSort] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [, setVersion] = useState(0)
  const controlsRef = useRef<HTMLDivElement>(null)
  const pagerRef = useRef<HTMLElement>(null)
  const paged = useRef(false)

  if (np && !helpAnswers.has(np)) helpAnswers.set(np, new Map())
  // Asking Nexo about a trophy calls the model, which the demo never does.
  const answers = np && !me.demo ? (helpAnswers.get(np) ?? null) : null

  const list = trophies ?? []
  // A platinumed game opens in the game's own order, like the PSN; otherwise the
  // saved preference (pending first by default) is what helps.
  const platinumed = list.some((t) => t.type === 'platinum' && t.earned)
  const savedSort = saved.sort && SORTERS[saved.sort] ? saved.sort : 'pending'
  const sort = chosenSort ?? (platinumed ? 'psn' : savedSort)
  const hasDlc = list.some((t) => t.groupId !== 'default')

  useEffect(() => {
    try {
      // The automatic "Padrão" of a platinumed game is not a preference; keep the saved one.
      const keep = chosenSort ?? savedFilters().sort
      localStorage.setItem(
        'trophyFilters',
        JSON.stringify({ sort: keep, group, status, onlyProgress }),
      )
    } catch {}
  }, [chosenSort, group, status, onlyProgress])

  // After a page change, bring the list's top into view and keep focus on the pager.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `page` is the trigger, not an input
  useLayoutEffect(() => {
    if (!paged.current) return
    paged.current = false
    controlsRef.current?.scrollIntoView({ block: 'start' })
    pagerRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.focus({ preventScroll: true })
  }, [page])

  if (!trophies) return <TrophyListSkeleton />

  const scope = hasDlc
    ? list.filter((t) => group === 'all' || (group === 'base') === (t.groupId === 'default'))
    : list
  const query = q.trim().toLowerCase()
  const shown = scope
    .filter((t) => status === 'all' || (status === 'earned') === !!t.earned)
    .filter((t) => !onlyProgress || t.progressTarget)
    .filter((t) => !query || `${t.name} ${t.detail} ${t.nameEn}`.toLowerCase().includes(query))
    .sort(SORTERS[sort] ?? SORTERS.pending)
  const pages = Math.max(1, Math.ceil(shown.length / TROPHY_PAGE_SIZE))
  const current = Math.max(1, Math.min(pages, page))
  const start = (current - 1) * TROPHY_PAGE_SIZE
  const earned = scope.filter((t) => t.earned).length
  // A list from the catalog (game not owned) has no rarity and no progress to count.
  const catalogOnly = scope.every((t) => !t.rarity && t.rarityTier == null)
  const filterCount =
    Number(sort !== 'pending') + Number(hasDlc && group !== 'base') + Number(onlyProgress)

  // Any filter change goes back to the first page.
  const refilter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setPage(1)
    }

  const askHelp = async (id: number) => {
    if (!np || !answers) return
    answers.set(id, 'loading')
    setVersion((v) => v + 1)
    try {
      const r = await api<{ text: string }>('/api/trophy-tip', { np, trophyId: id })
      answers.set(id, r.text)
      modelWorkDone()
    } catch (e) {
      answers.delete(id)
      if (!(e instanceof ApiError && e.handled)) toast(translate('help.failed'))
    }
    setVersion((v) => v + 1)
  }

  const goTo = (n: number) => {
    paged.current = true
    setPage(n)
  }

  const visiblePages = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - current) <= 1,
  )

  return (
    <>
      <h2>
        {t('heading')}{' '}
        <span id={`${prefix}-count`} className="muted">
          {catalogOnly ? `(${scope.length})` : `(${earned}/${scope.length})`}
        </span>
      </h2>
      {list.length === 0 ? (
        <EmptyState>{t('empty')}</EmptyState>
      ) : (
        <>
          <div className="trophy-controls" ref={controlsRef}>
            <label className="trophy-search">
              <Icon name="search" />
              <input
                aria-label={t('search')}
                id={`${prefix}-search`}
                placeholder={t('searchPlaceholder')}
                value={q}
                onChange={(e) => refilter(setQ)(e.target.value)}
              />
            </label>
            <div className="trophy-toolbar">
              {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would restyle the segmented control; the group role names it */}
              <div className="trophy-status" role="group" aria-label={t('statusLabel')}>
                {(['all', 'pending', 'earned'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    data-status={value}
                    aria-pressed={status === value}
                    onClick={() => refilter(setStatus)(value)}
                  >
                    {t(`status.${value}`)}
                  </button>
                ))}
              </div>
              <details className="trophy-options">
                <summary>
                  <Icon name="layers" /> {t('filters')}{' '}
                  <span id={`${prefix}-filter-count`}>
                    {filterCount ? String(filterCount) : ''}
                  </span>
                  <Icon name="chevron-down" />
                </summary>
                <div className="trophy-options-body">
                  <label>
                    {t('sortBy')}
                    <select
                      id={`${prefix}-sort`}
                      value={sort}
                      onChange={(e) => refilter(setChosenSort)(e.target.value)}
                    >
                      {(
                        ['psn', 'pending', 'progress', 'date', 'rarity', 'common', 'type'] as const
                      ).map((value) => (
                        <option key={value} value={value}>
                          {t(`sort.${value}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label id={`${prefix}-group-label`} hidden={!hasDlc}>
                    {t('content')}
                    <select
                      id={`${prefix}-group`}
                      value={group}
                      onChange={(e) => refilter(setGroup)(e.target.value as Group)}
                    >
                      <option value="base">{t('group.base')}</option>
                      <option value="all">{t('group.all')}</option>
                      <option value="dlc">{t('group.dlc')}</option>
                    </select>
                  </label>
                  <label className="trophy-progress-filter">
                    <input
                      type="checkbox"
                      id={`${prefix}-only-progress`}
                      checked={onlyProgress}
                      onChange={(e) => refilter(setOnlyProgress)(e.target.checked)}
                    />{' '}
                    {t('onlyProgress')}
                  </label>
                </div>
              </details>
            </div>
          </div>
          <div className="trophy-results" id={`${prefix}-results`} role="status">
            {shown.length
              ? t('results', {
                  from: start + 1,
                  to: Math.min(start + TROPHY_PAGE_SIZE, shown.length),
                  total: shown.length,
                  group:
                    hasDlc && group === 'dlc'
                      ? t('group.dlcShort')
                      : hasDlc && group === 'all'
                        ? t('group.all')
                        : t('group.base'),
                })
              : t('noResults')}
          </div>
          <div className="trophy-rows" id={`${prefix}-list`}>
            {shown.length ? (
              shown
                .slice(start, start + TROPHY_PAGE_SIZE)
                .map((t) => <TrophyCard key={t.id} t={t} answers={answers} onHelp={askHelp} />)
            ) : (
              <div className="trophy-empty">{t('noResultsHint')}</div>
            )}
          </div>
          <nav
            className="trophy-pagination"
            id={`${prefix}-pagination`}
            aria-label={t('pages')}
            hidden={pages <= 1}
            ref={pagerRef}
          >
            <button
              type="button"
              aria-label={t('previousPage')}
              disabled={current === 1}
              onClick={() => goTo(current - 1)}
            >
              <Icon name="chevron-down" />
            </button>
            <div className="trophy-page-numbers">
              {visiblePages.map((n, i) => (
                <PageNumber
                  key={n}
                  n={n}
                  gap={i > 0 && n - visiblePages[i - 1] > 1}
                  current={n === current}
                  onClick={() => goTo(n)}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label={t('nextPage')}
              disabled={current === pages}
              onClick={() => goTo(current + 1)}
            >
              <Icon name="chevron-down" />
            </button>
          </nav>
        </>
      )}
    </>
  )
}

function PageNumber({
  n,
  gap,
  current,
  onClick,
}: {
  n: number
  gap: boolean
  current: boolean
  onClick: () => void
}) {
  const t = useMessages(messages)
  return (
    <>
      {gap && <span className="page-gap">…</span>}
      <button
        type="button"
        aria-label={t('page', { n })}
        aria-current={current ? 'page' : undefined}
        onClick={onClick}
      >
        {n}
      </button>
    </>
  )
}
