/** Guides: every game with a platinum guide, or any catalog game by name, filtered by platform, sorted and paged. */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Page } from '../app/page'
import { titleHref } from '../components/tip'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
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
    title: 'Guias',
    lead: 'Todos os jogos com guia de platina. Busque qualquer jogo pelo nome.',
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
    title: 'Guides',
    lead: 'Every game with a platinum guide. Search any game by name.',
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

export interface GuideCardItem {
  id: string
  name: string
  cover_url: string | null
  platforms: string[]
  release_year: number | null
  guide: {
    difficulty: number
    hours: number
    hasMissables: boolean
    hasOnline: boolean
    unobtainable: string | null
  } | null
}
export interface GuidesPage {
  page: number
  size: number
  total: number
  items: GuideCardItem[]
}
type Load = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: GuidesPage }

export function GuideCard({ item }: { item: GuideCardItem }) {
  const t = useMessages(messages)
  const g = item.guide
  return (
    <Link className="guide-tile" to={titleHref(item.id)}>
      <Cover url={item.cover_url} name={item.name} className="guide-tile-cover" />
      <div className="guide-tile-body">
        <h3>{item.name}</h3>
        <span className="guide-tile-sub">
          {[item.platforms.join(' · '), item.release_year].filter(Boolean).join(' · ')}
        </span>
        {g ? (
          <span className="guide-tile-meta">
            {/* 0 means the sources do not say yet. */}
            <span title={t('difficulty')}>
              <Icon name="target" /> {g.difficulty ? `${g.difficulty}/10` : '—'}
            </span>
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
          </span>
        ) : (
          <span className="guide-tile-meta muted">{t('noGuide')}</span>
        )}
        {g?.unobtainable && <span className="pill danger">{t('unobtainable')}</span>}
      </div>
    </Link>
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

  useEffect(() => {
    let live = true
    const query = new URLSearchParams()
    if (q) query.set('q', q)
    if (platform) query.set('platform', platform)
    if (sort) query.set('sort', sort)
    if (page > 1) query.set('page', String(page))
    setLoad((l) => (l.status === 'ok' ? l : { status: 'loading' }))
    loadPage(String(query))
      .then((data) => live && setLoad({ status: 'ok', data }))
      .catch(() => live && setLoad({ status: 'error' }))
    return () => {
      live = false
    }
  }, [q, platform, sort, page, loadPage])

  const searching = q.length >= 2
  return (
    <Page path="/guides">
      <div className="page-head">
        <div>
          <h1>{t('title')}</h1>
          <p>{t('lead')}</p>
        </div>
      </div>
      <div className="trophy-controls guides-controls">
        <label className="trophy-search">
          <Icon name="search" />
          <input
            type="search"
            aria-label={t('search')}
            placeholder={t('searchPlaceholder')}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </label>
        <div className="trophy-toolbar">
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
        </div>
      </div>
      {load.status === 'loading' && <GuideGridSkeleton />}
      {load.status === 'error' && <ErrorState>{t('failed')}</ErrorState>}
      {load.status === 'ok' && (
        <>
          <div className="trophy-results" role="status">
            {t('results', { count: load.data.total })}
          </div>
          {load.data.items.length ? (
            <div className="guide-grid">
              {load.data.items.map((item) => (
                <GuideCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState>
              <b>{t('empty')}</b> {t('emptyHint')}
              {searching && <MissingGame key={q} name={q} ask={ask} />}
            </EmptyState>
          )}
          <Pager
            page={load.data.page}
            size={load.data.size}
            total={load.data.total}
            onPage={(to) => {
              change({ page: to > 1 ? String(to) : '' })
              window.scrollTo({ top: 0 })
            }}
          />
        </>
      )}
    </Page>
  )
}
