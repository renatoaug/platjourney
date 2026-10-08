/** Guides: every game with a platinum guide, or any catalog game by name, filtered by platform, sorted and paged. */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Page } from '../app/page'
import { titleHref } from '../components/tip'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { Pager } from '../ui/pager'
import { repeat, Sk } from '../ui/skeleton'
import { EmptyState, ErrorState } from '../ui/states'
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
            <span title={t('difficulty')}>
              <Icon name="target" /> {g.difficulty}/10
            </span>
            <span title={t('hours')}>
              <Icon name="clock" /> ~{g.hours}h
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

/** `load` answers a query string with a page of games; stories pass sample data instead of the API. */
export function Guides({
  load: loadPage = fetchGuides,
}: {
  load?: (query: string) => Promise<GuidesPage>
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
