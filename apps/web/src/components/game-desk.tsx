/** A game's page on a large screen: a short head over the game's art with its numbers along the
 * bottom, the game's pages as tabs (trophies, journey, guide, session, about) and, beside them, a
 * summary that stays in place while the page scrolls: the progress and what comes next, the
 * missable trophies, and Nexo on this game. Phones and tablets keep the overview with its rows. */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { fmtHours, fmtPlayTime, number, pct } from '../lib/format'
import { trophyName } from '../lib/trophy-text'
import type { CurrentGame, Trophy } from '../lib/types'
import { Icon } from '../ui/icon'
import { GuideText } from '../ui/markdown'
import { TrophyMedal } from '../ui/trophy-medal'
import type { GameView } from './game-overview'
import { UnobtainableBanner } from './hero'
import { nexoHref } from './nexo-asks'
import { SharePlatinum } from './share-platinum'
import './game-desk.css'

const messages = defineMessages({
  [Language.PtBR]: {
    tabs: 'Páginas do jogo',
    tab: {
      trophies: 'Troféus',
      journey: 'Jornada',
      guide: 'Guia',
      session: 'Sessão',
      about: 'Sobre',
    },
    numbers: 'Os números do jogo',
    tiers: 'Troféus por tipo',
    tier: { platinum: 'Platina', gold: 'Ouro', silver: 'Prata', bronze: 'Bronze' },
    difficulty: 'dificuldade',
    hours: 'até a platina',
    rating: 'nota',
    missablesCount: { one: 'perdível', other: 'perdíveis' },
    missablesNone: 'perdíveis',
    played: '{played} jogadas',
    trophyCount: { one: '{count} troféu', other: '{count} troféus' },
    progress: 'Progresso no jogo',
    yourProgress: 'Seu progresso',
    earnedOf: '{earned} de {total} troféus',
    next: 'Próximo troféu',
    done: 'Platina conquistada',
    start: 'O caminho até a platina, passo a passo',
    openJourney: 'Seguir a jornada',
    missables: 'Perdíveis',
    missablesLead: 'Troféus que somem se você passar do ponto.',
    seeGuide: 'Ver no guia',
    more: { one: '+{count} no guia', other: '+{count} no guia' },
    nexo: 'Pergunte ao Nexo',
    nexoLead: 'Dúvidas sobre {name}, com o guia e o seu progresso.',
    nexoAsk: 'Abrir conversa',
    locked: 'Entre na sua conta',
  },
  [Language.En]: {
    tabs: "The game's pages",
    tab: {
      trophies: 'Trophies',
      journey: 'Journey',
      guide: 'Guide',
      session: 'Session',
      about: 'About',
    },
    numbers: "The game's numbers",
    tiers: 'Trophies by tier',
    tier: { platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze' },
    difficulty: 'difficulty',
    hours: 'to the platinum',
    rating: 'score',
    missablesCount: { one: 'missable', other: 'missables' },
    missablesNone: 'missables',
    played: '{played} played',
    trophyCount: { one: '{count} trophy', other: '{count} trophies' },
    progress: 'Game progress',
    yourProgress: 'Your progress',
    earnedOf: '{earned} of {total} trophies',
    next: 'Next trophy',
    done: 'Platinum earned',
    start: 'The way to the platinum, step by step',
    openJourney: 'Follow the journey',
    missables: 'Missables',
    missablesLead: 'Trophies that go away once you move past their point.',
    seeGuide: 'See in the guide',
    more: { one: '+{count} in the guide', other: '+{count} in the guide' },
    nexo: 'Ask Nexo',
    nexoLead: 'Questions about {name}, with the guide and your progress.',
    nexoAsk: 'Open a chat',
    locked: 'Sign in to your account',
  },
})

const TIERS = ['platinum', 'gold', 'silver', 'bronze'] as const
const MISSABLES_SHOWN = 5

/** The game's numbers along the bottom of its art, in two bars: first what settles the platinum
 * (the guide's difficulty, hours and missables, and the critics' score), each with its icon, then
 * the trophies by tier. What is unknown is left out. */
function NumbersStrip({ game: c, trophies }: { game: CurrentGame; trophies: Trophy[] }) {
  const t = useMessages(messages)
  const g = c.guide
  const missables = g?.missables?.length ?? 0
  const facts: { key: string; icon: string; value: string; label: string; tone?: string }[] = []
  if (g && g.difficulty > 0)
    facts.push({
      key: 'difficulty',
      icon: 'target',
      value: `${g.difficulty}/10`,
      label: t('difficulty'),
      tone: 'is-hard',
    })
  if (g && g.hours > 0)
    facts.push({
      key: 'hours',
      icon: 'clock',
      value: `~${fmtPlayTime(g.hours)}`,
      label: t('hours'),
    })
  if (g)
    facts.push({
      key: 'missables',
      icon: 'warning',
      value: String(missables),
      label: missables ? t('missablesCount', { count: missables }) : t('missablesNone'),
      tone: missables ? 'is-warn' : undefined,
    })
  if (c.game.rating)
    facts.push({
      key: 'rating',
      icon: 'sparkles',
      value: String(Math.round(c.game.rating)),
      label: t('rating'),
    })
  const tiers = TIERS.map((tier) => ({
    tier,
    all: trophies.filter((x) => x.type === tier),
  })).filter((x) => x.all.length)
  return (
    <div className="game-desk-numbers">
      {facts.length > 0 && (
        <dl className="game-desk-strip is-facts" aria-label={t('numbers')}>
          {facts.map((f) => (
            <div key={f.key} className={`game-desk-fact ${f.tone ?? ''}`.trim()}>
              <dt>{f.label}</dt>
              <dd>
                <Icon name={f.icon} />
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {tiers.length > 0 && (
        <dl className="game-desk-strip is-tiers" aria-label={t('tiers')}>
          {tiers.map(({ tier, all }) => (
            <div key={tier} className={`game-desk-tier is-${tier}`}>
              <dt>
                <TrophyMedal type={tier} />
                <span className="sr-only">{t(`tier.${tier}`)}</span>
              </dt>
              <dd>{`${number(all.filter((x) => x.earned).length)}/${number(all.length)}`}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/** The progress ring, the share button once the platinum is in, and what comes next. */
function ProgressCard({
  game: c,
  earned,
  total,
  progress,
  onJourney,
}: {
  game: CurrentGame
  earned: number
  total: number
  progress: number
  onJourney?: () => void
}) {
  const t = useMessages(messages)
  const done = c.trophies.some((x) => x.type === 'platinum' && x.earned)
  const next = c.focus?.trophy
  const r = 30
  const length = 2 * Math.PI * r
  return (
    <section className="card game-desk-card game-desk-progress" aria-label={t('yourProgress')}>
      <div className="game-desk-progress-head">
        <div
          className="game-ring"
          role="progressbar"
          aria-label={t('progress')}
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
          <span>
            <b>{progress}%</b>
          </span>
        </div>
        <div>
          <span className="eyebrow">{t('yourProgress')}</span>
          <b>{t('earnedOf', { earned: number(earned), total: number(total) })}</b>
          {c.hoursPlayed != null && (
            <small>{t('played', { played: fmtHours(c.hoursPlayed) })}</small>
          )}
        </div>
      </div>
      {done ? (
        <div className="game-desk-next is-done">
          <TrophyMedal type="platinum" />
          <b>{t('done')}</b>
          <SharePlatinum gameId={c.game.id} name={c.name} labeled />
        </div>
      ) : next ? (
        <div className="game-desk-next">
          {next.iconUrl ? <img src={next.iconUrl} alt="" /> : <TrophyMedal type={next.type} />}
          <span>
            <small>{t('next')}</small>
            <b>{trophyName(next)}</b>
          </span>
        </div>
      ) : (
        <p className="game-desk-muted">{t('start')}</p>
      )}
      {onJourney && !done && (
        <button type="button" className="button sm" onClick={onJourney}>
          <Icon name="compass" /> {t('openJourney')}
        </button>
      )}
    </section>
  )
}

/** The guide's missable trophies, the first few, with the way to the rest. */
function MissablesCard({ game: c, onGuide }: { game: CurrentGame; onGuide: () => void }) {
  const t = useMessages(messages)
  const list = c.guide?.missables ?? []
  if (!list.length) return null
  const earned = new Set(c.trophies.filter((x) => x.earned).map((x) => x.name))
  return (
    <section className="card game-desk-card game-desk-missables" aria-label={t('missables')}>
      <header>
        <Icon name="warning" />
        <b>{t('missables')}</b>
        <span className="game-desk-count">{list.length}</span>
      </header>
      <p className="game-desk-muted">{t('missablesLead')}</p>
      <ul>
        {list.slice(0, MISSABLES_SHOWN).map((m) => (
          <li key={m.trophy} className={earned.has(m.trophy) ? 'is-earned' : undefined}>
            <b>{m.trophy}</b>
            {m.when && (
              <small>
                <GuideText text={m.when} />
              </small>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="text-link" onClick={onGuide}>
        {list.length > MISSABLES_SHOWN
          ? t('more', { count: list.length - MISSABLES_SHOWN })
          : t('seeGuide')}{' '}
        <Icon name="arrow" />
      </button>
    </section>
  )
}

/** Nexo on this game. */
function NexoCard({ game: c, np }: { game: CurrentGame; np: string }) {
  const t = useMessages(messages)
  return (
    <section className="card game-desk-card game-desk-nexo" aria-label={t('nexo')}>
      <img src="/nexo-avatar.svg" alt="" width="40" height="40" />
      <div>
        <b>{t('nexo')}</b>
        <small>{t('nexoLead', { name: c.name })}</small>
      </div>
      <Link className="button secondary sm" to={nexoHref(np, c.name)}>
        {t('nexoAsk')}
      </Link>
    </section>
  )
}

export type DeskTab = GameView

export function GameDesk({
  game: c,
  trophies,
  progress,
  np,
  tab,
  onTab,
  actions,
  scenes,
  catalog,
  page,
  wide = false,
}: {
  game: CurrentGame
  /** The trophies the progress counts (the base game's, or with DLC when the player chose so). */
  trophies: Trophy[]
  progress: number
  /** Nexo's and the guide's key for this game: its PSN list, or the catalog id. */
  np: string
  /** The open tab. */
  tab: DeskTab
  onTab: (tab: DeskTab) => void
  /** Over the art: the way back, when there is one. */
  actions?: ReactNode
  /** The game's pictures, beside its line under the name. */
  scenes?: ReactNode
  /** A game outside the library: its actions (save, the store); no progress and no session. */
  catalog?: ReactNode
  /** The open tab's content. */
  page: ReactNode
  /** The page takes the whole width, without the summary beside it (the journey's board). */
  wide?: boolean
}) {
  const t = useMessages(messages)
  const visitor = useApp().me.visitor === true
  const earned = trophies.filter((x) => x.earned).length
  const done = c.trophies.some((x) => x.type === 'platinum' && x.earned)
  const tabs: { key: GameView; icon: string; label: string; locked?: boolean }[] = [
    ...(c.trophies.length || !catalog
      ? [{ key: 'journey' as const, icon: 'compass', label: t('tab.journey'), locked: visitor }]
      : []),
    { key: 'guide', icon: 'book-open', label: t('tab.guide') },
    { key: 'trophies', icon: 'trophy', label: t('tab.trophies') },
    ...(!catalog && !done
      ? [{ key: 'session' as const, icon: 'clock', label: t('tab.session') }]
      : []),
    { key: 'about', icon: 'info', label: t('tab.about') },
  ]
  return (
    <div className="game-desk">
      {actions && <div className="game-desk-actions">{actions}</div>}
      <header className="game-desk-hero">
        {c.game.cover_url ? (
          <img className="game-desk-cover" src={c.game.cover_url} alt="" />
        ) : null}
        <div className="game-desk-side">
          <div className="game-desk-head-row">
            <div className="game-desk-title">
              <span className="game-overview-platform">{c.platform}</span>
              <h1>{c.name}</h1>
              <div className="game-desk-meta">
                <small>
                  {catalog
                    ? t('trophyCount', { count: trophies.length })
                    : [
                        t('earnedOf', { earned: number(earned), total: number(trophies.length) }),
                        c.hoursPlayed != null
                          ? t('played', { played: fmtHours(c.hoursPlayed) })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </small>
                {scenes}
              </div>
            </div>
            {catalog && <div className="game-desk-hero-actions">{catalog}</div>}
          </div>
          <NumbersStrip game={c} trophies={trophies} />
        </div>
      </header>
      {/* The journey first: it is where the platinum is followed. */}
      <nav className="game-desk-tabs" aria-label={t('tabs')}>
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            className={`game-desk-tab is-${x.key}`}
            aria-pressed={tab === x.key}
            disabled={x.locked}
            title={x.locked ? t('locked') : undefined}
            onClick={() => onTab(x.key)}
          >
            <Icon name={x.locked ? 'eye-off' : x.icon} />
            {x.label}
          </button>
        ))}
      </nav>
      <div className={`game-desk-body${wide ? ' is-wide' : ''}`}>
        <div className="game-desk-main">
          <UnobtainableBanner guide={c.guide} />
          {page}
        </div>
        {!wide && (
          <aside className="game-desk-rail">
            {!catalog && (
              <ProgressCard
                game={c}
                earned={earned}
                total={trophies.length}
                progress={progress}
                onJourney={visitor || tab === 'journey' ? undefined : () => onTab('journey')}
              />
            )}
            <MissablesCard game={c} onGuide={() => onTab('guide')} />
            <NexoCard game={c} np={np} />
          </aside>
        )}
      </div>
    </div>
  )
}
