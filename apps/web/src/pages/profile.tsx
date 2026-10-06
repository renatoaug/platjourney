/** Profile page: level, platinums with search and pages, and the account cards. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Page } from '../app/page'
import { AccountCards, AccountSkeleton } from '../components/account'
import { titleHref } from '../components/tip'
import { defineMessages, getLocale, Language, useMessages } from '../i18n/i18n'
import { ApiError, api } from '../lib/api'
import { fmtDate, fmtHours, fmtLong, fmtRate, number, pct } from '../lib/format'
import type { Game, Me, ProfileSummary } from '../lib/types'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { PluginSlot } from '../ui/plugin-slot'
import { repeat, Sk } from '../ui/skeleton'
import { EmptyState, ErrorState, PendingState } from '../ui/states'
import '../components/goals/year-platinums.css'
import '../components/trophy-list.css'
import './goals.css'
import './profile.css'

const messages = defineMessages({
  [Language.PtBR]: {
    loadFailed: 'Não conseguimos carregar o perfil.',
    eyebrow: 'SUA HISTÓRIA NOS JOGOS',
    level: 'NÍVEL',
    levelProgress: '{progress}% para o {next}',
    pace: 'SEU RITMO',
    byYear: 'Platinas por ano',
    noDataTitle: 'Sem platinas para contar',
    noData: 'O seu ritmo por ano aparece aqui depois da primeira platina.',
    all: 'Todas as platinas',
    tiles: {
      platinums: 'Platinas',
      inYear: '{count} em {year}',
      trophies: 'Troféus',
      trophiesSub: '{gold} ouro · {silver} prata · {bronze} bronze',
      hours: 'Horas jogadas',
      mostPlayed: 'mais jogado: {name} ({hours})',
      rarest: 'Platina mais rara',
      rarestSub: '{rate}% de quem joga tem',
      bestMonth: 'Melhor mês',
      bestMonthSub: 'platinas entre {from} e {to}',
    },
    collection: {
      eyebrow: 'SUA COLEÇÃO',
      title: 'Platinas',
      searchLabel: 'Buscar platina',
      placeholder: 'Buscar na sua coleção',
      range: {
        one: '{from}–{to} de {count} platinas',
        other: '{from}–{to} de {count} platinas',
      },
      none: 'Nenhuma platina encontrada',
      pending: {
        one: 'Buscando a data de mais {count} platinas na PSN…',
        other: 'Buscando a data de mais {count} platinas na PSN…',
      },
      rarity: '{rate}% de quem joga',
      played: '{hours} jogadas',
      tryAnother: 'Tente buscar por outro jogo.',
      syncing: 'Sua coleção está sendo sincronizada.',
      emptyTitle: 'Nenhuma platina ainda',
      empty: 'Sua primeira platina vai aparecer aqui, com a data e a raridade.',
      pages: 'Páginas de platinas',
      previous: 'Anterior',
      page: '{current} de {pages}',
      next: 'Próxima',
    },
  },
  [Language.En]: {
    loadFailed: 'Could not load the profile.',
    eyebrow: 'YOUR GAMING STORY',
    level: 'LEVEL',
    levelProgress: '{progress}% to {next}',
    pace: 'YOUR PACE',
    byYear: 'Platinums per year',
    noDataTitle: 'No platinums to count',
    noData: 'Your pace per year shows up here after the first platinum.',
    all: 'All platinums',
    tiles: {
      platinums: 'Platinums',
      inYear: '{count} in {year}',
      trophies: 'Trophies',
      trophiesSub: '{gold} gold · {silver} silver · {bronze} bronze',
      hours: 'Hours played',
      mostPlayed: 'most played: {name} ({hours})',
      rarest: 'Rarest platinum',
      rarestSub: '{rate}% of players have it',
      bestMonth: 'Best month',
      bestMonthSub: 'platinums between {from} and {to}',
    },
    collection: {
      eyebrow: 'YOUR COLLECTION',
      title: 'Platinums',
      searchLabel: 'Search platinums',
      placeholder: 'Search your collection',
      range: {
        one: '{from}–{to} of {count} platinum',
        other: '{from}–{to} of {count} platinums',
      },
      none: 'No platinum found',
      pending: {
        one: 'Fetching the date of {count} more platinum from PSN…',
        other: 'Fetching the date of {count} more platinums from PSN…',
      },
      rarity: '{rate}% of players',
      played: '{hours} played',
      tryAnother: 'Try searching for another game.',
      syncing: 'Your collection is syncing.',
      emptyTitle: 'No platinum yet',
      empty: 'Your first platinum will show up here, with its date and rarity.',
      pages: 'Platinum pages',
      previous: 'Previous',
      page: '{current} of {pages}',
      next: 'Next',
    },
  },
})

export interface Platinum {
  game: Game
  platform: string
  earnedAt: string
  rarity: number
  trophyName?: string
  hours?: number | null
}

/** /api/profile */
export interface ProfileData {
  summary: ProfileSummary
  platinums: Platinum[]
  pendingPlatinums: number
  byYear: { year: number; count: number }[]
  byPlatform: { platform: string; count: number }[]
  rarest: Platinum | null
  fastestStreak: { from: string; to: string; count: number } | null
  totalHours: number
  mostPlayed: { game: Game; hours: number }[]
  user: Me
}

