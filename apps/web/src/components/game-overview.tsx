/** An owned game at a glance, the way a console app shows it: the name, the progress and its bar,
 * cards that open the platinum journey, the guide, the session route and the game's facts on their
 * own pages, the trophies by tier, the guide's numbers, and the trophy list. */
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { defineMessages, Language, type Translator, useMessages } from '../i18n/i18n'
import { fmtHours, fmtPlayTime, number, pct } from '../lib/format'
import { trophyName } from '../lib/trophy-text'
import type { CurrentGame, Trophy } from '../lib/types'
import { Icon } from '../ui/icon'
import { TrophyMedal } from '../ui/trophy-medal'
import { GameAbout } from './game-showcase'
import { UnobtainableBanner } from './hero'
import './game-overview.css'

const messages = defineMessages({
  [Language.PtBR]: {
    trophies: '{earned}/{total} troféus',
    progress: 'Progresso no jogo',
    journey: 'Jornada da platina',
    journeyNext: 'Próximo: {name}',
    journeyDone: 'Platina conquistada',
    journeyStart: 'O caminho até a platina, passo a passo',
    journeyPreview: 'Prévia do caminho até a platina',
    trophyCount: { one: '{count} troféu', other: '{count} troféus' },
    missables: { one: '{count} perdível', other: '{count} perdíveis' },
    hasMissables: 'Tem perdíveis',
    playedOf: '{played} jogadas de ~{time}',
    playedOnly: '{played} jogadas',
    guide: 'Guia da platina',
    guideReady: 'Dicas, perdíveis e a ordem dos troféus',
    guideQueued: 'Na fila para ser escrito',
    guidePreparing: 'Sendo preparado',
    session: 'Planejar sessão',
    sessionLead: 'Um roteiro do que dá para fazer hoje',
    about: 'Sobre o jogo',
    aboutLead: 'Quem fez, quando saiu e como se joga',
    tiers: 'Troféus por tipo',
    platinum: 'Platina',
    gold: 'Ouro',
    silver: 'Prata',
    bronze: 'Bronze',
    difficulty: 'Dificuldade',
    time: 'Tempo',
    rating: 'Nota',
    back: 'Voltar para o jogo',
  },
  [Language.En]: {
    trophies: '{earned}/{total} trophies',
    progress: 'Game progress',
    journey: 'Platinum journey',
    journeyNext: 'Next: {name}',
    journeyDone: 'Platinum earned',
    journeyStart: 'The way to the platinum, step by step',
    journeyPreview: 'A preview of the way to the platinum',
    trophyCount: { one: '{count} trophy', other: '{count} trophies' },
    missables: { one: '{count} missable', other: '{count} missables' },
    hasMissables: 'Has missables',
    playedOf: '{played} played of ~{time}',
    playedOnly: '{played} played',
    guide: 'Platinum guide',
    guideReady: 'Tips, missables and the trophy order',
    guideQueued: 'Queued to be written',
    guidePreparing: 'Being prepared',
    session: 'Plan a session',
    sessionLead: 'A route of what fits in today',
    about: 'About the game',
    aboutLead: 'Who made it, when it came out and how it plays',
    tiers: 'Trophies by tier',
    platinum: 'Platinum',
    gold: 'Gold',
    silver: 'Silver',
    bronze: 'Bronze',
    difficulty: 'Difficulty',
    time: 'Time',
    rating: 'Score',
    back: 'Back to the game',
  },
})

/** The pages a game's cards open, kept in the address (`?view=`), so back returns to the game. */
export type GameView = 'journey' | 'guide' | 'session'
const VIEWS: GameView[] = ['journey', 'guide', 'session']

export function useGameView() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const raw = params.get('view')
  const view = VIEWS.includes(raw as GameView) ? (raw as GameView) : null
  const open = (next: GameView) =>
    setParams((p) => {
      p.set('view', next)
      return p
    })
  // Back to the game: the browser's back when the game was the page before, else drop the view.
  const close = () => {
    if (location.key !== 'default') navigate(-1)
    else
      setParams(
        (p) => {
          p.delete('view')
          return p
        },
        { replace: true },
      )
  }
  // A new page starts at its top.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when the view changes
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view])
  return { view, open, close }
}

const TIERS = ['platinum', 'gold', 'silver', 'bronze'] as const

/** The trophies the progress counts: the base game's, or with the DLC when the player chose so. */
function countedTrophies(trophies: Trophy[], includeDlc: boolean) {
  // A catalog list may come without groups: then every trophy is the base game's.
  return includeDlc ? trophies : trophies.filter((t) => !t.groupId || t.groupId === 'default')
}

