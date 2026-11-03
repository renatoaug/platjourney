/** The guide of the day on the Guides page: one game with a guide, a new one each day, as a glass
 * card beside the page's title (its scene fills the backdrop behind them). */
import { Link } from 'react-router'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { DifficultyMeter } from './difficulty-meter'
import { image } from './game-showcase'
import { titleHref } from './tip'
import './guide-spotlight.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'Guia do dia',
    hours: '~{hours}h até a platina',
    hoursShort: '~{hours}h',
    noMissables: 'Sem perdíveis',
    missables: 'Tem perdíveis',
    open: 'Abrir guia',
  },
  [Language.En]: {
    eyebrow: 'Guide of the day',
    hours: '~{hours}h to platinum',
    hoursShort: '~{hours}h',
    noMissables: 'No missables',
    missables: 'Has missables',
    open: 'Open guide',
  },
})

export interface SpotlightGame {
  id: string
  name: string
  cover_url: string | null
  platforms: string[]
  release_year: number | null
  shot?: string | null
  guide: { difficulty: number; hours: number; hasMissables: boolean } | null
}

/** The day's pick from a list: the same all day for everyone, another tomorrow. */
export function pickOfTheDay<T extends SpotlightGame>(items: T[], now = new Date()): T | null {
  const pool = items.filter((i) => i.guide && i.shot)
  if (!pool.length) return null
  const day = Math.floor(now.getTime() / 86_400_000)
  return pool[day % pool.length]
}

export function GuideSpotlight({ game }: { game: SpotlightGame }) {
  const t = useMessages(messages)
  const g = game.guide
  return (
    <aside className="guide-spotlight" aria-label={t('eyebrow')}>
      {game.shot && (
        <img
          className="guide-spotlight-art"
          src={image(game.shot, 't_720p')}
          alt=""
          loading="lazy"
        />
      )}
      <header className="guide-spotlight-heading">
        <span className="eyebrow">{t('eyebrow')}</span>
        <Link className="guide-spotlight-open" to={titleHref(game.id)}>
          {t('open')} <Icon name="arrow" />
        </Link>
      </header>
      <Cover url={game.cover_url} name={game.name} className="guide-spotlight-cover" />
      <div className="guide-spotlight-body">
        <div className="guide-spotlight-head">
          <b>{game.name}</b>
        </div>
        <span className="guide-spotlight-sub">
          {[game.platforms.join(' · '), game.release_year].filter(Boolean).join(' · ')}
        </span>
      </div>
      {g && (
        <span className="guide-spotlight-chips">
          {g.difficulty > 0 && <DifficultyMeter value={g.difficulty} look="compact" />}
          {g.hours > 0 && (
            <span title={t('hours', { hours: g.hours })}>
              <Icon name="clock" /> {t('hoursShort', { hours: g.hours })}
            </span>
          )}
          <span className={g.hasMissables ? 'warn' : 'ok'}>
            <Icon name={g.hasMissables ? 'warning' : 'shield'} />{' '}
            {t(g.hasMissables ? 'missables' : 'noMissables')}
          </span>
        </span>
      )}
    </aside>
  )
}
