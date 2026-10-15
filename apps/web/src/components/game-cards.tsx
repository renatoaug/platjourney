/** Games close to the platinum: the radar cards on the home screen, and the library cards on
 * Discover (the same game card as the recommendations, with the rank, the progress and the hours
 * played). */
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { fmtHours, pct } from '../lib/format'
import { shownProgress } from '../lib/progress'
import type { RankingItem } from '../lib/types'
import { Icon } from '../ui/icon'
import { repeat, Sk } from '../ui/skeleton'
import { GameCard } from './game-band'
import { SaveToInterests } from './save-to-interests'
import { titleHref } from './tip'
import './hero.css'
import './game-cards.css'

const messages = defineMessages({
  [Language.PtBR]: {
    radarPosition: '0{n} NO RADAR',
    trophiesOf: '{earned} de {total} troféus',
    withDlc: ' com DLC',
    remaining: {
      one: 'Falta {count} troféu para a platina',
      other: 'Faltam {count} troféus para a platina',
    },
    remainingShort: {
      one: ' · falta {count} troféu',
      other: ' · faltam {count} troféus',
    },
    hoursPlayed: ' · {hours} jogadas',
    dlcApart: 'DLC à parte: {earned}/{total}',
    progressLine: '{earned}/{total} · faltam {count}',
    progressLabel: 'Progresso da platina: {progress}%',
    playedOf: '{played} de ~{hours}h',
    played: '{played} jogadas',
    playedTitle: 'Horas jogadas',
    dlc: 'DLC {earned}/{total}',
    dlcTitle: 'Troféus de DLC, fora da platina',
  },
  [Language.En]: {
    radarPosition: '0{n} ON RADAR',
    trophiesOf: '{earned} of {total} trophies',
    withDlc: ' with DLC',
    remaining: {
      one: '{count} trophy left to the platinum',
      other: '{count} trophies left to the platinum',
    },
    remainingShort: {
      one: ' · {count} trophy left',
      other: ' · {count} trophies left',
    },
    hoursPlayed: ' · {hours} played',
    dlcApart: 'DLC apart: {earned}/{total}',
    progressLine: '{earned}/{total} · {count} left',
    progressLabel: 'Platinum progress: {progress}%',
    playedOf: '{played} of ~{hours}h',
    played: '{played} played',
    playedTitle: 'Hours played',
    dlc: 'DLC {earned}/{total}',
    dlcTitle: 'DLC trophies, outside the platinum',
  },
})

function useShown(r: RankingItem) {
  return shownProgress(r, r.dlc, useApp().me.includeDlcProgress)
}

export function RadarCard({ item: r, index: i }: { item: RankingItem; index: number }) {
  const t = useMessages(messages)
  const { earned, total, progress, withDlc } = useShown(r)
  return (
    <Link className="game-card" to={titleHref(r.game)}>
      <div className="game-art">
        <img src={r.icon ?? ''} alt="" loading="lazy" />
        <span className="game-position">{t('radarPosition', { n: i + 1 })}</span>
        <span className="game-platform">{r.platform}</span>
      </div>
      <div className="game-info">
        <h3>{r.name}</h3>
        <div className="barlabel">
          <span>
            {t('trophiesOf', { earned, total })}
            {withDlc ? t('withDlc') : ''}
          </span>
          <b>{progress}%</b>
        </div>
        <div className="bar">
          <i style={{ width: `${pct(progress)}%` }} />
        </div>
        <small>
          {t('remaining', { count: r.remaining })}
          {r.hours != null ? t('hoursPlayed', { hours: fmtHours(r.hours) }) : ''}
        </small>
        {r.dlc && !withDlc && (
          <span className="dlc-note">
            <Icon name="layers" /> {t('dlcApart', { earned: r.dlc.earned, total: r.dlc.total })}
          </span>
        )}
      </div>
    </Link>
  )
}

/** One game of the library on Discover: the rank over the cover, the hours played (of the guide's
 * estimate when known), the DLC, and the progress above the difficulty. */
export function LibraryCard({ item: r, index: i }: { item: RankingItem; index: number }) {
  const t = useMessages(messages)
  const { earned, total, progress, withDlc } = useShown(r)
  const played = r.hours != null ? fmtHours(r.hours) : null
  return (
    <GameCard
      actions={<SaveToInterests game={{ id: r.game, name: r.name }} source="recommendations" />}
      item={{
        game: { id: r.game, name: r.name, cover_url: r.cover ?? r.icon },
        difficulty: r.difficulty ?? 0,
        hours: r.guideHours ?? 0,
        tag: String(i + 1),
      }}
      meta={
        <span className="band-meta">
          {played && (
            <span title={t('playedTitle')}>
              <Icon name="clock" />{' '}
              {/* "de ~Xh" only while the estimate is still ahead of the time played. */}
              {r.guideHours && (r.hours ?? 0) < r.guideHours
                ? t('playedOf', { played, hours: r.guideHours })
                : t('played', { played })}
            </span>
          )}
          {r.dlc && !withDlc && (
            <span className="band-dlc" title={t('dlcTitle')}>
              <Icon name="layers" /> {t('dlc', { earned: r.dlc.earned, total: r.dlc.total })}
            </span>
          )}
        </span>
      }
      progress={
        <span className="library-progress">
          <span className="barlabel">
            <span>
              {t('progressLine', { earned, total, count: r.remaining })}
              {withDlc ? t('withDlc') : ''}
            </span>
            <b>{progress}%</b>
          </span>
          <span
            className="bar small"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('progressLabel', { progress })}
          >
            <i style={{ width: `${pct(progress)}%` }} />
          </span>
        </span>
      }
    />
  )
}

export function GameCardsSkeleton({ n = 3 }: { n?: number }) {
  return repeat(n, () => (
    <article className="game-card">
      <div className="game-art">
        <Sk w="100%" h={114} style={{ borderRadius: 0 }} />
      </div>
      <div className="game-info">
        <Sk w="80%" h={12} />
        <Sk w="55%" h={12} style={{ marginTop: 6 }} />
        <div className="barlabel" style={{ marginTop: 14 }}>
          <Sk w="40%" h={9} />
          <Sk w="12%" h={9} />
        </div>
        <Sk w="100%" h={5} />
        <Sk w="60%" h={9} style={{ marginTop: 12 }} />
      </div>
    </article>
  ))
}