type Load =
  | { kind: 'loading' }
  | { kind: 'error' }
  // Trophies hidden: no profile to show, but the account must still be reachable.
  | { kind: 'account'; user: Me }
  | { kind: 'ready'; data: ProfileData }

const PAGE_SIZE = 6

// Kept across visits, like the rest of the app's filters.
let platinumPage = 1
let platinumQuery = ''

const lower = (s: string) => s.toLocaleLowerCase(getLocale())

export function Profile() {
  const t = useMessages(messages)
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const editing = useRef(false)
  const searching = useRef(false)

  // quiet: refresh in place, without the skeleton (used while platinums arrive).
  const fetchProfile = useCallback(async (quiet = false) => {
    if (!quiet) setLoad({ kind: 'loading' })
    try {
      const d = await api<ProfileData>('/api/profile')
      setLoad({ kind: 'ready', data: d })
    } catch (e) {
      const me =
        e instanceof ApiError && e.code === 'trophies_private'
          ? await api<{ user: Me }>('/api/me').catch(() => null)
          : null
      setLoad(me ? { kind: 'account', user: me.user } : { kind: 'error' })
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  // Keep the list growing while PSN dates arrive, but never under an open form or a search in progress.
  // Each arrival is a new object, so the wait restarts after every refresh.
  const syncing = load.kind === 'ready' && load.data.pendingPlatinums > 0 ? load.data : null
  useEffect(() => {
    if (!syncing) return
    let timer: ReturnType<typeof setTimeout>
    const wait = () => {
      timer = setTimeout(() => {
        if (editing.current || searching.current) wait()
        else fetchProfile(true)
      }, 8000)
    }
    wait()
    return () => clearTimeout(timer)
  }, [syncing, fetchProfile])

  const onEditing = useCallback((open: boolean) => {
    editing.current = open
  }, [])
  const reload = useCallback(() => fetchProfile(), [fetchProfile])

  return (
    <Page path="/profile">
      <div id="profile-page">
        {load.kind === 'loading' && <ProfileSkeleton />}
        {load.kind === 'error' && <ErrorState>{t('loadFailed')}</ErrorState>}
        {load.kind === 'account' && (
          <div className="grid cols-2">
            <div className="stack">
              <AccountCards user={load.user} onChanged={reload} onEditing={onEditing} />
            </div>
          </div>
        )}
        {load.kind === 'ready' && (
          <ProfileView
            data={load.data}
            onChanged={reload}
            onEditing={onEditing}
            onSearching={(on) => {
              searching.current = on
            }}
          />
        )}
      </div>
    </Page>
  )
}

export function ProfileView({
  data: d,
  onChanged,
  onEditing,
  onSearching,
}: {
  data: ProfileData
  onChanged: () => void
  onEditing?: (editing: boolean) => void
  onSearching?: (focused: boolean) => void
}) {
  const t = useMessages(messages)
  const s = d.summary
  const total = s.earned.bronze + s.earned.silver + s.earned.gold + s.earned.platinum
  const thisYear = new Date().getFullYear()
  const yearCount = d.byYear.find((y) => y.year === thisYear)?.count ?? 0
  const maxYear = Math.max(1, ...d.byYear.map((y) => y.count))
  const top = d.mostPlayed[0]
  return (
    <>
      <div className="card profile-hero profile-identity">
        <img className="profile-avatar" src={s.avatarUrl || undefined} alt="" />
        <div className="grow">
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1>{s.onlineId}</h1>
          <div className="meta" style={{ marginTop: 8 }}>
            {d.byPlatform.map((p) => (
              <span key={p.platform} className="pill">
                {p.platform} · {p.count}
              </span>
            ))}
          </div>
        </div>
        <div className="level">
          <span className="eyebrow">{t('level')}</span>
          <b>{s.level}</b>
          <div className="bar small">
            <i style={{ width: `${pct(s.levelProgress)}%` }} />
          </div>
          <small className="muted">
            {t('levelProgress', { progress: s.levelProgress, next: s.level + 1 })}
          </small>
        </div>
      </div>
      <section className="tiles profile-tiles" style={{ margin: '16px 0' }}>
        <div className="tile plat">
          <div className="tile-label">
            <Icon name="trophy" className="stat-icon" /> {t('tiles.platinums')}
          </div>
          <b>{number(s.earned.platinum)}</b>
          <div className="sub">{t('tiles.inYear', { count: yearCount, year: thisYear })}</div>
        </div>
        <div className="tile">
          <div className="tile-label">
            <Icon name="trophy" className="stat-icon" /> {t('tiles.trophies')}
          </div>
          <b>{number(total)}</b>
          <div className="sub">
            {t('tiles.trophiesSub', {
              gold: number(s.earned.gold),
              silver: number(s.earned.silver),
              bronze: number(s.earned.bronze),
            })}
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">
            <Icon name="clock" className="stat-icon" /> {t('tiles.hours')}
          </div>
          <b>{number(d.totalHours)}</b>
          <div className="sub">
            {top ? t('tiles.mostPlayed', { name: top.game.name, hours: fmtHours(top.hours) }) : ''}
          </div>
        </div>
        {d.rarest && (
          <div className="tile">
            <div className="tile-label">
              <Icon name="trophy" className="stat-icon" /> {t('tiles.rarest')}
            </div>
            <b style={{ fontSize: 20, lineHeight: 1.3 }}>{d.rarest.game.name}</b>
            <div className="sub">{t('tiles.rarestSub', { rate: fmtRate(d.rarest.rarity) })}</div>
          </div>
        )}
        {d.fastestStreak && (
          <div className="tile">
            <div className="tile-label">
              <Icon name="clock" className="stat-icon" /> {t('tiles.bestMonth')}
            </div>
            <b>{d.fastestStreak.count}</b>
            <div className="sub">
              {t('tiles.bestMonthSub', {
                from: fmtDate(d.fastestStreak.from),
                to: fmtDate(d.fastestStreak.to),
              })}
            </div>
          </div>
        )}
      </section>
      <div className="profile-layout">
        <PlatinumCollection
          platinums={d.platinums}
          pending={d.pendingPlatinums}
          onSearching={onSearching}
        />
        <div className="stack profile-sidebar">
          <div className="card">
            <span className="eyebrow">{t('pace')}</span>
            <h2>{t('byYear')}</h2>
            {d.byYear.length ? (
              <div className="years">
                {d.byYear.map((y) => (
                  <div key={y.year} className="year">
                    <b>{y.count}</b>
                    <i style={{ height: `${Math.round((y.count / maxYear) * 120)}px` }} />
                    <small>{y.year}</small>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="dashboard" title={t('noDataTitle')}>
                {t('noData')}
              </EmptyState>
            )}
          </div>
          <AccountCards user={d.user} onChanged={onChanged} onEditing={onEditing} />
          <PluginSlot name="profile" />
        </div>
      </div>
    </>
  )
}

function PlatinumCollection({
  platinums,
  pending,
  onSearching,
}: {
  platinums: Platinum[]
  pending: number
  onSearching?: (focused: boolean) => void
}) {
  const t = useMessages(messages)
  const [query, setQuery] = useState(platinumQuery)
  const [page, setPage] = useState(platinumPage)
  const searchRef = useRef<HTMLInputElement>(null)
  const prevRef = useRef<HTMLButtonElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  // After a page turn: bring the list back into view and keep focus on the button pressed.
  const stepped = useRef<number | null>(null)

  const matches = platinums.filter((p) => lower(p.game.name).includes(lower(query.trim())))
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const start = (current - 1) * PAGE_SIZE

  useEffect(() => {
    platinumPage = current
  }, [current])

  useEffect(() => {
    if (stepped.current === null) return
    const step = stepped.current
    stepped.current = null
    searchRef.current?.scrollIntoView({ block: 'center' })
    ;(step < 0 ? prevRef : nextRef).current?.focus({ preventScroll: true })
  })

  const turn = (step: number) => {
    stepped.current = step
    setPage(current + step)
  }

  return (
    <div className="card platinum-collection">
      <div className="collection-heading">
        <div>
          <span className="eyebrow">{t('collection.eyebrow')}</span>
          <h2 className="goal-section-title">
            {t('collection.title')} <span>{platinums.length}</span>
          </h2>
        </div>
        <Icon name="trophy" />
      </div>
      {/* No platinum yet: nothing to search or count, only what will show up here. */}
      {platinums.length === 0 && !pending ? (
        <EmptyState icon="trophy" title={t('collection.emptyTitle')}>
          {t('collection.empty')}
        </EmptyState>
      ) : (
        <>
          <label className="trophy-search">
            <Icon name="search" />
            <input
              id="platinum-search"
              ref={searchRef}
              aria-label={t('collection.searchLabel')}
              placeholder={t('collection.placeholder')}
              value={query}
              onFocus={() => onSearching?.(true)}
              onBlur={() => onSearching?.(false)}
              onChange={(e) => {
                platinumQuery = e.target.value
                setQuery(e.target.value)
                setPage(1)
              }}
            />
          </label>
          <div id="platinum-results" className="trophy-results" role="status">
            {matches.length
              ? t('collection.range', {
                  from: start + 1,
                  to: Math.min(start + PAGE_SIZE, matches.length),
                  count: matches.length,
                })
              : t('collection.none')}
          </div>
          {pending > 0 && (
            <PendingState>{t('collection.pending', { count: pending })}</PendingState>
          )}
          <div id="platinum-list">
            {matches.length ? (
              matches.slice(start, start + PAGE_SIZE).map((p) => (
                <Link key={p.game.id} className="collection-row" to={titleHref(p.game.id)}>
                  <Cover url={p.game.cover_url} name={p.game.name} className="plat-cover" />
                  <div>
                    <h3>{p.game.name}</h3>
                    <p>
                      {p.platform} <span>·</span>{' '}
                      {t('collection.rarity', { rate: fmtRate(p.rarity) })}
                      {p.hours != null && (
                        <>
                          {' '}
                          <span>·</span> {t('collection.played', { hours: fmtHours(p.hours) })}
                        </>
                      )}
                    </p>
                    <time dateTime={p.earnedAt}>{fmtLong(p.earnedAt)}</time>
                  </div>
                  <Icon name="arrow" />
                </Link>
              ))
            ) : (
              <EmptyState>
                {query
                  ? t('collection.tryAnother')
                  : pending
                    ? t('collection.syncing')
                    : t('collection.empty')}
              </EmptyState>
            )}
          </div>
          <nav
            id="platinum-pages"
            className="collection-pages"
            aria-label={t('collection.pages')}
            hidden={pages <= 1}
          >
            <button
              ref={prevRef}
              type="button"
              className="ghost sm"
              data-step="-1"
              disabled={current === 1}
              onClick={() => turn(-1)}
            >
              {t('collection.previous')}
            </button>
            <span>{t('collection.page', { current, pages })}</span>
            <button
              ref={nextRef}
              type="button"
              className="ghost sm"
              data-step="1"
              disabled={current === pages}
              onClick={() => turn(1)}
            >
              {t('collection.next')}
            </button>
          </nav>
        </>
      )}
    </div>
  )
}

const tileSkeleton = (i: number) => (
  <div key={i} className="tile">
    <div className="tile-label">
      <Sk w="55%" h={10} />
    </div>
    <Sk w="40%" h={30} style={{ marginTop: 10 }} />
    <Sk w="70%" h={9} style={{ marginTop: 10 }} />
  </div>
)

const rowSkeleton = () => (
  <div className="row">
    <span className="rank">
      <Sk w="14px" h={16} />
    </span>
    <Sk w="68px" h={44} style={{ borderRadius: 'var(--radius-tag)', flex: 'none' }} />
    <div className="grow">
      <Sk w="60%" h={12} />
      <Sk w="40%" h={10} style={{ marginTop: 8 }} />
      <Sk w="100%" h={3} style={{ marginTop: 10 }} />
    </div>
    <Sk w="34px" h={18} />
  </div>
)

export function ProfileSkeleton() {
  const t = useMessages(messages)
  return (
    <>
      <div className="card profile-hero">
        <Sk w="84px" h={84} style={{ borderRadius: '50%', flex: 'none' }} />
        <div className="grow">
          <Sk w="20%" h={9} />
          <Sk w="40%" h={34} style={{ marginTop: 8 }} />
          <div className="meta" style={{ marginTop: 12 }}>
            <Sk w="70px" h={22} />
            <Sk w="70px" h={22} />
          </div>
        </div>
        <div className="level">
          <Sk w="40px" h={9} />
          <Sk w="70px" h={40} style={{ marginTop: 6 }} />
          <Sk w="100%" h={6} style={{ marginTop: 10 }} />
        </div>
      </div>
      {/* Five tiles, as many as a full profile shows. */}
      <section className="tiles profile-tiles" style={{ margin: '16px 0' }}>
        {Array.from({ length: 5 }, (_, i) => tileSkeleton(i))}
      </section>
      <div className="grid cols-2">
        <div className="card">
          <h2 className="goal-section-title">{t('all')}</h2>
          {repeat(8, rowSkeleton)}
        </div>
        <div className="stack">
          <div className="card">
            <h2>{t('byYear')}</h2>
            <div className="years">
              {repeat(8, (i) => (
                <div className="year">
                  <Sk w="20px" h={12} />
                  <Sk
                    w="100%"
                    h={20 + ((i * 37) % 90)}
                    style={{
                      maxWidth: 44,
                      borderRadius: 'var(--radius-tag) var(--radius-tag) 0 0',
                    }}
                  />
                  <Sk w="30px" h={9} />
                </div>
              ))}
            </div>
          </div>
          <AccountSkeleton />
        </div>
      </div>
    </>
  )
}