function GameLink({
  icon,
  title,
  lead,
  side,
  accent,
  expanded,
  onOpen,
}: {
  icon: string
  title: string
  lead: string
  side?: ReactNode
  accent?: boolean
  /** A row that unfolds in place instead of opening a page. */
  expanded?: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      className={`game-link${accent ? ' is-accent' : ''}${expanded !== undefined ? ' is-fold' : ''}`}
      aria-expanded={expanded}
      onClick={onOpen}
    >
      <span className="game-link-icon">
        <Icon name={icon} />
      </span>
      <span className="game-link-copy">
        <b>{title}</b>
        <small>{lead}</small>
      </span>
      {side}
      <Icon name="chevron-right" />
    </button>
  )
}

/** The progress as a ring that fills, the app's own mark, with what goes inside it. */
function ProgressRing({
  progress,
  label,
  children,
}: {
  progress: number
  label: string
  children: ReactNode
}) {
  const r = 30
  const length = 2 * Math.PI * r
  return (
    <div
      className="game-ring"
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <circle className="game-ring-track" cx="36" cy="36" r={r} />
        <circle
          className="game-ring-fill"
          cx="36"
          cy="36"
          r={r}
          strokeDasharray={length}
          strokeDashoffset={length * (1 - pct(progress) / 100)}
        />
      </svg>
      <span>{children}</span>
    </div>
  )
}

function journeyLead(t: Translator<typeof messages>, done: boolean, next?: Trophy) {
  if (done) return t('journeyDone')
  return next ? t('journeyNext', { name: trophyName(next) }) : t('journeyStart')
}

/** Each tier's cup, with how many of its trophies are earned of how many there are. */
function GameTiers({ trophies, totals }: { trophies: Trophy[]; totals?: boolean }) {
  const t = useMessages(messages)
  if (!trophies.length) return null
  return (
    <section className="card game-tiers" aria-label={t('tiers')}>
      {TIERS.map((tier) => {
        const all = trophies.filter((x) => x.type === tier)
        if (!all.length) return null
        return (
          <div key={tier} className={`game-tier is-${tier}`}>
            <TrophyMedal type={tier} />
            <b>
              {totals
                ? number(all.length)
                : `${number(all.filter((x) => x.earned).length)}/${number(all.length)}`}
            </b>
            <span className="sr-only">{t(tier)}</span>
          </div>
        )
      })}
    </section>
  )
}

/** The guide's difficulty and time and the critics' score, in one card; what is unknown is left out. */
function GameNumbers({ game: c }: { game: CurrentGame }) {
  const t = useMessages(messages)
  const g = c.guide
  const facts: { key: string; value: string; label: string; hard?: boolean }[] = []
  if (g && g.difficulty > 0)
    facts.push({
      key: 'difficulty',
      value: `${g.difficulty}/10`,
      label: t('difficulty'),
      hard: true,
    })
  if (g && g.hours > 0)
    facts.push({ key: 'time', value: `~${fmtPlayTime(g.hours)}`, label: t('time') })
  if (c.game.rating)
    facts.push({ key: 'rating', value: String(Math.round(c.game.rating)), label: t('rating') })
  if (!facts.length) return null
  return (
    <section className="card game-facts">
      {facts.map((f) => (
        <div key={f.key}>
          <b className={f.hard ? 'is-hard' : undefined}>{f.value}</b>
          <small>{f.label}</small>
        </div>
      ))}
    </section>
  )
}

/** The head: the cover, the name and the time played, and the progress ring. */
function GameHead({
  game: c,
  progress,
  earned,
  total,
  catalog,
}: {
  game: CurrentGame
  progress: number
  earned: number
  total: number
  /** A game outside the library: how many trophies it has, and no progress ring. */
  catalog?: boolean
}) {
  const t = useMessages(messages)
  const g = c.guide
  const played =
    c.hoursPlayed != null
      ? g && g.hours > 0
        ? t('playedOf', { played: fmtHours(c.hoursPlayed), time: fmtPlayTime(g.hours) })
        : t('playedOnly', { played: fmtHours(c.hoursPlayed) })
      : null
  return (
    <header className="game-overview-head">
      {c.game.cover_url ? (
        <img className="game-overview-cover" src={c.game.cover_url} alt="" />
      ) : null}
      <div className="game-overview-title">
        <span className="game-overview-platform">{c.platform}</span>
        <h1>{c.name}</h1>
        {catalog
          ? total > 0 && (
              <small className="game-overview-played">{t('trophyCount', { count: total })}</small>
            )
          : played && <small className="game-overview-played">{played}</small>}
      </div>
      {!catalog && (
        <ProgressRing progress={progress} label={t('progress')}>
          <b>{progress}%</b>
          <small>
            {earned}/{total}
          </small>
        </ProgressRing>
      )}
    </header>
  )
}

