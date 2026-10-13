/** Guides: every game with a platinum guide, or any catalog game by name, filtered by platform, sorted and paged. */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Page } from '../app/page'
import { DifficultyMeter } from '../components/difficulty-meter'
import { GENRES_PT } from '../components/game-showcase'
import { titleHref } from '../components/tip'
import { defineMessages, Language, useLocale, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { Pager } from '../ui/pager'
import { repeat, Sk } from '../ui/skeleton'
import { EmptyState, ErrorState } from '../ui/states'
import { toast } from '../ui/toast'
import '../components/trophy-list.css'
import './guides.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'GUIAS DE PLATINA',
    title: 'Guias',
    lead: 'Todos os jogos com guia de platina. Busque qualquer jogo pelo nome.',
    filters: 'Filtros',
    filtersOn: { one: 'Filtros · {count}', other: 'Filtros · {count}' },
    clear: 'Limpar filtros',
    bandLabel: 'Dificuldade',
    band: { easy: 'Fácil', medium: 'Média', hard: 'Difícil', brutal: 'Muito difícil' },
    hoursLabel: 'Tempo até a platina',
    hoursUpTo: 'Até {hours}h',
    rulesLabel: 'Como é a platina',
    noMissables: 'Sem perdíveis',
    onePlaythrough: 'Uma jogada só',
    noOnline: 'Sem troféus online',
    genreLabel: 'Gênero',
    viewLabel: 'Ver como',
    view: { grid: 'Grade', list: 'Lista' },
    search: 'Buscar jogo',
    searchPlaceholder: 'Nome do jogo…',
    platformLabel: 'Plataforma',
    platform: { all: 'Todas' },
    sortLabel: 'Ordenar por',
    sort: {
      relevance: 'Mais relevantes',
      rating: 'Mais bem avaliados',
      name: 'Nome (A–Z)',
      easiest: 'Mais fáceis',
      shortest: 'Mais rápidos',
    },
    results: {
      one: '{count} jogo',
      other: '{count} jogos',
    },
    difficulty: 'Dificuldade',
    hours: 'Horas até a platina',
    missables: 'Tem troféus perdíveis',
    online: 'Tem troféus online',
    noGuide: 'Sem guia ainda',
    unobtainable: 'Platina indisponível',
    empty: 'Nenhum jogo encontrado.',
    emptyHint: 'Tente outro nome ou outra plataforma.',
    missing: 'Pedir “{name}”',
    missingHint: 'Ainda não está aqui? Peça e ele entra no catálogo.',
    missingAsking: 'Procurando “{name}”…',
    missingRequested:
      'Ainda não temos “{name}”. O pedido ficou registrado para o jogo entrar no catálogo.',
    missingToast: 'Pedido de “{name}” registrado.',
    missingAlready:
      'Você já pediu “{name}”. Vamos atrás do jogo, e ele aparecerá aqui assim que entrar no catálogo.',
    missingFailed: 'Não deu para procurar agora. Tente de novo em instantes.',
    failed: 'Não conseguimos carregar os guias. Recarregue a página.',
  },
  [Language.En]: {
    eyebrow: 'PLATINUM GUIDES',
    title: 'Guides',
    lead: 'Every game with a platinum guide. Search any game by name.',
    filters: 'Filters',
    filtersOn: { one: 'Filters · {count}', other: 'Filters · {count}' },
    clear: 'Clear filters',
    bandLabel: 'Difficulty',
    band: { easy: 'Easy', medium: 'Medium', hard: 'Hard', brutal: 'Very hard' },
    hoursLabel: 'Time to the platinum',
    hoursUpTo: 'Up to {hours}h',
    rulesLabel: 'What the platinum asks',
    noMissables: 'No missables',
    onePlaythrough: 'One playthrough',
    noOnline: 'No online trophies',
    genreLabel: 'Genre',
    viewLabel: 'View as',
    view: { grid: 'Grid', list: 'List' },
    search: 'Search games',
    searchPlaceholder: 'Game name…',
    platformLabel: 'Platform',
    platform: { all: 'All' },
    sortLabel: 'Sort by',
    sort: {
      relevance: 'Most relevant',
      rating: 'Best rated',
      name: 'Name (A–Z)',
      easiest: 'Easiest',
      shortest: 'Shortest',
    },
    results: {
      one: '{count} game',
      other: '{count} games',
    },
    difficulty: 'Difficulty',
    hours: 'Hours to the platinum',
    missables: 'Has missable trophies',
    online: 'Has online trophies',
    noGuide: 'No guide yet',
    unobtainable: 'Platinum unavailable',
    empty: 'No game found.',
    emptyHint: 'Try another name or platform.',
    missing: 'Request “{name}”',
    missingHint: 'Not here yet? Ask and it joins the catalog.',
    missingAsking: 'Looking up “{name}”…',
    missingRequested:
      'We do not have “{name}” yet. The request was saved so the game can join the catalog.',
    missingToast: 'Request for “{name}” saved.',
    missingAlready:
      'You already asked for “{name}”. We will look for it, and it will show up here once it joins the catalog.',
    missingFailed: 'The lookup failed. Try again in a moment.',
    failed: 'We could not load the guides. Reload the page.',
  },
})

