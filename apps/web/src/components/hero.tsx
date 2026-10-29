/** The current journey hero: cover, guide numbers, progress and the next step. Also the header of a title page. */

import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { fmtHours, fmtPlayTime, fmtRate, pct } from '../lib/format'
import { shownProgress } from '../lib/progress'
import type { CurrentGame, GuideDetail, Trophy } from '../lib/types'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import { DifficultyMeter } from './difficulty-meter'
import './hero.css'

const messages = defineMessages({
  [Language.PtBR]: {
    unobtainable: 'Platina não é mais possível',
    ofTotal: 'de {total} troféus',
    ofTotalWithDlc: 'de {total} troféus com DLC',
    progressLabel: 'Progresso do jogo',
    platinumEarned: 'Platina conquistada',
    platinumAhead: 'Platina no fim da barra',
    remaining: {
      one: 'troféu falta para a platina',
      other: 'troféus faltam para a platina',
    },
    played: '{hours} jogadas',
    guidePreparing: 'Seu guia está sendo preparado',
    playedOf: '{played} jogadas de ~{time}',
    playedOfShort: '{played}/~{time}',
    hours: '~{time}',
    playthroughs: {
      one: '{count} jornada',
      other: '{count} jornadas',
    },
    missables: 'Troféus perdíveis',
    missablesShort: 'Perdíveis',
    noMissables: 'Sem perdíveis',
    online: 'Troféus online',
    onlineShort: 'Online',
    emptyLabel: 'SUA JORNADA COMEÇA AQUI',
    emptyTitle: 'O próximo desafio é seu.',
    emptyCaption: 'Inicie um jogo na PSN. Seu progresso aparecerá após a próxima sincronização.',
    exploreLibrary: 'Explorar minha biblioteca',
    currentLabel: 'SUA JORNADA ATUAL',
    captionDone: 'Mais uma conquista para a sua história.',
    captionOngoing: 'A próxima platina se conquista um troféu de cada vez.',
    continue: 'Continuar jornada',
    talkToNexo: 'Conversar com o Nexo',
    breakdown: '{count} troféus',
    tiers: { platinum: 'platina', gold: 'ouro', silver: 'prata', bronze: 'bronze' },
    platinumRate: 'Platina: {rate}% dos jogadores',
  },
  [Language.En]: {
    unobtainable: 'Platinum no longer possible',
    ofTotal: 'of {total} trophies',
    ofTotalWithDlc: 'of {total} trophies with DLC',
    progressLabel: 'Game progress',
    platinumEarned: 'Platinum earned',
    platinumAhead: 'Platinum at the end of the bar',
    remaining: {
      one: 'trophy left for the platinum',
      other: 'trophies left for the platinum',
    },
    played: '{hours} played',
    guidePreparing: 'Your guide is being prepared',
    playedOf: '{played} played of ~{time}',
    playedOfShort: '{played}/~{time}',
    hours: '~{time}',
    playthroughs: {
      one: '{count} playthrough',
      other: '{count} playthroughs',
    },
    missables: 'Missable trophies',
    missablesShort: 'Missables',
    noMissables: 'No missables',
    online: 'Online trophies',
    onlineShort: 'Online',
    emptyLabel: 'YOUR JOURNEY STARTS HERE',
    emptyTitle: 'The next challenge is yours.',
    emptyCaption: 'Start a game on PSN. Your progress will show after the next sync.',
    exploreLibrary: 'Explore my library',
    currentLabel: 'YOUR CURRENT JOURNEY',
    captionDone: 'One more achievement for your story.',
    captionOngoing: 'The next platinum is won one trophy at a time.',
    continue: 'Continue journey',
    talkToNexo: 'Talk to Nexo',
    breakdown: '{count} trophies',
    tiers: { platinum: 'platinum', gold: 'gold', silver: 'silver', bronze: 'bronze' },
    platinumRate: 'Platinum: {rate}% of players',
  },
})

/** Strip across the top of a game's header when its platinum can no longer be earned. */
export function UnobtainableBanner({
  guide,
}: {
  guide?: Pick<GuideDetail, 'unobtainable'> | null
}) {
  const t = useMessages(messages)
  if (!guide?.unobtainable) return null
  return (
    <div className="unobtainable" role="note">
      <Icon name="warning" />
      <div>
        <b>{t('unobtainable')}</b>
        <span>{guide.unobtainable}</span>
      </div>
    </div>
  )
}

