/** Game detail for a title outside the current game (owned or recommended). */

import { type ReactNode, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { useInterests } from '../app/use-interests'
import { useDemo } from '../components/demo'
import { type GameStore, StoreOffer } from '../components/game-showcase'
import { Short } from '../components/hero'
import { Journey, JourneySkeleton } from '../components/journey'
import { PlanCard } from '../components/plan'
import { SimilarGamesSection, similarGames } from '../components/similar-games'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import type { CurrentGame, DeepGuideStats, Game, GuideDetail, Trophy } from '../lib/types'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import { EmptyState, ErrorState } from '../ui/states'
import './title.css'

const messages = defineMessages({
  [Language.PtBR]: {
    saved: 'Nos interesses',
    remove: 'Remover dos interesses',
    save: 'Salvar nos interesses',
    saveShort: 'Salvar',
    trophies: 'Troféus',
    trophiesPendingTitle: 'Buscando a lista de troféus',
    trophiesPending:
      'A lista deste jogo ainda está chegando da PSN. Volte em breve para ver cada troféu.',
    back: 'Voltar',
    notFound: 'Não achamos esse jogo.',
  },
  [Language.En]: {
    saved: 'In interests',
    remove: 'Remove from interests',
    save: 'Save to interests',
    saveShort: 'Save',
    trophies: 'Trophies',
    trophiesPendingTitle: 'Fetching the trophy list',
    trophiesPending:
      "This game's list is still on its way from PSN. Come back soon to see each trophy.",
    back: 'Back',
    notFound: "We couldn't find this game.",
  },
})

/** What /api/title sends. Games not owned have no progress, and their trophies come from the catalog. */
export interface TitleDetail {
  owned: boolean
  focus?: CurrentGame['focus']
  np?: string
  game: Game
  name: string
  platform: string
  icon?: string | null
  cover?: string | null
  hoursPlayed?: number | null
  progress?: number
  earned?: number
  total?: number
  groups?: CurrentGame['groups']
  trophies: Trophy[] | null
  guide: GuideDetail | null
  deepGuide?: DeepGuideStats | null
  /** A game the player does not have: where to buy it and its sale when known. */
  store?: GameStore
  /** The guide is being researched: the page polls until it lands. */
  building: boolean
  /** The player used today's new guides; this one waits until tomorrow. */
  /** No guide yet and nothing researching it now: it waits on the list to be written. */
  queued?: boolean
}

// The route is /title/<kind>/<value>: game/<catalog id>, id/<PSN list id> or name/<name>.
function titleQuery(spec: string, search: string) {
  const [kind, ...rest] = spec.split('/')
  const value = decodeURIComponent(rest.join('/'))
  const platform = new URLSearchParams(search).get('platform') ?? 'PS5'
  const query =
    kind === 'game'
      ? `game=${encodeURIComponent(value.split('?')[0])}`
      : kind === 'id'
        ? `id=${encodeURIComponent(value)}`
        : `name=${encodeURIComponent(value.split('?')[0])}&platform=${encodeURIComponent(platform)}`
  return { query }
}

function SaveButton({ d }: { d: TitleDetail }) {
  const t = useMessages(messages)
  const { find, toggle } = useInterests()
  const demo = useDemo()
  const [busy, setBusy] = useState(false)
  const saved = !!find(d.game.id)
  return (
    <button
      type="button"
      className={`button ${saved ? 'secondary' : ''}`}
      id="title-goal-add"
      aria-pressed={saved}
      title={saved ? t('remove') : undefined}
      disabled={busy || demo}
      onClick={async () => {
        setBusy(true)
        await toggle(d.game.id, d.name, 'title')
        setBusy(false)
      }}
    >
      <Icon name={saved ? 'bookmark-filled' : 'bookmark'} />{' '}
      {saved ? t('saved') : <Short long={t('save')} short={t('saveShort')} />}
    </button>
  )
}

/** Any game opened by link: the one game page, with the player's progress when it is in the
 * library, else in its catalog mode with its actions (save, ask Nexo, the store) and, while PSN
 * does not list it yet, a note in place of the trophies. */
function TitleGame({ d, similar, back }: { d: TitleDetail; similar?: ReactNode; back: ReactNode }) {
  const t = useMessages(messages)
  const owned = !!(d.owned && d.np)
  const game: CurrentGame = {
    ...d,
    np: d.np ?? '',
    progress: d.progress ?? 0,
    earned: d.earned ?? 0,
    total: d.total ?? d.trophies?.length ?? 0,
    trophies: d.trophies ?? [],
    icon: d.icon ?? undefined,
  }
  if (owned)
    return (
      <Journey game={game} plan={<PlanCard key={d.np} np={d.np} />} similar={similar} back={back} />
    )
  return (
    <Journey
      game={game}
      similar={similar}
      back={back}
      catalog={
        <div className="game-overview-cta">
          <SaveButton d={d} />
          {d.store && <StoreOffer store={d.store} />}
        </div>
      }
      trophies={
        d.trophies?.length ? undefined : (
          <div className="card title-trophies-pending" id="title-trophies">
            <h2 className="trophy-heading">
              <Icon name="trophy" />
              {t('trophies')}
            </h2>
            <EmptyState
              className="title-trophies-wait"
              icon="clock"
              title={t('trophiesPendingTitle')}
            >
              {t('trophiesPending')}
            </EmptyState>
          </div>
        )
      }
    />
  )
}

type TitleLoad = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; d: TitleDetail }

