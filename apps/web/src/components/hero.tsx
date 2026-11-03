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
    trophiesLeft: { one: '{count} troféu pendente', other: '{count} troféus pendentes' },
    captionTrophies: 'Acompanhe suas conquistas, um troféu de cada vez.',
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
    trophiesLeft: { one: '{count} trophy left', other: '{count} trophies left' },
    captionTrophies: 'Follow your achievements, one trophy at a time.',
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

/** Count the saved DLC scope; platinum status always comes from its actual trophy. */
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
            {platinum ? (
              <>
                <b>{remaining}</b> {t('remaining', { count: remaining })}
              </>
            ) : (
              t('trophiesLeft', { count: Math.max(0, total - earned) })
            )}
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

export function HeroMeta({ c, difficulty = true }: { c: CurrentGame; difficulty?: boolean }) {
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
      {difficulty && g.difficulty > 0 && <DifficultyMeter value={g.difficulty} look="compact" />}
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
      <div className="trophy-counts-row">
        <b>{t('breakdown', { count: trophies.length })}</b>
        {(['platinum', 'gold', 'silver', 'bronze'] as const).map((type) =>
          count(type) ? (
            <span
              key={type}
              className={`tier ${type}`}
              role="img"
              aria-label={`${count(type)} ${t(`tiers.${type}`)}`}
              data-tip={`${count(type)} ${t(`tiers.${type}`)}`}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard focus reveals the tier name hidden from the compact row
              tabIndex={0}
            >
              <Icon name="trophy" /> <span aria-hidden="true">{count(type)}</span>
            </span>
          ) : null,
        )}
      </div>
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
  heading = 2,
  hideTools = false,
}: {
  game: CurrentGame | null
  compact?: boolean
  cta?: ReactNode
  aside?: ReactNode
  /** Secondary tools below the headline (the button that opens the scenes). */
  tools?: ReactNode
  /** Under the name, in place of the caption: what the game is. */
  line?: ReactNode
  heading?: 1 | 2
  /** The same gallery is rendered beside Back on title pages. */
  hideTools?: boolean
}) {
  const t = useMessages(messages)
  const Heading = heading === 1 ? 'h1' : 'h2'
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
          {tools && <HeroMeta c={c} />}
        </div>
        <div className="hero-headline">
          <div className="hero-title-row">
            <Heading className="hero-title">{c.name}</Heading>
            <span className="platform">{c.platform}</span>
          </div>
          {line ?? (
            <p className="hero-caption">
              {c.trophies?.some((trophy) => trophy.type === 'platinum' && trophy.earned)
                ? t('captionDone')
                : c.trophies?.some((trophy) => trophy.type === 'platinum')
                  ? t('captionOngoing')
                  : t('captionTrophies')}
            </p>
          )}
          {!tools && <HeroMeta c={c} />}
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
        {tools && !hideTools && <div className="hero-gallery">{tools}</div>}
        {aside && <div className="hero-aside">{aside}</div>}
      </div>
    </>
  )
}

/** The game page's hero while it loads, in the same places: the scenes button and platform on the
 * right, the name, the chips of facts, the progress and, beside them, the card on the right. */
export function HeroSkeleton({
  cta = true,
  aside = true,
  gallery = true,
  breakdown = false,
}: {
  cta?: ReactNode
  aside?: boolean
  gallery?: boolean
  breakdown?: boolean
}) {
  const pill = { borderRadius: 'var(--radius-pill)' }
  return (
    <div className="inner">
      <div className="hero-top">
        <div className="meta">
          <Sk w="164px" h={46} />
          {[90, 76, 110].map((w) => (
            <span key={w}>
              <Sk w={`${w}px`} h={16} />
            </span>
          ))}
        </div>
      </div>
      <div className="hero-headline">
        <div className="hero-title-row">
          <Sk w="min(520px, 80%)" h={56} />
          <Sk w="38px" h={22} />
        </div>
        <Sk w="min(380px, 100%)" h={18} />
      </div>
      <div className="hero-bottom">
        {breakdown ? (
          <div className="trophy-breakdown" aria-hidden="true">
            <div className="trophy-counts-row">
              <Sk w="85px" h={30} />
              {[0, 1, 2, 3].map((tier) => (
                <Sk key={tier} w="32px" h={18} />
              ))}
            </div>
          </div>
        ) : (
          <div className="hero-progress">
            <div className="barlabel">
              <span>
                <Sk w="110px" h={20} />
              </span>
              <b className="pct">
                <Sk w="36px" h={20} />
              </b>
            </div>
            <div className="bar-row">
              <span className="bar">
                <Sk h={8} />
              </span>
              <span className="plat-mark">
                <Sk w="18px" h={18} />
              </span>
            </div>
            <div className="remaining">
              <Sk w="180px" h={14} />
            </div>
          </div>
        )}
        {cta && <div className="cta">{cta === true ? <Sk w="180px" h={40} /> : cta}</div>}
      </div>
      {gallery && (
        <div className="hero-gallery">
          <Sk w="130px" h={32} style={pill} />
        </div>
      )}
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
