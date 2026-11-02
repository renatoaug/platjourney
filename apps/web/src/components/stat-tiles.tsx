/** The four stat tiles on the home screen: platinums, hunter level, all trophies and the year's platinums. */
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { number, pct } from '../lib/format'
import type { ProfileSummary, YearGoals } from '../lib/types'
import { Icon } from '../ui/icon'
import { repeat, Sk } from '../ui/skeleton'
import './stat-tiles.css'

const messages = defineMessages({
  [Language.PtBR]: {
    empty: 'Seu progresso aparece aqui quando o perfil estiver disponível.',
    platinums: 'Platinas conquistadas',
    platinumsSub: 'Cada uma, uma história.',
    level: 'Nível de troféus',
    levelSub: '{progress}% para o próximo nível',
    trophies: 'Total de troféus',
    tiers: { gold: 'ouro', silver: 'prata', bronze: 'bronze' },
    year: 'Platinas em {year}',
    yearGoal: '{progress}% da sua meta anual',
    yearNoGoal: 'Uma nova temporada de conquistas',
  },
  [Language.En]: {
    empty: 'Your progress shows here once your profile is available.',
    platinums: 'Platinums earned',
    platinumsSub: 'Each one, a story.',
    level: 'Hunter level',
    levelSub: '{progress}% to the next level',
    trophies: 'Total trophies',
    tiers: { gold: 'gold', silver: 'silver', bronze: 'bronze' },
    year: 'Platinums in {year}',
    yearGoal: '{progress}% of your yearly goal',
    yearNoGoal: 'A new season of achievements',
  },
})

/** The contents of a `section.tiles`. `profile` is null while PSN has not answered for this player. */
export function StatTiles({
  profile: p,
  goals,
}: {
  profile: ProfileSummary | null
  goals?: YearGoals | null
}) {
  const t = useMessages(messages)
  if (!p) return <div className="tile stat-tile empty">{t('empty')}</div>
  const earned = p.earned
  const total = Object.values(earned).reduce((sum, n) => sum + n, 0)
  return (
    <>
      <div className="tile stat-tile plat">
        <div className="tile-label">
          <Icon name="trophy" className="stat-icon" /> {t('platinums')}
        </div>
        <b>{number(earned.platinum)}</b>
        <div className="sub">{t('platinumsSub')}</div>
      </div>
      <div className="tile stat-tile">
        <div className="tile-label">
          <Icon name="bolt" className="stat-icon" /> {t('level')}
        </div>
        <b>{number(p.level)}</b>
        <div
          className="bar stat-bar"
          role="progressbar"
          aria-label={t('level')}
          aria-valuenow={pct(p.levelProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${pct(p.levelProgress)}%` }} />
        </div>
        <div className="sub">{t('levelSub', { progress: p.levelProgress })}</div>
      </div>
      <div className="tile stat-tile">
        <div className="tile-label">
          <Icon name="trophy" className="stat-icon" /> {t('trophies')}
        </div>
        <b>{number(total)}</b>
        <div className="stat-tiers">
          {(['gold', 'silver', 'bronze'] as const).map((tier) => (
            <span key={tier} className={tier}>
              <Icon name="trophy" /> {number(earned[tier])} {t(`tiers.${tier}`)}
            </span>
          ))}
        </div>
      </div>
      <div className="tile stat-tile">
        <div className="tile-label">
          <Icon name="target" className="stat-icon" />{' '}
          {t('year', { year: goals?.year ?? new Date().getFullYear() })}
        </div>
        <b>
          {goals?.done ?? 0}
          {goals?.target ? <span> / {goals.target}</span> : null}
        </b>
        {!!goals?.target && (
          <div
            className="bar stat-bar"
            role="progressbar"
            aria-label={t('year', { year: goals.year })}
            aria-valuenow={pct((goals.done / goals.target) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i style={{ width: `${pct((goals.done / goals.target) * 100)}%` }} />
          </div>
        )}
        <div className="sub">
          {goals?.target
            ? t('yearGoal', {
                progress: Math.round((goals.done / goals.target) * 100),
              })
            : t('yearNoGoal')}
        </div>
      </div>
    </>
  )
}

export function StatTilesSkeleton() {
  return repeat(4, () => (
    <div className="tile stat-tile">
      <div className="tile-label">
        <Sk w="55%" h={10} />
      </div>
      <Sk w="40%" h={30} style={{ marginTop: 10 }} />
      <Sk w="70%" h={9} style={{ marginTop: 10 }} />
    </div>
  ))
}
