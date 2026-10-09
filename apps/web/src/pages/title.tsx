/** Game detail for a title outside the current game (owned or recommended). */

import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Page } from '../app/page'
import { useInterests } from '../app/use-interests'
import { useDemo } from '../components/demo'
import { GameColumns } from '../components/game-columns'
import { Guide, GuideSkeleton } from '../components/guide'
import { HeroProgress, HeroSkeleton, UnobtainableBanner } from '../components/hero'
import { TrophyList, TrophyListSkeleton } from '../components/trophy-list'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import { fmtHours } from '../lib/format'
import { plainText } from '../lib/text'
import type { CurrentGame, DeepGuideStats, Game, GuideDetail, Trophy } from '../lib/types'
import { Icon } from '../ui/icon'
import { EmptyState, ErrorState } from '../ui/states'
import './title.css'
import { nexoHref } from '../components/tip'

const messages = defineMessages({
  [Language.PtBR]: {
    guidePreparing: 'Guia sendo preparado…',
    difficulty: 'Dificuldade {value}/10',
    hoursOfGuide: '{played} jogadas de ~{hours}h',
    hours: '~{hours} horas',
    playthroughs: {
      one: '{count} jornada',
      other: '{count} jornadas',
    },
    missables: 'Troféus perdíveis',
    noMissables: 'Sem perdíveis',
    online: 'Troféus online',
    saved: 'Nos interesses',
    remove: 'Remover dos interesses',
    save: 'Salvar nos interesses',
    trophies: 'Troféus',
    inLibrary: 'NA SUA BIBLIOTECA',
    notInLibrary: 'FORA DA SUA BIBLIOTECA',
    talkToNexo: 'Conversar com o Nexo',
    askNexo: 'Perguntar ao Nexo sobre ele',
    notOwned: 'Você ainda não tem este jogo.',
    trophiesPendingTitle: 'Buscando a lista de troféus',
    trophiesPending:
      'A lista deste jogo ainda está chegando da PSN. Volte em breve para ver cada troféu.',
    back: 'Voltar',
    notFound: 'Não achamos esse jogo.',
  },
  [Language.En]: {
    guidePreparing: 'Preparing the guide…',
    difficulty: 'Difficulty {value}/10',
    hoursOfGuide: '{played} played of ~{hours}h',
    hours: '~{hours} hours',
    playthroughs: {
      one: '{count} playthrough',
      other: '{count} playthroughs',
    },
    missables: 'Missable trophies',
    noMissables: 'No missables',
    online: 'Online trophies',
    saved: 'In interests',
    remove: 'Remove from interests',
    save: 'Save to interests',
    trophies: 'Trophies',
    inLibrary: 'IN YOUR LIBRARY',
    notInLibrary: 'NOT IN YOUR LIBRARY',
    talkToNexo: 'Talk to Nexo',
    askNexo: 'Ask Nexo about it',
    notOwned: "You don't own this game yet.",
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

function Meta({ d }: { d: TitleDetail }) {
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
      {g.difficulty > 0 && <span>{t('difficulty', { value: g.difficulty })}</span>}
      {g.hours > 0 && (
        <span>
          <Icon name="clock" />{' '}
          {d.hoursPlayed != null
            ? t('hoursOfGuide', { played: fmtHours(d.hoursPlayed), hours: g.hours })
            : t('hours', { hours: g.hours })}
        </span>
      )}
      {g.playthroughs > 0 && <span>{t('playthroughs', { count: g.playthroughs })}</span>}
      <span className={g.hasMissables ? 'warn' : 'ok'}>
        <Icon name={g.hasMissables ? 'warning' : 'shield'} />{' '}
        {g.hasMissables ? t('missables') : t('noMissables')}
      </span>
      {g.hasOnline && <span className="warn">{t('online')}</span>}
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
        await toggle(d.game.id, d.name)
        setBusy(false)
      }}
    >
      <Icon name={saved ? 'bookmark-filled' : 'bookmark'} /> {saved ? t('saved') : t('save')}
    </button>
  )
}

/** The skeleton of a title page: the two columns when the game is likely owned, the wide guide otherwise. */
export function TitleSkeleton({ owned = true }: { owned?: boolean }) {
  const t = useMessages(messages)
  return (
    <>
      <div className={`card hero${owned ? '' : ' hero-compact'}`}>
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

/** A loaded title: hero, then trophies and guide. */
export function TitleView({ d }: { d: TitleDetail }) {
  const t = useMessages(messages)
  const g = d.guide
  const owned = d.owned
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
      <div className="card hero">
        {d.icon && <img className="bgimg" src={d.icon} alt="" aria-hidden="true" />}
        <UnobtainableBanner guide={{ unobtainable: g?.unobtainable }} />
        <div className="inner">
          <div className="hero-top">
            <span className="live-label">{owned ? t('inLibrary') : t('notInLibrary')}</span>
            <span className="platform">{d.platform}</span>
          </div>
          <div>
            <h2 className="hero-title">{d.name}</h2>
            <Meta d={d} />
          </div>
          {owned ? (
            <div className="hero-bottom">
              <HeroProgress
                game={{
                  earned: d.earned ?? 0,
                  total: d.total ?? 0,
                  progress: d.progress ?? 0,
                  groups: d.groups,
                }}
              />
              <div className="cta">
                <Link className="button" to={nexoHref(d.np, d.name)}>
                  {t('talkToNexo')} <Icon name="arrow" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="hero-bottom">
              <p className="hero-caption">
                {t('notOwned')} {g ? plainText(g.overview) : ''}
              </p>
              <div className="cta">
                <SaveButton d={d} />
                {d.trophies?.length ? (
                  <Link className="button secondary" to={nexoHref(d.game.id, d.name)}>
                    {t('askNexo')} <Icon name="arrow" />
                  </Link>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Every game gets the same two columns as the current game: trophies on the left, the
          guide beside them. A game whose PSN list is not known yet says so where the list goes. */}
      <GameColumns
        style={{ marginTop: 20 }}
        trophies={
          <div className="card" id="title-trophies">
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
                <EmptyState icon="clock" title={t('trophiesPendingTitle')}>
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
    </>
  )
}

export type TitleLoad = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; d: TitleDetail }

/** The screen for a given load state. `owned` picks the skeleton (a library link is likely owned). */
export function TitleScreen({ load, owned }: { load: TitleLoad; owned: boolean }) {
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
        {load.kind === 'ready' && <TitleView d={load.d} />}
      </div>
    </Page>
  )
}

export function Title() {
  const spec = useParams()['*'] ?? ''
  const { search } = useLocation()
  const { query, owned } = titleQuery(spec, search)
  const [load, setLoad] = useState<TitleLoad>({ kind: 'loading' })

  // Fetch the title, then poll every 6 s while its guide is being researched.
  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    setLoad({ kind: 'loading' })
    const fetchTitle = async () => {
      try {
        const d = await api<TitleDetail>(`/api/title?${query}`)
        if (!live) return
        setLoad({ kind: 'ready', d })
        if (d.building) timer = setTimeout(fetchTitle, 6000)
      } catch {
        if (live) setLoad({ kind: 'error' })
      }
    }
    fetchTitle()
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query])

  return <TitleScreen load={load} owned={owned} />
}
