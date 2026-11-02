import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { useKept } from '../components/goals/use-kept'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import { pct } from '../lib/format'
import type { OwnedLibrary, YearGoals } from '../lib/types'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { Pager } from '../ui/pager'
import { repeat, Sk } from '../ui/skeleton'
import { EmptyState, ErrorState } from '../ui/states'
import { GoalsSkeleton, GoalsView } from './goals'
import './games.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Seus jogos',
    lead: 'Escolha um jogo para acompanhar a platina.',
    library: 'Biblioteca PSN',
    interests: 'Interesses',
    goals: 'Metas e conquistas',
    tabs: 'Seus jogos',
    source: 'Progresso conforme sua preferência de DLC.',
    base: 'Jogo base',
    all: 'Jogo base + DLC',
    psn: 'Progresso PSN · divisão de DLC indisponível',
    search: 'Buscar na biblioteca PSN',
    count: { one: '{count} jogo na biblioteca', other: '{count} jogos na biblioteca' },
    empty: 'Sua biblioteca PSN ainda está vazia.',
    emptyBody:
      'Os jogos com troféus sincronizados da sua conta aparecem aqui. Confira a conexão com a PSN nas configurações.',
    settings: 'Ver conexão PSN',
    none: 'Nenhum jogo com esse nome.',
    clear: 'Limpar busca',
    error: 'Não conseguimos carregar sua biblioteca.',
    retry: 'Tentar novamente',
    open: 'Abrir jornada',
    openLabel: 'Abrir jornada de {name}',
    trophies: '{earned} de {total} troféus',
    progress: 'Progresso de troféus de {name}',
    current: 'Jogando agora',
    platinum: 'Platina conquistada',
    zero: 'Nenhum troféu conquistado',
    saved:
      'Jogos que você salvou para lembrar depois. Estar aqui não significa que o jogo está na sua biblioteca.',
    manage: 'Organizar interesses',
    noInterests: 'Nenhum interesse salvo ainda.',
    find: 'Descobrir jogos',
    view: 'Ver jogo',
    viewLabel: 'Ver {name}',
    savedGame: 'Interesse salvo',
  },
  [Language.En]: {
    title: 'Your games',
    lead: 'Choose a game to follow your platinum journey.',
    library: 'PSN library',
    interests: 'Interests',
    goals: 'Goals and achievements',
    tabs: 'Your games',
    source: 'Progress follows your DLC preference.',
    base: 'Base game',
    all: 'Base game + DLC',
    psn: 'PSN progress · DLC breakdown unavailable',
    search: 'Search your PSN library',
    count: { one: '{count} game in your library', other: '{count} games in your library' },
    empty: 'Your PSN library is empty.',
    emptyBody:
      'Games with synced trophies from your account appear here. Check your PSN connection in settings.',
    settings: 'Check PSN connection',
    none: 'No games with that name.',
    clear: 'Clear search',
    error: 'Could not load your library.',
    retry: 'Try again',
    open: 'Open journey',
    openLabel: 'Open journey for {name}',
    trophies: '{earned} of {total} trophies',
    progress: 'Trophy progress for {name}',
    current: 'Playing now',
    platinum: 'Platinum earned',
    zero: 'No trophies earned',
    saved: 'Games you saved for later. Being here does not mean a game is in your library.',
    manage: 'Organize interests',
    noInterests: 'No saved interests yet.',
    find: 'Discover games',
    view: 'View game',
    viewLabel: 'View {name}',
    savedGame: 'Saved interest',
  },
})

