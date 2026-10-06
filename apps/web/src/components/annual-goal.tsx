/** The yearly challenge on Home: platinums so far against the target, the pace left, and a link to the Interests screen. Renders the inside of .card.annual-goal. */
import { Link } from 'react-router'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import type { YearGoals } from '../lib/types'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import { season } from './goals/season'
import './annual-goal.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'DESAFIO {year}',
    title: 'Sua meta, seu ritmo.',
    caption: 'platinas conquistadas em {year}',
    follow: 'Acompanhar minha meta',
    set: 'Definir minha meta',
  },
  [Language.En]: {
    eyebrow: '{year} CHALLENGE',
    title: 'Your goal, your pace.',
    caption: 'platinums earned in {year}',
    follow: 'Track my goal',
    set: 'Set my goal',
  },
})

export function AnnualGoal({ goals: p }: { goals: YearGoals }) {
  const t = useMessages(messages)
  const { progress, pace } = season(p)
  return (
    <>
      <span className="eyebrow">{t('eyebrow', { year: p.year })}</span>
      <h2>{t('title')}</h2>
      <svg className="goal-emblem" viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <path d="m40 3 30 17v35L40 73 10 55V20Z" stroke="currentColor" opacity=".25" />
        <path d="m40 10 24 14v27L40 65 16 51V24Z" stroke="currentColor" opacity=".4" />
        <path
          d="M30 25h20v12a10 10 0 0 1-20 0V25ZM30 29h-7v6a8 8 0 0 0 10 8m17-14h7v6a8 8 0 0 1-10 8M40 47v9m-8 1h16"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <div className="goal-big">
        {p.done}
        {p.target ? <span> / {p.target}</span> : null}
      </div>
      <small>{t('caption', { year: p.year })}</small>
      <div className="bar">
        <i style={{ width: `${progress}%` }} />
      </div>
      <p>{pace}</p>
      <Link className="text-link" to="/goals">
        {p.target ? t('follow') : t('set')} <Icon name="arrow" />
      </Link>
    </>
  )
}

export function AnnualGoalSkeleton() {
  return (
    <>
      <Sk w="30%" h={8} />
      <Sk w="50%" h={18} style={{ marginTop: 8 }} />
      <Sk w="35%" h={44} style={{ marginTop: 20 }} />
      <Sk w="45%" h={10} style={{ marginTop: 8 }} />
      <Sk w="100%" h={5} style={{ marginTop: 18 }} />
      <Sk w="80%" h={10} style={{ marginTop: 12 }} />
      <Sk w="40%" h={10} style={{ marginTop: 20 }} />
    </>
  )
}
