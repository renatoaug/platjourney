/** Game detail for a title outside the current game (owned or recommended). */

import { type ReactNode, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { useInterests } from '../app/use-interests'
import { useDemo } from '../components/demo'
import { DifficultyMeter } from '../components/difficulty-meter'
import { GameBackdrop, ScenesButton, useScene } from '../components/game-backdrop'
import { GameColumns } from '../components/game-columns'
import { GameNav, type GameSection } from '../components/game-nav'
import { GameAbout, type GameStore, StoreOffer } from '../components/game-showcase'
import { Guide, GuideSkeleton } from '../components/guide'
import {
  HeroProgress,
  HeroSkeleton,
  Short,
  TrophyBreakdown,
  UnobtainableBanner,
} from '../components/hero'
import { NextTrophy } from '../components/next-trophy'
import { SimilarGamesSection } from '../components/similar-games'
import { TrophyList, TrophyListSkeleton } from '../components/trophy-list'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { ApiError, api } from '../lib/api'
import { fmtHours } from '../lib/format'
import { tintStyle } from '../lib/tint'
import type { CurrentGame, DeepGuideStats, Game, GuideDetail, Trophy } from '../lib/types'
import { Icon } from '../ui/icon'
import { EmptyState, ErrorState } from '../ui/states'
import './title.css'
import { nexoHref } from '../components/tip'

const messages = defineMessages({
  [Language.PtBR]: {
    guidePreparing: 'Guia sendo preparado…',
    hoursOfGuide: '{played} jogadas de ~{hours}h',
    hoursOfGuideShort: '{played}/~{hours}h',
    hours: '~{hours} horas',
    hoursShort: '~{hours}h',
    playthroughs: {
      one: '{count} jornada',
      other: '{count} jornadas',
    },
    missables: 'Troféus perdíveis',
    missablesShort: 'Perdíveis',
    noMissables: 'Sem perdíveis',
    online: 'Troféus online',
    onlineShort: 'Online',
    saved: 'Nos interesses',
    remove: 'Remover dos interesses',
    save: 'Salvar nos interesses',
    trophies: 'Troféus',
    inLibrary: 'NA SUA BIBLIOTECA',
    talkToNexo: 'Conversar com o Nexo',
    askNexo: 'Perguntar ao Nexo sobre ele',
    trophiesPendingTitle: 'Buscando a lista de troféus',
    trophiesPending:
      'A lista deste jogo ainda está chegando da PSN. Volte em breve para ver cada troféu.',
    back: 'Voltar',
    notFound: 'Não achamos esse jogo.',
  },
  [Language.En]: {
    guidePreparing: 'Preparing the guide…',
    hoursOfGuide: '{played} played of ~{hours}h',
    hoursOfGuideShort: '{played}/~{hours}h',
    hours: '~{hours} hours',
    hoursShort: '~{hours}h',
    playthroughs: {
      one: '{count} playthrough',
      other: '{count} playthroughs',
    },
    missables: 'Missable trophies',
    missablesShort: 'Missables',
    noMissables: 'No missables',
    online: 'Online trophies',
    onlineShort: 'Online',
    saved: 'In interests',
    remove: 'Remove from interests',
    save: 'Save to interests',
    trophies: 'Trophies',
    inLibrary: 'IN YOUR LIBRARY',
    talkToNexo: 'Talk to Nexo',
    askNexo: 'Ask Nexo about it',
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
  return { query, owned: kind !== 'name' }
}

function TitleMeta({ d }: { d: TitleDetail }) {
  const t = useMessages(messages)
  const g = d.guide
  if (!g)
    return (
      <div className="meta">
        <span>{t('guidePreparing')}</span>
      </div>
    )
  return (
    <div className="meta">
      {/* 0 means the sources do not say yet: the fact is left out, never shown as 0. */}
      {g.difficulty > 0 && <DifficultyMeter value={g.difficulty} look="compact" />}
      {g.hours > 0 && (
        <span>
          <Icon name="clock" />{' '}
          {d.hoursPlayed != null ? (
            <Short
              long={t('hoursOfGuide', { played: fmtHours(d.hoursPlayed), hours: g.hours })}
              short={t('hoursOfGuideShort', { played: fmtHours(d.hoursPlayed), hours: g.hours })}
            />
          ) : (
            <Short
              long={t('hours', { hours: g.hours })}
              short={t('hoursShort', { hours: g.hours })}
            />
          )}
        </span>
      )}
      {g.playthroughs > 0 && (
        <span>
          <Icon name="gamepad" /> {t('playthroughs', { count: g.playthroughs })}
        </span>
      )}
      <span className={g.hasMissables ? 'warn' : 'ok'}>
        <Icon name={g.hasMissables ? 'warning' : 'shield'} />{' '}
        {g.hasMissables ? (
          <Short long={t('missables')} short={t('missablesShort')} />
        ) : (
          t('noMissables')
        )}
      </span>
      {g.hasOnline && (
        <span className="warn">
          <Icon name="trophy" /> <Short long={t('online')} short={t('onlineShort')} />
        </span>
      )}
    </div>
  )
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
      <Icon name={saved ? 'bookmark-filled' : 'bookmark'} /> {saved ? t('saved') : t('save')}
    </button>
  )
}

/** The skeleton of a title page: the two columns when the game is likely owned, the wide guide otherwise. */
function TitleSkeleton({ owned = true }: { owned?: boolean }) {
  const t = useMessages(messages)
  return (
    <>
      <div className="hero immersive">
        <HeroSkeleton />
      </div>
      {owned ? (
        <GameColumns
          style={{ marginTop: 20 }}
          trophies={
            <div className="card">
              <h2>{t('trophies')}</h2>
              <TrophyListSkeleton rows={6} />
            </div>
          }
          guide={
            <div className="stack">
              <div className="card">
                <GuideSkeleton />
              </div>
            </div>
          }
        />
      ) : (
        <div className="card guide-wide" style={{ marginTop: 20 }}>
          <GuideSkeleton />
        </div>
      )}
    </>
  )
}

/** The hero's foot: progress and the chat for a game in the library, saving and asking for one outside it. */
function HeroBottom({ d }: { d: TitleDetail }) {
  const t = useMessages(messages)
  if (d.owned)
    return (
      <div className="hero-bottom">
        <HeroProgress
          game={{
            earned: d.earned ?? 0,
            total: d.total ?? 0,
            progress: d.progress ?? 0,
            groups: d.groups,
            trophies: d.trophies,
          }}
        />
        <div className="cta">
          <Link className="button" to={nexoHref(d.np, d.name)}>
            {t('talkToNexo')} <Icon name="arrow" />
          </Link>
        </div>
      </div>
    )
  // Outside the library the hero shows what there is to earn: the list by tier and how rare the
  // platinum is.
  return (
    <div className="hero-bottom">
      {d.trophies?.length ? <TrophyBreakdown trophies={d.trophies} /> : null}
      <div className="cta">
        <SaveButton d={d} />
        {d.trophies?.length ? (
          <Link className="button secondary" to={nexoHref(d.game.id, d.name)}>
            {t('askNexo')} <Icon name="arrow" />
          </Link>
        ) : null}
        {d.store && <StoreOffer store={d.store} />}
      </div>
    </div>
  )
}

const TITLE_SECTIONS: [GameSection, string][] = [
  ['guide', 'title-guide'],
  ['trophies', 'title-trophies'],
]

/** A loaded title: its art across the top under the hero (and the next trophy, when it is in the
 * library), the bar of its sections, the platinum map, trophies and guide, then the similar games. */
function TitleView({ d, similar }: { d: TitleDetail; similar?: ReactNode }) {
  const t = useMessages(messages)
  const g = d.guide
  const owned = d.owned
  const shots = d.game.screenshot_ids ?? []
  const [scene, setScene] = useScene(shots.length)
  const guide = (
    <Guide
      key={d.name}
      id="title-guide"
      game={{
        name: d.name,
        guide: g,
        trophies: d.trophies,
        deepGuide: d.deepGuide,
        queued: d.queued === true,
        // "Ask Nexo" opens the chat on this game: its list when owned, the game itself when not.
        np: owned ? d.np : d.game.id,
      }}
    />
  )
  return (
    <>
      <GameBackdrop src={d.icon} shots={shots} at={scene} tint={d.game.tint} />
      <div className="hero immersive tinted" id="title-hero" style={tintStyle(d.game.tint)}>
        <UnobtainableBanner guide={{ unobtainable: g?.unobtainable }} />
        <div className="inner">
          <div className="hero-top">
            {/* Outside the library there is nothing of the player's to show: no label, no progress. */}
            {owned && <span className="live-label">{t('inLibrary')}</span>}
            <span className="hero-tools">
              <ScenesButton shots={shots} at={scene} name={d.name} onGo={setScene} />
              <span className="platform">{d.platform}</span>
            </span>
          </div>
          <div className="hero-headline">
            <h2 className="hero-title">{d.name}</h2>
            <TitleMeta d={d} />
          </div>
          <HeroBottom d={d} />
          {/* The next trophy to go for; with nothing left to push, or outside the library, the facts. */}
          <div className="hero-aside">
            {owned && d.trophies ? (
              <NextTrophy
                trophies={d.trophies}
                guide={g}
                game={d.game.id}
                np={d.np}
                fallback={<GameAbout game={d.game} name={d.name} />}
              />
            ) : (
              <GameAbout game={d.game} name={d.name} />
            )}
          </div>
        </div>
      </div>
      <GameNav sections={TITLE_SECTIONS} hero="title-hero" name={d.name} progress={d.progress} />
      {/* Every game gets the same two columns as the current game: the guide on the left,
          the trophies beside it. A game whose PSN list is not known yet says so where the list goes. */}
      <GameColumns
        id="game-columns"
        style={{ marginTop: 20 }}
        trophies={
          <div
            className={`card${owned || d.trophies?.length ? '' : ' title-trophies-pending'}`}
            id="title-trophies"
          >
            {owned || d.trophies?.length ? (
              // Games not owned still list their trophies (from the catalog), without the
              // player's progress and without "Pedir dica", which needs that progress.
              <TrophyList trophies={d.trophies ?? []} prefix="title-t" np={owned ? d.np : null} />
            ) : (
              <>
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
              </>
            )}
          </div>
        }
        guide={
          <div className="stack">
            <div className="card" id="title-guide">
              {guide}
            </div>
          </div>
        }
      />
      {similar}
    </>
  )
}

type TitleLoad = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; d: TitleDetail }

/** The screen for a given load state. `owned` picks the skeleton (a library link is likely owned);
 * `similar` goes under the showcase ("Parecidos com este"). */
export function TitleScreen({
  load,
  owned,
  similar,
}: {
  load: TitleLoad
  owned: boolean
  similar?: ReactNode
}) {
  const t = useMessages(messages)
  const navigate = useNavigate()
  // Back goes where the player came from (Guides, Discover, the library); a page opened from a
  // link, with nothing before it in the app, falls back to Discover.
  const opened = useLocation().key === 'default'
  return (
    <Page path="/title">
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
      <div id="title-page">
        {load.kind === 'loading' && <TitleSkeleton owned={owned} />}
        {load.kind === 'error' && <ErrorState>{t('notFound')}</ErrorState>}
        {load.kind === 'ready' && <TitleView d={load.d} similar={similar} />}
      </div>
    </Page>
  )
}

export function Title() {
  const spec = useParams()['*'] ?? ''
  const { search } = useLocation()
  const { query, owned } = titleQuery(spec, search)
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
      owned={owned}
      similar={load.kind === 'ready' && <SimilarGamesSection gameId={load.d.game.id} />}
    />
  )
}
