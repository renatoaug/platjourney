/** The one trophy to go for next, on the game's hero: today's route first, then the phase of the
 * guide the player is in, then the most common one still missing. A tap away from a tip on it. */
import { type ReactNode, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import { fmtMinutes, fmtRate } from '../lib/format'
import type { GuideDetail, Trophy } from '../lib/types'
import { Icon } from '../ui/icon'
import { TrophyArt } from '../ui/trophy-art'
import type { SessionPlan } from './plan'
import { nexoHref } from './tip'
import './next-trophy.css'

// Trophy names compared without accents, case or punctuation: the guide writes them its own way.
const normalize = (name: unknown) =>
  String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/** The missing trophies of the first roadmap phase the player has not finished, by either name. */
function phaseTrophies(roadmap: GuideDetail['roadmap'], missing: Trophy[]): Trophy[] {
  const byName = new Map<string, Trophy>()
  for (const t of missing) {
    byName.set(normalize(t.name), t)
    if (t.nameEn) byName.set(normalize(t.nameEn), t)
  }
  for (const phase of roadmap ?? []) {
    const left = phase.trophies.map((n) => byName.get(normalize(n))).filter((t) => t !== undefined)
    if (left.length) return left
  }
  return []
}

/** The game's session plan, when there is an active one for it: its trophies are today's. */
function useTodayPlan(game: string): SessionPlan | null {
  const [plan, setPlan] = useState<SessionPlan | null>(null)
  useEffect(() => {
    let live = true
    api<{ plan: SessionPlan | null }>('/api/plan')
      .then(
        (r) => live && setPlan(r.plan?.status === 'active' && r.plan.game === game ? r.plan : null),
      )
      .catch(() => {})
    return () => {
      live = false
    }
  }, [game])
  return plan
}

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'Próximo troféu',
    fromPlan: 'no roteiro de hoje',
    fromPhase: 'da sua fase no guia',
    fromRate: 'o mais comum que falta',
    minutes: '~{time}',
    rate: '{rate}% dos jogadores têm',
    ask: 'Pedir dica',
    types: {
      bronze: 'Bronze',
      silver: 'Prata',
      gold: 'Ouro',
      platinum: 'Platina',
    },
  },
  [Language.En]: {
    eyebrow: 'Next trophy',
    fromPlan: "on today's route",
    fromPhase: 'from your phase in the guide',
    fromRate: 'the most common one missing',
    minutes: '~{time}',
    rate: '{rate}% of players have it',
    ask: 'Ask for a tip',
    types: {
      bronze: 'Bronze',
      silver: 'Silver',
      gold: 'Gold',
      platinum: 'Platinum',
    },
  },
})

type Pick = { trophy: Trophy; from: 'plan' | 'phase' | 'rate'; minutes?: number }

function pickNext(
  trophies: Trophy[],
  guide: GuideDetail | null | undefined,
  plan: SessionPlan | null,
): Pick | null {
  // The platinum needs only the base game: once it is earned, or for DLC, there is nothing to push.
  if (trophies.some((t) => t.type === 'platinum' && t.earned)) return null
  const missing = trophies.filter(
    (t) => !t.earned && t.type !== 'platinum' && (t.groupId ?? 'default') === 'default',
  )
  if (!missing.length) return null
  const byName = (name: string) =>
    missing.find(
      (t) => normalize(t.name) === normalize(name) || normalize(t.nameEn) === normalize(name),
    )
  for (const step of plan?.steps ?? []) {
    const found = !step.done && byName(step.trophy)
    if (found) return { trophy: found, from: 'plan', minutes: step.minutes }
  }
  const inPhase = phaseTrophies(guide?.roadmap ?? [], missing)[0]
  if (inPhase) return { trophy: inPhase, from: 'phase' }
  const easiest = [...missing].sort((a, b) => (b.earnedRate ?? 0) - (a.earnedRate ?? 0))[0]
  return { trophy: easiest, from: 'rate' }
}

export function NextTrophy({
  trophies,
  guide,
  game,
  np,
  fallback = null,
}: {
  trophies: Trophy[]
  guide?: GuideDetail | null
  game: string
  np?: string | null
  /** What stands in its place when there is nothing left to push (the platinum is earned). */
  fallback?: ReactNode
}) {
  const t = useMessages(messages)
  const { me } = useApp()
  const plan = useTodayPlan(game)
  const next = pickNext(trophies, guide, plan)
  if (!next) return fallback
  const { trophy, from, minutes } = next
  return (
    <aside className={`next-trophy ${trophy.type}`} aria-label={t('eyebrow')}>
      <span className="eyebrow">
        {t('eyebrow')}{' '}
        <span>· {t(`from${from === 'plan' ? 'Plan' : from === 'phase' ? 'Phase' : 'Rate'}`)}</span>
      </span>
      <div className="next-body">
        <span className="next-art">
          <TrophyArt url={trophy.iconUrl} />
        </span>
        <div>
          <b>{trophy.name}</b>
          <p>{trophy.detail}</p>
          <span className="next-facts">
            <span className="next-type">{t(`types.${trophy.type}`)}</span>
            {minutes != null && (
              <span>
                <Icon name="clock" /> {t('minutes', { time: fmtMinutes(minutes) })}
              </span>
            )}
            {/* 0 is PSN not saying yet, never "nobody has it". */}
            {!!trophy.earnedRate && <span>{t('rate', { rate: fmtRate(trophy.earnedRate) })}</span>}
          </span>
        </div>
      </div>
      <Link
        className="button secondary sm"
        to={np && !me.demo ? nexoHref(np, null, trophy.name) : '/nexo'}
      >
        <Icon name="nexo" /> {t('ask')}
      </Link>
    </aside>
  )
}