/** The screen for a given load state; `similar` goes under the game ("Parecidos com este"). */
export function TitleScreen({ load, similar }: { load: TitleLoad; similar?: ReactNode }) {
  const t = useMessages(messages)
  const navigate = useNavigate()
  // Back goes where the player came from (Guides, Discover, the library); a page opened from a
  // link, with nothing before it in the app, falls back to Discover.
  const opened = useLocation().key === 'default'
  const back = (
    <Link
      className="text-link back-link"
      to="/discover"
      onClick={(e) => {
        if (opened) return
        e.preventDefault()
        navigate(-1)
      }}
    >
      <Icon name="arrow" /> {t('back')}
    </Link>
  )
  return (
    <Page path="/title">
      {load.kind !== 'ready' && (
        <div className="game-page-actions">
          {back}
          {load.kind === 'loading' && <Sk w="130px" h={44} />}
        </div>
      )}
      <div id="title-page">
        {load.kind === 'loading' && <JourneySkeleton />}
        {load.kind === 'error' && <ErrorState>{t('notFound')}</ErrorState>}
        {load.kind === 'ready' && <TitleGame d={load.d} similar={similar} back={back} />}
      </div>
    </Page>
  )
}

export function Title() {
  const spec = useParams()['*'] ?? ''
  const { search } = useLocation()
  const { query } = titleQuery(spec, search)
  const { cache } = useApp()
  const key = `title:${query}`
  const cached = () => cache[key] as TitleDetail | undefined
  const [load, setLoad] = useState<TitleLoad>(() => {
    const d = cached()
    return d ? { kind: 'ready', d } : { kind: 'loading' }
  })

  // Fetch the title, then poll every 6 s while its guide is being researched. A title seen before
  // shows at once and is refreshed in place, without the skeleton.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key follows the query
  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const seen = cached()
    setLoad(seen ? { kind: 'ready', d: seen } : { kind: 'loading' })
    const fetchTitle = async () => {
      try {
        const d = await api<TitleDetail>(`/api/title?${query}`)
        if (!live) return
        cache[key] = d
        setLoad({ kind: 'ready', d })
        if (d.building) timer = setTimeout(fetchTitle, 6000)
      } catch {
        // A failed refresh keeps what was already on screen.
        if (live && !cached()) setLoad({ kind: 'error' })
      }
    }
    fetchTitle()
    // A catalog game's similar games need only its id: asked now, beside the title, not after it.
    const game = new URLSearchParams(query).get('game')
    if (game) similarGames(cache, game).catch(() => {})
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query])

  // The catalog's name ("Days Gone"), not the trophy list's ("DAYS GONE").
  const name = load.kind === 'ready' ? (load.d.game?.name ?? load.d.name) : null
  // The tab shows the game's name (the shell leaves game pages to it); until it is known, the tab
  // keeps the page the player came from.
  useEffect(() => {
    if (!name) return
    const previous = document.title
    document.title = `${name} · PlatJourney`
    return () => {
      document.title = previous
    }
  }, [name])

  return (
    <TitleScreen
      load={load}
      similar={load.kind === 'ready' && <SimilarGamesSection gameId={load.d.game.id} />}
    />
  )
}