/** Whether the game has any fact for "Sobre o jogo" to unfold. */
function _hasFacts(g: CurrentGame['game']) {
  return !!(
    g.genres?.length ||
    g.developers?.length ||
    g.released_at ||
    g.release_year ||
    g.platforms?.length ||
    g.website
  )
}

/** The game's pages as rows: the journey, the guide, the session route, and the facts, which
 * unfold in place. A catalog game has no session and shows the journey only with its list. */
function GameLinks({
  game: c,
  catalog,
  onOpen,
}: {
  game: CurrentGame
  catalog: boolean
  onOpen: (view: GameView) => void
}) {
  const t = useMessages(messages)
  const done = c.trophies.some((x) => x.type === 'platinum' && x.earned)
  const missables = c.guide?.missables?.length ?? 0
  const hasMissables = missables > 0 || !!c.guide?.hasMissables
  const g = c.guide
  const about = [c.game.developers?.[0], c.game.release_year].filter(Boolean).join(' · ')
  const [aboutOpen, setAboutOpen] = useState(false)
  return (
    <nav className="game-links" aria-label={c.name}>
      {/* A catalog game without its list yet has no route to preview. */}
      {(!catalog || c.trophies.length > 0) && (
        <GameLink
          accent
          icon="compass"
          title={t('journey')}
          lead={catalog ? t('journeyPreview') : journeyLead(t, done, c.focus?.trophy)}
          side={
            !done && !catalog && hasMissables ? (
              <span className="game-link-pill">
                {missables ? t('missables', { count: missables }) : t('hasMissables')}
              </span>
            ) : undefined
          }
          onOpen={() => onOpen('journey')}
        />
      )}
      <GameLink
        icon="book-open"
        title={t('guide')}
        lead={g ? t('guideReady') : c.queued ? t('guideQueued') : t('guidePreparing')}
        onOpen={() => onOpen('guide')}
      />
      {!done && !catalog && (
        <GameLink
          icon="clock"
          title={t('session')}
          lead={t('sessionLead')}
          onOpen={() => onOpen('session')}
        />
      )}
      <GameLink
        icon="info"
        title={t('about')}
        lead={about || t('aboutLead')}
        expanded={aboutOpen}
        onOpen={() => setAboutOpen((o) => !o)}
      />
      {aboutOpen && (
        <div className="game-link-panel journey-about">
          <GameAbout game={c.game} name={c.name} />
        </div>
      )}
    </nav>
  )
}

export function GameOverview({
  game: c,
  progress,
  includeDlc,
  actions,
  onOpen,
  trophies,
  catalog,
}: {
  game: CurrentGame
  progress: number
  includeDlc: boolean
  /** A game outside the library: its actions (save, ask Nexo, the store) under the head, totals
   * instead of progress, the journey as a preview and no session route. */
  catalog?: ReactNode
  /** Buttons over the picture: back to the library, the game's scenes. */
  actions?: ReactNode
  onOpen: (view: GameView) => void
  /** The trophy list, at the end. */
  trophies: ReactNode
}) {
  const counted = countedTrophies(c.trophies, includeDlc)
  const earned = counted.filter((x) => x.earned).length
  return (
    <div className="game-overview">
      {actions && <div className="game-overview-actions">{actions}</div>}
      <GameHead
        game={c}
        progress={progress}
        earned={earned}
        total={counted.length}
        catalog={!!catalog}
      />
      {catalog}
      <UnobtainableBanner guide={c.guide} />
      <GameTiers trophies={counted} totals={!!catalog} />
      <GameNumbers game={c} />

      <GameLinks game={c} catalog={!!catalog} onOpen={onOpen} />

      {trophies}
    </div>
  )
}

/** One of the game's own pages: a back button and its title over the content. */
export function GameSubpage({
  title,
  name,
  onBack,
  children,
}: {
  title: string
  name: string
  onBack: () => void
  children: ReactNode
}) {
  const t = useMessages(messages)
  return (
    <div className="game-subpage">
      <header className="game-subpage-head">
        <button type="button" className="game-subpage-back" aria-label={t('back')} onClick={onBack}>
          <Icon name="chevron-left" />
        </button>
        <div>
          <small>{name}</small>
          <h1>{title}</h1>
        </div>
      </header>
      {children}
    </div>
  )
}

/** The title of each of the game's pages. */
export function useViewTitle() {
  const t = useMessages(messages)
  return (view: GameView) => t(view)
}
