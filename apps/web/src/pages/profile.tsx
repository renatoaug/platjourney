/** Profile page: level, platinums with search and pages, and the account cards. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Page } from '../app/page'
import { AccountCards } from '../components/account'
import { titleHref } from '../components/tip'
import { defineMessages, getLocale, Language, useMessages } from '../i18n/i18n'
import { ApiError, api } from '../lib/api'
import { compact, fmtHours, fmtLong, fmtRate, number, pct } from '../lib/format'
import type { Game, Me, ProfileSummary } from '../lib/types'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { Pager } from '../ui/pager'
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
    levelLabel: 'Nível',
    tabs: { label: 'Seções do perfil', profile: 'Meu perfil', settings: 'Configurações' },
    levelProgress: '{progress}% para o {next}',
    pace: 'SEU RITMO',
    byYear: 'Platinas por ano',
    most: { eyebrow: 'SEU TEMPO', title: 'Mais jogados' },
    noDataTitle: 'Sem platinas para contar',
    noData: 'O seu ritmo por ano aparece aqui depois da primeira platina.',
    tiles: {
      platinums: 'Platinas',
      inYear: '{count} em {year}',
      trophies: 'Troféus',
      gold: 'Ouro',
      silver: 'Prata',
      bronze: 'Bronze',
      hours: 'Horas jogadas',
      hoursShort: 'Horas',
      hoursSub: '{days} dias de jogo',
      rarest: 'Platina mais rara',
      rarestSub: '{rate}% de quem joga tem',
      bestMonth: 'Melhor mês',
      platinumShort: 'plat.',
      platinumUnit: { one: 'platina', other: 'platinas' },
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
    },
  },
  [Language.En]: {
    loadFailed: 'Could not load the profile.',
    levelLabel: 'Level',
    tabs: { label: 'Profile sections', profile: 'My profile', settings: 'Settings' },
    levelProgress: '{progress}% to {next}',
    pace: 'YOUR PACE',
    byYear: 'Platinums per year',
    most: { eyebrow: 'YOUR TIME', title: 'Most played' },
    noDataTitle: 'No platinums to count',
    noData: 'Your pace per year shows up here after the first platinum.',
    tiles: {
      platinums: 'Platinums',
      inYear: '{count} in {year}',
      trophies: 'Trophies',
      gold: 'Gold',
      silver: 'Silver',
      bronze: 'Bronze',
      hours: 'Hours played',
      hoursShort: 'Hours',
      hoursSub: '{days} days of play',
      rarest: 'Rarest platinum',
      rarestSub: '{rate}% of players have it',
      bestMonth: 'Best month',
      platinumShort: 'plat.',
      platinumUnit: { one: 'platinum', other: 'platinums' },
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

const PAGE_SIZE = 10

// Kept across visits, like the rest of the app's filters.
let platinumPage = 1
// The open tab, kept while the app is open, like the page of platinums.
let profileTab: 'profile' | 'settings' = 'profile'
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
  const [tab, setTab] = useState<'profile' | 'settings'>(profileTab)
  useEffect(() => {
    profileTab = tab
  }, [tab])
  return (
    <>
      <div className="card profile-hero profile-identity">
        <img className="profile-avatar" src={s.avatarUrl || undefined} alt="" />
        <div className="profile-name">
          <h1>{s.onlineId}</h1>
          {/* On a phone the level sits under the name; the level tile is hidden there. */}
          <p className="profile-level-line">
            <b>
              {t('levelLabel')} {s.level}
            </b>
            <span className="bar small">
              <i style={{ width: `${pct(s.levelProgress)}%` }} />
            </span>
            {t('levelProgress', { progress: s.levelProgress, next: s.level + 1 })}
          </p>
          <p className="profile-platforms">
            {d.byPlatform
              .map((p) => `${p.platform.replace('PSPC', 'PC').replaceAll(',', '/')} ${p.count}`)
              .join(' · ')}
          </p>
        </div>
        <section className="profile-tiles">
          <div className="tile plat">
            <div className="tile-label">
              <Icon name="trophy" className="stat-icon" /> {t('tiles.platinums')}
            </div>
            <b>
              <span className="stat-full">{number(s.earned.platinum)}</span>
              <span className="stat-short">{compact(s.earned.platinum)}</span>
            </b>
            <div className="sub">{t('tiles.inYear', { count: yearCount, year: thisYear })}</div>
          </div>
          <div className="tile">
            <div className="tile-label">
              <Icon name="trophy" className="stat-icon" /> {t('tiles.trophies')}
            </div>
            <b>
              <span className="stat-full">{number(total)}</span>
              <span className="stat-short">{compact(total)}</span>
            </b>
            <div className="sub trophy-counts">
              {(['gold', 'silver', 'bronze'] as const).map((type) => (
                <span key={type} className={type} title={t(`tiles.${type}`)}>
                  <Icon name="trophy" />
                  <span className="trophy-count">{number(s.earned[type])}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="tile">
            <div className="tile-label">
              <Icon name="clock" className="stat-icon" />{' '}
              <span className="stat-full">{t('tiles.hours')}</span>
              <span className="stat-short">{t('tiles.hoursShort')}</span>
            </div>
            <b>
              <span className="stat-full">{number(d.totalHours)}</span>
              <span className="stat-short">{compact(d.totalHours)}</span>
            </b>
            <div className="sub">
              {t('tiles.hoursSub', { days: number(Math.round(d.totalHours / 24)) })}
            </div>
          </div>
          {d.fastestStreak && (
            <div className="tile">
              <div className="tile-label">
                <Icon name="clock" className="stat-icon" /> {t('tiles.bestMonth')}
              </div>
              <b>
                <span className="stat-full">
                  {d.fastestStreak.count}{' '}
                  <span className="stat-unit">
                    {t('tiles.platinumUnit', { count: d.fastestStreak.count })}
                  </span>
                </span>
                <span className="stat-short">
                  {d.fastestStreak.count}{' '}
                  <span className="stat-unit-short">{t('tiles.platinumShort')}</span>
                </span>
              </b>
              <div className="sub">
                {new Intl.DateTimeFormat(getLocale(), { month: 'short', year: 'numeric' }).format(
                  new Date(d.fastestStreak.to),
                )}
              </div>
            </div>
          )}
          {/* The level, last and in the accent color, with the same three lines as the numbers before it. */}
          <div className="tile profile-level">
            <div className="tile-label">
              <Icon name="bolt" className="stat-icon" /> {t('levelLabel')}
            </div>
            <b>{s.level}</b>
            <div className="sub">
              <span className="bar small">
                <i style={{ width: `${pct(s.levelProgress)}%` }} />
              </span>
              {t('levelProgress', { progress: s.levelProgress, next: s.level + 1 })}
            </div>
          </div>
        </section>
      </div>
      <div className="profile-tabs" role="tablist" aria-label={t('tabs.label')}>
        {(['profile', 'settings'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`profile-tab-${key}`}
            aria-controls={`profile-panel-${key}`}
            aria-selected={tab === key}
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key)}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>
      {tab === 'settings' ? (
        <div
          className="profile-settings"
          role="tabpanel"
          id="profile-panel-settings"
          aria-labelledby="profile-tab-settings"
        >
          <AccountCards user={d.user} onChanged={onChanged} onEditing={onEditing} />
        </div>
      ) : (
        <div role="tabpanel" id="profile-panel-profile" aria-labelledby="profile-tab-profile">
          <div className="profile-layout">
            <div className="profile-band">
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
              {d.mostPlayed.length > 0 && (
                <div className="card profile-most">
                  <span className="eyebrow">{t('most.eyebrow')}</span>
                  <h2>{t('most.title')}</h2>
                  <ol>
                    {d.mostPlayed.slice(0, 3).map((m) => (
                      <li key={m.game.id}>
                        <Link to={titleHref(m.game.id)}>
                          <Cover url={m.game.cover_url} name={m.game.name} className="plat-cover" />
                          <span>{m.game.name}</span>
                          <b>{fmtHours(m.hours)}</b>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="profile-band-side">
                {d.rarest && (
                  <Link className="card profile-rarest" to={titleHref(d.rarest.game.id)}>
                    <Cover
                      url={d.rarest.game.cover_url}
                      name={d.rarest.game.name}
                      className="plat-cover"
                    />
                    <span>
                      <span className="eyebrow">{t('tiles.rarest')}</span>
                      <b>{d.rarest.game.name}</b>
                      <small className="muted">
                        {t('tiles.rarestSub', { rate: fmtRate(d.rarest.rarity) })}
                      </small>
                    </span>
                  </Link>
                )}
                <PluginSlot name="profile" />
              </div>
            </div>
            <PlatinumCollection
              platinums={d.platinums}
              pending={d.pendingPlatinums}
              onSearching={onSearching}
            />
          </div>
        </div>
      )}
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
  const matches = platinums.filter((p) => lower(p.game.name).includes(lower(query.trim())))
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const start = (current - 1) * PAGE_SIZE

  useEffect(() => {
    platinumPage = current
  }, [current])

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
          <div id="platinum-list" className="collection-grid">
            {matches.length ? (
              matches.slice(start, start + PAGE_SIZE).map((p) => (
                <Link key={p.game.id} className="collection-tile" to={titleHref(p.game.id)}>
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
          <Pager
            page={current}
            size={PAGE_SIZE}
            total={matches.length}
            label={t('collection.pages')}
            onPage={(to) => {
              setPage(to)
              searchRef.current?.scrollIntoView({ block: 'center' })
            }}
          />
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

export function ProfileSkeleton() {
  const t = useMessages(messages)
  return (
    <>
      <div className="card profile-hero profile-identity">
        <Sk w="64px" h={64} style={{ borderRadius: '50%', flex: 'none' }} />
        <div className="profile-name">
          <Sk w="200px" h={30} />
          <Sk w="160px" h={11} style={{ marginTop: 10 }} />
        </div>
        {/* Five numbers, the level last, as a full profile shows in its header. */}
        <section className="profile-tiles">
          {Array.from({ length: 5 }, (_, i) => tileSkeleton(i))}
        </section>
      </div>
      <div className="profile-tabs">
        <Sk w="80px" h={12} style={{ margin: '12px' }} />
        <Sk w="90px" h={12} style={{ margin: '12px' }} />
      </div>
      <div className="profile-layout">
        <div className="profile-band">
          <div className="card">
            <h2>{t('byYear')}</h2>
            <div className="years">
              {repeat(8, (i) => (
                <div className="year">
                  <Sk
                    w="100%"
                    h={12 + ((i * 37) % 60)}
                    style={{
                      maxWidth: 28,
                      borderRadius: 'var(--radius-tag) var(--radius-tag) 0 0',
                    }}
                  />
                  <Sk w="28px" h={9} />
                </div>
              ))}
            </div>
          </div>
          <div className="card profile-most">
            <h2>{t('most.title')}</h2>
            <ol>
              {repeat(3, () => (
                <li>
                  <span className="profile-most-row">
                    <Sk
                      w="28px"
                      h={36}
                      style={{ borderRadius: 'var(--radius-tag)', flex: 'none' }}
                    />
                    <Sk w="60%" h={12} />
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="profile-band-side">
            <div className="card">
              <Sk w="60%" h={12} />
              <Sk w="40%" h={10} style={{ marginTop: 10 }} />
            </div>
          </div>
        </div>
        <div className="card platinum-collection">
          <h2 className="goal-section-title">{t('collection.title')}</h2>
          <div className="collection-grid">
            {repeat(10, () => (
              <div className="collection-tile">
                <Sk w="100%" h={0} style={{ aspectRatio: '3 / 4', height: 'auto' }} />
                <Sk w="80%" h={11} />
                <Sk w="60%" h={9} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
