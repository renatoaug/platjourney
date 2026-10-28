/** The current journey hero: cover, guide numbers, progress and the next step. Also the header of a title page. */

import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { fmtHours, fmtPlayTime, pct } from '../lib/format'
import { shownProgress } from '../lib/progress'
import type { CurrentGame, GuideDetail } from '../lib/types'
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
  },
  [Language.En]: {
    unobtainable: 'Platinum no longer possible',
    ofTotal: 'of {total} trophies',
    ofTotalWithDlc: 'of {total} trophies with DLC',
    progressLabel: 'Game progress',
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

type HeroGame = Pick<CurrentGame, 'earned' | 'total' | 'progress' | 'groups'>

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
  return (
    <div className="hero-progress">
      <div className="barlabel">
        <span>
          <b>{earned}</b> {t(withDlc ? 'ofTotalWithDlc' : 'ofTotal', { total })}
        </span>
        <b className="pct">{progress}%</b>
      </div>
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
      <div className="remaining">
        <span>
          <b>{remaining}</b> {t('remaining', { count: remaining })}
        </span>
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
 * screen links to Nexo instead. `cta` replaces the call to action (a title page has its own).
 */
export function Hero({
  game: c,
  compact = false,
  cta,
}: {
  game: CurrentGame | null
  compact?: boolean
  cta?: ReactNode
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
          <span className="platform">{c.platform}</span>
        </div>
        <div className="hero-headline">
          <h2 className="hero-title">{c.name}</h2>
          <p className="hero-caption">
            {c.progress >= 100 ? t('captionDone') : t('captionOngoing')}
          </p>
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
      </div>
    </>
  )
}

export function HeroSkeleton({ cta = true }: { cta?: boolean }) {
  return (
    <div className="inner">
      <div className="hero-top">
        <Sk w="120px" h={9} />
        <Sk w="34px" h={18} />
      </div>
      <div>
        <Sk w="55%" h={44} />
        <Sk w="40%" h={12} style={{ marginTop: 14 }} />
        <div className="meta" style={{ marginTop: 16 }}>
          <Sk w="90px" h={10} />
          <Sk w="70px" h={10} />
          <Sk w="110px" h={10} />
        </div>
      </div>
      <div className="hero-bottom">
        <div className="hero-progress">
          <Sk w="60%" h={24} />
          <Sk w="100%" h={9} style={{ marginTop: 12 }} />
        </div>
        {cta && (
          <div className="cta">
            <Sk w="180px" h={44} />
          </div>
        )}
      </div>
    </div>
  )
}