const PLATFORMS = ['PS5', 'PS4', 'PS3', 'PS Vita'] as const
const SORTS = ['rating', 'name', 'easiest', 'shortest'] as const

const BANDS = ['easy', 'medium', 'hard', 'brutal'] as const
const HOURS = ['10', '25', '50', '100'] as const
const RULES = ['noMissables', 'onePlaythrough', 'noOnline'] as const
const FILTER_KEYS = ['difficulty', 'hours', 'genre', ...RULES] as const

export interface GuideCardItem {
  id: string
  name: string
  cover_url: string | null
  platforms: string[]
  release_year: number | null
  genres?: string[]
  shot?: string | null
  guide: {
    difficulty: number
    hours: number
    playthroughs?: number
    hasMissables: boolean
    hasOnline: boolean
    unobtainable: string | null
  } | null
}
export interface GuideFacets {
  difficulty: Record<(typeof BANDS)[number], number>
  hours: Record<string, number>
  noMissables: number
  onePlaythrough: number
  noOnline: number
  genres: { name: string; count: number }[]
}
export interface GuidesPage {
  page: number
  size: number
  total: number
  items: GuideCardItem[]
  facets?: GuideFacets
  /** Covers of the best rated games with a guide, for the page's top. */
  collage?: string[]
}
type Load = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: GuidesPage }

/** The guide's facts in one line: difficulty bar (unless the card shows it on its art), hours and
 * the warning icons. */
function Facts({ g, meter = true }: { g: NonNullable<GuideCardItem['guide']>; meter?: boolean }) {
  const t = useMessages(messages)
  return (
    <>
      {/* 0 means the sources do not say yet. */}
      {meter &&
        (g.difficulty ? (
          <DifficultyMeter value={g.difficulty} look="compact" />
        ) : (
          <span title={t('difficulty')}>
            <Icon name="target" /> —
          </span>
        ))}
      <span title={t('hours')}>
        <Icon name="clock" /> {g.hours ? `~${g.hours}h` : '—'}
      </span>
      {g.hasMissables && (
        <span role="img" title={t('missables')} aria-label={t('missables')}>
          <Icon name="warning" />
        </span>
      )}
      {g.hasOnline && (
        <span role="img" title={t('online')} aria-label={t('online')}>
          <Icon name="globe" />
        </span>
      )}
    </>
  )
}

export function GuideCard({ item }: { item: GuideCardItem }) {
  const t = useMessages(messages)
  const g = item.guide
  return (
    <Link className="guide-tile" to={titleHref(item.id)}>
      <span className="guide-tile-art">
        <Cover url={item.cover_url} name={item.name} className="guide-tile-cover" />
        {g && g.difficulty > 0 && (
          <span className="guide-tile-score">
            <DifficultyMeter value={g.difficulty} />
          </span>
        )}
      </span>
      <div className="guide-tile-body">
        <h3>{item.name}</h3>
        <span className="guide-tile-sub">
          {[item.platforms.join(' · '), item.release_year].filter(Boolean).join(' · ')}
        </span>
        {g ? (
          <span className="guide-tile-meta">
            <Facts g={g} meter={false} />
          </span>
        ) : (
          <span className="guide-tile-meta muted">{t('noGuide')}</span>
        )}
        {g?.unobtainable && <span className="pill danger">{t('unobtainable')}</span>}
      </div>
    </Link>
  )
}

