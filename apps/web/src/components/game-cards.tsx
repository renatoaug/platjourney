/** Games close to the platinum: the radar cards on the home screen and the ranking rows on Discover. */
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { fmtHours, pct } from '../lib/format'
import { shownProgress } from '../lib/progress'
import type { RankingItem } from '../lib/types'
import { Icon } from '../ui/icon'
import { repeat, Sk } from '../ui/skeleton'
import { titleHref } from './tip'

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

export function RankingRow({ item: r, index: i }: { item: RankingItem; index: number }) {
  const t = useMessages(messages)
  const { earned, total, progress, withDlc } = useShown(r)
  return (
    <Link className="row" to={titleHref(r.game)}>
      <span className="rank">{i + 1}</span>
      <img src={r.icon ?? ''} alt="" loading="lazy" />
      <div className="grow">
        <div className="n">{r.name}</div>
        <small>
          {earned}/{total}
          {withDlc ? t('withDlc') : ''}
          {t('remainingShort', { count: r.remaining })}
          {r.dlc && !withDlc ? ` · DLC ${r.dlc.earned}/${r.dlc.total}` : ''}
          {r.hours != null ? t('hoursPlayed', { hours: fmtHours(r.hours) }) : ''}
        </small>
        <div className="bar small">
          <i style={{ width: `${progress}%` }} />
        </div>
      </div>
      <b className="display" style={{ color: 'var(--color-accent)' }}>
        {progress}%
      </b>
    </Link>
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

export function RankingRowsSkeleton({ n = 5 }: { n?: number }) {
  return repeat(n, () => (
    <div className="row">
      <span className="rank">
        <Sk w="14px" h={16} />
      </span>
      <Sk w="68px" h={44} style={{ borderRadius: 4, flex: 'none' }} />
      <div className="grow">
        <Sk w="60%" h={12} />
        <Sk w="40%" h={10} style={{ marginTop: 8 }} />
        <Sk w="100%" h={3} style={{ marginTop: 10 }} />
      </div>
      <Sk w="34px" h={18} />
    </div>
  ))
}