export function Games() {
  const { data, sync, me } = useApp()
  const [params, setParams] = useSearchParams()
  const [keptSide, setKeptSide] = useKept<'library' | 'interests' | 'goals'>(
    'games.side',
    'library',
  )
  const tab = params.get('tab')
  const side = tab === 'library' || tab === 'interests' || tab === 'goals' ? tab : keptSide
  const setSide = (value: 'library' | 'interests' | 'goals') => {
    setKeptSide(value)
    setParams((before) => {
      const next = new URLSearchParams(before)
      next.set('tab', value)
      return next
    })
  }
  const [query, setQuery] = useKept('games.query', '')
  const [page, setPage] = useKept('games.page', 1)
  const [library, setLibrary] = useState<OwnedLibrary | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry deliberately refreshes the request
  useEffect(() => {
    if (side !== 'library') return
    let active = true
    setLibrary(null)
    setFailed(false)
    const timer = setTimeout(
      () => {
        api<OwnedLibrary>(
          `/api/library?scope=owned&page=${page}&q=${encodeURIComponent(query.trim())}`,
        )
          .then((value) => {
            if (active) setLibrary(value)
          })
          .catch(() => {
            if (active) setFailed(true)
          })
      },
      query ? 200 : 0,
    )
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [side, query, page, attempt, me.includeDlcProgress])
  return (
    <GamesView
      library={library}
      failed={failed}
      side={side}
      onSide={setSide}
      query={query}
      onQuery={(value) => {
        setQuery(value)
        setPage(1)
      }}
      onPage={setPage}
      onRetry={() => setAttempt((v) => v + 1)}
      goals={data?.goals}
      readOnly={me.demo === true}
      interestsFailed={!data && sync === 'failed'}
    />
  )
}

export function GamesView({
  library,
  failed = false,
  side = 'library',
  onSide,
  query = '',
  onQuery,
  onPage,
  onRetry,
  goals,
  readOnly = false,
  interestsFailed = false,
}: {
  library: OwnedLibrary | null
  failed?: boolean
  side?: 'library' | 'interests' | 'goals'
  onSide: (side: 'library' | 'interests' | 'goals') => void
  query?: string
  onQuery: (query: string) => void
  onPage: (page: number) => void
  onRetry: () => void
  goals?: YearGoals
  readOnly?: boolean
  interestsFailed?: boolean
}) {
  const t = useMessages(messages)
  return (
    <Page path="/games">
      <div className="games-page">
        <header>
          <h1>{t('title')}</h1>
          <p>{t('lead')}</p>
        </header>
        <fieldset className="segmented" aria-label={t('tabs')}>
          {(['library', 'interests', 'goals'] as const).map((key) => (
            <button key={key} type="button" aria-pressed={side === key} onClick={() => onSide(key)}>
              {t(key)}
            </button>
          ))}
        </fieldset>
        {side === 'library' ? (
          <LibrarySection
            library={library}
            failed={failed}
            query={query}
            onQuery={onQuery}
            onRetry={onRetry}
            onPage={onPage}
          />
        ) : (
          <InterestsSection
            side={side}
            goals={goals}
            failed={interestsFailed}
            readOnly={readOnly}
          />
        )}
      </div>
    </Page>
  )
}

function GamesSkeleton() {
  return (
    <div className="games-list">
      {repeat(3, () => (
        <article className="games-item">
          <div className="games-art">
            <Sk w="100%" h={180} />
          </div>
          <div className="games-item-info">
            <Sk w="40%" h={12} />
            <Sk w="80%" h={22} />
            <Sk w="100%" h={8} />
            <Sk w="130px" h={20} />
          </div>
        </article>
      ))}
    </div>
  )
}

function LibrarySection({
  library,
  failed,
  query,
  onQuery,
  onRetry,
  onPage,
}: {
  library: OwnedLibrary | null
  failed: boolean
  query: string
  onQuery: (query: string) => void
  onRetry: () => void
  onPage: (page: number) => void
}) {
  const t = useMessages(messages)
  return (
    <section className="games-library" aria-label={t('library')}>
      <label className="games-search">
        <Icon name="search" />
        <input
          type="search"
          aria-label={t('search')}
          placeholder={t('search')}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </label>
      {failed ? (
        <ErrorState>
          <p>{t('error')}</p>
          <button type="button" onClick={onRetry}>
            {t('retry')}
          </button>
        </ErrorState>
      ) : !library ? (
        <GamesSkeleton />
      ) : (
        <>
          <p className="games-result" role="status">
            {t('count', { count: library.total })}
            <span>{t('source')}</span>
          </p>
          {!library.items.length ? (
            <EmptyState
              icon="gamepad"
              title={query ? t('none') : t('empty')}
              action={
                query ? (
                  <button type="button" onClick={() => onQuery('')}>
                    {t('clear')}
                  </button>
                ) : (
                  <Link className="button" to="/settings">
                    {t('settings')}
                  </Link>
                )
              }
            >
              {!query && t('emptyBody')}
            </EmptyState>
          ) : (
            <div className="games-list">
              {library.items.map((g) => (
                <LibraryRow key={g.np} item={g} />
              ))}
            </div>
          )}
          <Pager page={library.page} size={library.size} total={library.total} onPage={onPage} />
        </>
      )}
    </section>
  )
}

/** Decorative art stays lazy; missing or failed images keep a lettered surface. */
function GamesArt({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  return src && failed !== src ? (
    <img
      className="games-art"
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(src)}
    />
  ) : (
    <Cover name={name} className="games-art games-art-placeholder" />
  )
}

function LibraryRow({ item: g }: { item: OwnedLibrary['items'][number] }) {
  const t = useMessages(messages)
  return (
    <article className="games-item">
      <GamesArt src={g.art ?? g.cover ?? g.icon} name={g.name} />
      <div className="games-item-info">
        <span className="games-platform">
          {g.platform}
          {g.current ? ` · ${t('current')}` : ''}
        </span>
        <h2>{g.name}</h2>
        <p>
          {g.platinum
            ? t('platinum')
            : g.earned === 0
              ? t('zero')
              : t('trophies', { earned: g.earned, total: g.total })}
        </p>
        {g.progressScope && <small className="games-progress-scope">{t(g.progressScope)}</small>}
        <div className="games-progress">
          <span
            className="bar"
            role="progressbar"
            aria-label={t('progress', { name: g.name })}
            aria-valuenow={pct(g.progress ?? 0)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i style={{ width: `${pct(g.progress ?? 0)}%` }} />
          </span>
          <b>{pct(g.progress ?? 0)}%</b>
        </div>
        <Link
          className="games-open"
          aria-label={t('openLabel', { name: g.name })}
          to={`/title/id/${encodeURIComponent(g.np)}`}
        >
          {t('open')}
          <Icon name="chevron-right" />
        </Link>
      </div>
    </article>
  )
}

function InterestsSection({
  side,
  goals,
  failed,
  readOnly,
}: {
  side: 'interests' | 'goals'
  goals?: YearGoals
  failed: boolean
  readOnly: boolean
}) {
  const t = useMessages(messages)
  return (
    <section
      className={side === 'goals' ? 'games-goals' : 'games-interests'}
      aria-label={t(side)}
      id="goals"
    >
      {side === 'interests' && <p className="games-description">{t('saved')}</p>}
      {failed ? (
        <ErrorState>{t('error')}</ErrorState>
      ) : !goals ? (
        <GoalsSkeleton />
      ) : (
        <GoalsView goals={goals} compact section={side} readOnly={readOnly} />
      )}
    </section>
  )
}