/** The same game as a row: for the list view. */
export function GuideRow({ item }: { item: GuideCardItem }) {
  const t = useMessages(messages)
  const g = item.guide
  return (
    <Link className="guide-row" to={titleHref(item.id)}>
      <Cover url={item.cover_url} name={item.name} className="guide-row-cover" />
      <span className="guide-row-name">
        <b>{item.name}</b>
        <span className="guide-tile-sub">
          {[item.platforms.join(' · '), item.release_year].filter(Boolean).join(' · ')}
        </span>
      </span>
      {g ? (
        <span className="guide-tile-meta guide-row-meta">
          <Facts g={g} />
        </span>
      ) : (
        <span className="guide-tile-meta muted">{t('noGuide')}</span>
      )}
      <Icon name="arrow-right" className="guide-row-go" />
    </Link>
  )
}

/** One filter option, the same row everywhere: a mark, the name, and how many games it leaves.
 * A round mark picks one of a group; a square one turns a rule on or off. */
function Option({
  label,
  count,
  on,
  round = false,
  band,
  onToggle,
}: {
  label: string
  count?: number
  on: boolean
  round?: boolean
  band?: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`guide-option${band ? ` band-${band}` : ''}`}
      aria-pressed={on}
      onClick={onToggle}
    >
      <span className={`guide-option-mark${round ? ' round' : ''}`} aria-hidden="true">
        {on && !round && <Icon name="check" />}
      </span>
      <span className="guide-option-label">{label}</span>
      {count != null && <span className="guide-option-count">{count}</span>}
    </button>
  )
}

/** The filters beside the list: each option shows how many games it would leave. */
function GuideFilters({
  facets,
  values,
  onChange,
}: {
  facets?: GuideFacets
  values: Record<string, string>
  onChange: (next: Record<string, string>) => void
}) {
  const t = useMessages(messages)
  const locale = useLocale()
  const active = FILTER_KEYS.filter((k) => values[k]).length
  const pick = (key: string, value: string) =>
    onChange({ [key]: values[key] === value ? '' : value })
  return (
    <div className="guide-filters">
      <fieldset>
        <legend>{t('bandLabel')}</legend>
        {BANDS.map((b) => (
          <Option
            key={b}
            round
            band={b}
            label={t(`band.${b}`)}
            count={facets?.difficulty[b]}
            on={values.difficulty === b}
            onToggle={() => pick('difficulty', b)}
          />
        ))}
      </fieldset>
      <fieldset>
        <legend>{t('hoursLabel')}</legend>
        {HOURS.map((h) => (
          <Option
            key={h}
            round
            label={t('hoursUpTo', { hours: h })}
            count={facets?.hours[h]}
            on={values.hours === h}
            onToggle={() => pick('hours', h)}
          />
        ))}
      </fieldset>
      <fieldset>
        <legend>{t('rulesLabel')}</legend>
        {RULES.map((r) => (
          <Option
            key={r}
            label={t(r)}
            count={facets?.[r]}
            on={values[r] === '1'}
            onToggle={() => onChange({ [r]: values[r] === '1' ? '' : '1' })}
          />
        ))}
      </fieldset>
      {facets && facets.genres.length > 0 && (
        <fieldset>
          <legend>{t('genreLabel')}</legend>
          {facets.genres.map((g) => (
            <Option
              key={g.name}
              round
              label={locale === Language.PtBR ? (GENRES_PT[g.name] ?? g.name) : g.name}
              count={g.count}
              on={values.genre === g.name}
              onToggle={() => pick('genre', g.name)}
            />
          ))}
        </fieldset>
      )}
      {active > 0 && (
        <button
          type="button"
          className="button ghost sm guide-filter-clear"
          onClick={() => onChange(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])))}
        >
          <Icon name="close" /> {t('clear')}
        </button>
      )}
    </div>
  )
}

function GuideGridSkeleton() {
  return (
    <div className="guide-grid" aria-hidden="true">
      {repeat(12, () => (
        <div className="guide-tile">
          <span className="guide-tile-cover sk" />
          <div className="guide-tile-body">
            <Sk w="85%" h={24} />
            <Sk w="50%" h={12} />
            <Sk w="65%" h={18} />
          </div>
        </div>
      ))}
    </div>
  )
}