type HeroGame = Pick<CurrentGame, 'earned' | 'total' | 'progress' | 'groups'> & {
  trophies?: Trophy[] | null
}

/** The platinum only needs the base game, so the hero counts that; DLC is a footnote. */
export function HeroProgress({ game: c }: { game: HeroGame }) {
  const t = useMessages(messages)
  const includeDlc = useApp().me.includeDlcProgress
  const base = c.groups?.base
  const dlc = c.groups?.dlc
  const { earned, total, progress, withDlc } = base
    ? shownProgress(base, dlc, includeDlc)
    : { earned: c.earned, total: c.total, progress: c.progress, withDlc: false }
  const remaining = base?.remaining ?? Math.max(0, c.total - c.earned - 1)
  const platinum = c.trophies?.find((t) => t.type === 'platinum')
  return (
    <div className="hero-progress">
      <div className="barlabel">
        <span>
          <b>{earned}</b> {t(withDlc ? 'ofTotalWithDlc' : 'ofTotal', { total })}
        </span>
        <b className="pct">{progress}%</b>
      </div>
      <div className="bar-row">
        <div
          className="bar"
          role="progressbar"
          aria-label={t('progressLabel')}
          aria-valuenow={pct(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${pct(progress)}%` }} />
        </div>
        {platinum && (
          <span
            className={platinum.earned ? 'plat-mark earned' : 'plat-mark'}
            title={t(platinum.earned ? 'platinumEarned' : 'platinumAhead')}
          >
            <Icon name="trophy" />
          </span>
        )}
      </div>
      <div className="remaining">
        {platinum?.earned ? (
          <span className="plat-done">{t('platinumEarned')}</span>
        ) : (
          <span>
            <b>{remaining}</b> {t('remaining', { count: remaining })}
          </span>
        )}
        {dlc && !withDlc && (
          <span className="dlc-note">
            <Icon name="layers" /> DLC {dlc.earned}/{dlc.total}
          </span>
        )}
      </div>
    </div>
  )
}

function HeroMeta({ c }: { c: CurrentGame }) {
  const t = useMessages(messages)
  const g = c.guide
  const played = c.hoursPlayed
  if (!g)
    return (
      <div className="meta">
        {played != null && (
          <span>
            <Icon name="clock" /> {t('played', { hours: fmtHours(played) })}
          </span>
        )}
        <span>{t('guidePreparing')}</span>
      </div>
    )
  return (
    <div className="meta">
      {/* 0 means the sources do not say yet: the fact is left out, never shown as 0. */}
      {g.difficulty > 0 && <DifficultyMeter value={g.difficulty} look="compact" />}
      {(g.hours > 0 || played != null) && (
        <span>
          <Icon name="clock" />{' '}
          {played != null && g.hours > 0 ? (
            <Short
              long={t('playedOf', { played: fmtHours(played), time: fmtPlayTime(g.hours) })}
              short={t('playedOfShort', { played: fmtHours(played), time: fmtPlayTime(g.hours) })}
            />
          ) : played != null ? (
            t('played', { hours: fmtHours(played) })
          ) : (
            t('hours', { time: fmtPlayTime(g.hours) })
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

/** What a game's list holds, by tier in each tier's color, and how rare its platinum is. */
export function TrophyBreakdown({ trophies }: { trophies: Trophy[] }) {
  const t = useMessages(messages)
  const count = (type: Trophy['type']) => trophies.filter((tr) => tr.type === type).length
  const platinum = trophies.find((tr) => tr.type === 'platinum')
  return (
    <div className="trophy-breakdown">
      <b>{t('breakdown', { count: trophies.length })}</b>
      {(['platinum', 'gold', 'silver', 'bronze'] as const).map((type) =>
        count(type) ? (
          <span key={type} className={`tier ${type}`}>
            <Icon name="trophy" /> {count(type)} {t(`tiers.${type}`)}
          </span>
        ) : null,
      )}
      {!!platinum?.earnedRate && (
        <span className="plat-rate">
          {t('platinumRate', { rate: fmtRate(platinum.earnedRate) })}
        </span>
      )}
    </div>
  )
}

/** A fact's full text, and the shorter one a phone shows so the facts fit one line. */
export function Short({ long, short }: { long: string; short: string }) {
  return (
    <>
      <span className="meta-long">{long}</span>
      <span className="meta-short">{short}</span>
    </>
  )
}

/**
 * The inside of a `.card.hero`. `compact` is the home version (links to the game screen); the game
 * screen links to Nexo instead. `cta` replaces the call to action (a title page has its own); `aside`
 * stands beside the headline on a wide screen (the next trophy).
 */
export function Hero({
  game: c,
  compact = false,
  cta,
  aside,
  tools,
  line,
}: {
  game: CurrentGame | null
  compact?: boolean
  cta?: ReactNode
  aside?: ReactNode
  /** Beside the platform in the top row (the button that opens the scenes). */
  tools?: ReactNode
  /** Under the name, in place of the caption: what the game is. */
  line?: ReactNode
}) {
  const t = useMessages(messages)
  if (!c)
    return (
      <div className="inner">
        <span className="live-label">{t('emptyLabel')}</span>
        <div>
          <h2 className="hero-title">{t('emptyTitle')}</h2>
          <p className="hero-caption">{t('emptyCaption')}</p>
        </div>
        <Link className="button" to="/discover">
          {t('exploreLibrary')} <Icon name="arrow" />
        </Link>
      </div>
    )
  return (
    <>
      <img className="bgimg" src={c.icon ?? ''} alt="" aria-hidden="true" />
      <UnobtainableBanner guide={c.guide} />
      <div className="inner">
        <div className="hero-top">
          <span className="live-label">{t('currentLabel')}</span>
          <span className="hero-tools">
            {tools}
            <span className="platform">{c.platform}</span>
          </span>
        </div>
        <div className="hero-headline">
          <h2 className="hero-title">{c.name}</h2>
          {line ?? (
            <p className="hero-caption">
              {c.progress >= 100 ? t('captionDone') : t('captionOngoing')}
            </p>
          )}
          <HeroMeta c={c} />
        </div>
        <div className="hero-bottom">
          <HeroProgress game={c} />
          {cta ?? (
            <div className="cta">
              <Link className="button" to={compact ? '/game' : '/nexo'}>
                {compact ? t('continue') : t('talkToNexo')} <Icon name="arrow" />
              </Link>
            </div>
          )}
        </div>
        {aside && <div className="hero-aside">{aside}</div>}
      </div>
    </>
  )
}

/** The game page's hero while it loads, in the same places: the scenes button and platform on the
 * right, the name, the chips of facts, the progress and, beside them, the card on the right. */
export function HeroSkeleton({ cta = true, aside = true }: { cta?: boolean; aside?: boolean }) {
  const pill = { borderRadius: 'var(--radius-pill)' }
  return (
    <div className="inner">
      <div className="hero-top">
        <span className="hero-tools">
          <Sk w="128px" h={34} style={pill} />
          <Sk w="38px" h={22} />
        </span>
      </div>
      <div className="hero-headline">
        <Sk w="min(520px, 80%)" h={56} />
        <div className="meta">
          {[64, 150, 96, 130].map((w) => (
            <Sk key={w} w={`${w}px`} h={30} style={pill} />
          ))}
        </div>
      </div>
      <div className="hero-bottom">
        <div className="hero-progress">
          <Sk w="60%" h={24} />
          <Sk w="100%" h={9} style={{ marginTop: 12 }} />
        </div>
        {cta && (
          <div className="cta">
            <Sk w="180px" h={40} />
          </div>
        )}
      </div>
      {aside && (
        <div className="hero-aside">
          <div className="hero-aside-sk">
            <Sk w="140px" h={10} />
            <div className="hero-aside-sk-row">
              <Sk w="56px" h={56} />
              <div>
                <Sk w="180px" h={18} />
                <Sk w="220px" h={12} style={{ marginTop: 10 }} />
                <Sk w="120px" h={12} style={{ marginTop: 8 }} />
              </div>
            </div>
            <Sk w="120px" h={36} />
          </div>
        </div>
      )}
    </div>
  )
}