const fetchGuides = (query: string) => api<GuidesPage>(`/api/guides?${query}`)

/** What the server answers when asked for a game the catalog lacks. */
export interface GameRequestAnswer {
  game?: string
  requested?: boolean
  /** This account had asked for the name before. */
  already?: boolean
}

const askForGame = (name: string) => api<GameRequestAnswer>('/api/games/request', { name })

/** A search that found nothing offers to look the name up in the full game database: a game it
 * knows opens right away, and a name it does not know is left as a request. */
function MissingGame({
  name,
  ask,
}: {
  name: string
  ask: (name: string) => Promise<GameRequestAnswer>
}) {
  const t = useMessages(messages)
  const navigate = useNavigate()
  const [state, setState] = useState<'idle' | 'asking' | 'requested' | 'already' | 'failed'>('idle')
  if (state === 'requested' || state === 'already')
    return (
      <p className="guides-missing guides-missing-done" role="status">
        <span className="guides-missing-check">
          <Icon name="check" />
        </span>
        {t(state === 'already' ? 'missingAlready' : 'missingRequested', { name })}
      </p>
    )
  return (
    <div className="guides-missing">
      <button
        type="button"
        className="button ghost sm guides-missing-button"
        disabled={state === 'asking'}
        onClick={() => {
          setState('asking')
          ask(name)
            .then((answer) => {
              if (answer.game) navigate(titleHref(answer.game))
              else if (answer.already) setState('already')
              else {
                setState('requested')
                toast(t('missingToast', { name }), 'success')
              }
            })
            .catch(() => setState('failed'))
        }}
      >
        <Icon name="plus" />
        {t(state === 'asking' ? 'missingAsking' : 'missing', { name })}
      </button>
      {state === 'failed' ? (
        <span className="guides-missing-error" role="alert">
          {t('missingFailed')}
        </span>
      ) : (
        <span className="guides-missing-hint">{t('missingHint')}</span>
      )}
    </div>
  )
}

/** `load` answers a query string with a page of games; stories pass sample data instead of the API. */
export function Guides({
  load: loadPage = fetchGuides,
  ask = askForGame,
}: {
  load?: (query: string) => Promise<GuidesPage>
  ask?: (name: string) => Promise<GameRequestAnswer>
}) {
  const t = useMessages(messages)
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const platform = params.get('platform') ?? ''
  const sort = params.get('sort') ?? ''
  const page = Number(params.get('page')) || 1
  const view = params.get('view') === 'list' ? 'list' : 'grid'
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']))
  const filterKey = FILTER_KEYS.map((k) => filters[k]).join('|')
  const activeFilters = FILTER_KEYS.filter((k) => filters[k]).length
  // The filters stand beside the list on a wide screen and fold away on a phone.
  const [filtersOpen, setFiltersOpen] = useState(
    () => typeof window === 'undefined' || !window.matchMedia?.('(max-width: 760px)').matches,
  )
  const [typed, setTyped] = useState(q)
  // The address changed from outside the field (the Guides link in the menu, back, a link):
  // the field follows it, or the pending search below would put the old text back.
  const [seen, setSeen] = useState(q)
  if (q !== seen) {
    setSeen(q)
    if (typed.trim() !== q) setTyped(q)
  }
  const [load, setLoad] = useState<Load>({ status: 'loading' })

  // Every change goes to the address, so a link or the back button gives the same list.
  const change = (next: Record<string, string>) =>
    setParams(
      (current) => {
        const out = new URLSearchParams(current)
        for (const [key, value] of Object.entries(next)) {
          if (value) out.set(key, value)
          else out.delete(key)
        }
        if (!('page' in next)) out.delete('page')
        return out
      },
      { replace: !('page' in next) },
    )

  // The search waits for a pause in typing.
  useEffect(() => {
    if (typed === q) return
    const timer = setTimeout(() => change({ q: typed.trim() }), 300)
    return () => clearTimeout(timer)
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: filterKey stands for every filter
  useEffect(() => {
    let live = true
    const query = new URLSearchParams()
    if (q) query.set('q', q)
    if (platform) query.set('platform', platform)
    if (sort) query.set('sort', sort)
    if (page > 1) query.set('page', String(page))
    for (const k of FILTER_KEYS) if (filters[k]) query.set(k, filters[k])
    setLoad((l) => (l.status === 'ok' ? l : { status: 'loading' }))
    loadPage(String(query))
      .then((data) => live && setLoad({ status: 'ok', data }))
      .catch(() => live && setLoad({ status: 'error' }))
    return () => {
      live = false
    }
  }, [q, platform, sort, page, filterKey, loadPage])

  const searching = q.length >= 2
  const data = load.status === 'ok' ? load.data : null
  // The top's collage stays as it was while a new page loads.
  const [collage, setCollage] = useState<string[]>([])
  if (data?.collage?.length && data.collage !== collage) setCollage(data.collage)
  return (
    <Page path="/guides">
      <section className="guides-hero">
        {collage.length > 0 && (
          <div className="guides-hero-collage" aria-hidden="true">
            {collage.map((url) => (
              <img key={url} src={url} alt="" loading="lazy" />
            ))}
          </div>
        )}
        <div className="guides-hero-inner">
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
          <p>{t('lead')}</p>
          <label className="guides-hero-search">
            <Icon name="search" />
            <input
              type="search"
              aria-label={t('search')}
              placeholder={t('searchPlaceholder')}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
        </div>
      </section>
      <div className="guides-layout">
        <details
          className="guides-aside"
          open={filtersOpen}
          onToggle={(e) => setFiltersOpen(e.currentTarget.open)}
        >
          <summary>
            <Icon name="layers" />{' '}
            {activeFilters ? t('filtersOn', { count: activeFilters }) : t('filters')}
          </summary>
          <GuideFilters facets={data?.facets} values={filters} onChange={change} />
        </details>
        <div className="guides-main">
          <div className="guides-toolbar">
            {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would restyle the segmented control; the group role names it */}
            <div className="trophy-status" role="group" aria-label={t('platformLabel')}>
              {['', ...PLATFORMS].map((value) => (
                <button
                  key={value || 'all'}
                  type="button"
                  aria-pressed={platform === value}
                  onClick={() => change({ platform: value })}
                >
                  {value || t('platform.all')}
                </button>
              ))}
            </div>
            <div className="guides-toolbar-end">
              <label className="guides-sort">
                <select
                  aria-label={t('sortLabel')}
                  value={sort}
                  onChange={(e) => change({ sort: e.target.value })}
                >
                  <option value="">{t(searching ? 'sort.relevance' : 'sort.rating')}</option>
                  {SORTS.filter((s) => searching || s !== 'rating').map((s) => (
                    <option key={s} value={s}>
                      {t(`sort.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
              {/* biome-ignore lint/a11y/useSemanticElements: a pair of toggle buttons; the group role names it */}
              <div className="guides-view" role="group" aria-label={t('viewLabel')}>
                {(['grid', 'list'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    aria-label={t(`view.${v}`)}
                    data-tip={t(`view.${v}`)}
                    onClick={() => change({ view: v === 'grid' ? '' : v, page: String(page) })}
                  >
                    <Icon name={v} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          {load.status === 'loading' && <GuideGridSkeleton />}
          {load.status === 'error' && <ErrorState>{t('failed')}</ErrorState>}
          {data && (
            <>
              <div className="trophy-results" role="status">
                {t('results', { count: data.total })}
              </div>
              {data.items.length ? (
                view === 'list' ? (
                  <div className="guide-list">
                    {data.items.map((item) => (
                      <GuideRow key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="guide-grid">
                    {data.items.map((item) => (
                      <GuideCard key={item.id} item={item} />
                    ))}
                  </div>
                )
              ) : (
                <EmptyState>
                  <b>{t('empty')}</b> {t('emptyHint')}
                  {searching && <MissingGame key={q} name={q} ask={ask} />}
                </EmptyState>
              )}
              <Pager
                page={data.page}
                size={data.size}
                total={data.total}
                onPage={(to) => {
                  change({ page: to > 1 ? String(to) : '' })
                  window.scrollTo({ top: 0 })
                }}
              />
            </>
          )}
        </div>
      </div>
    </Page>
  )
}
