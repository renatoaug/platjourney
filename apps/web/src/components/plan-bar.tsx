/** While the player's session plan is on, a slim bar right under the header on every screen, like a
 * music app's "now playing": the game and the step to do now, a tap away from the whole plan. It
 * sticks to the top while the page scrolls, hides on the plan's own screen, and the player can close
 * it until their next plan. */
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import { trophyName } from '../lib/trophy-text'
import { Icon } from '../ui/icon'
import type { SessionPlan } from './plan'
import { titleHref } from './tip'
import './plan-bar.css'

const messages = defineMessages({
  [Language.PtBR]: {
    label: 'Roteiro de hoje',
    next: 'Passo {step} de {total}: {trophy}',
    close: 'Esconder o roteiro até o próximo',
  },
  [Language.En]: {
    label: "Today's route",
    next: 'Step {step} of {total}: {trophy}',
    close: 'Hide the route until the next one',
  },
})

// The plan the player closed the bar for, by when it was made: a new plan shows it again.
const CLOSED = 'platjourney:plan-bar-closed'

const closedFor = (): string | null => {
  try {
    return localStorage.getItem(CLOSED)
  } catch {
    return null
  }
}

/** The plan still on with a step left, or null. */
export const planOn = (plan: SessionPlan | null | undefined): SessionPlan | null =>
  plan && plan.status === 'active' && plan.nextIndex >= 0 ? plan : null

/** The plan on, read again on every change of screen (a plan made, a step done) and on return. */
function usePlanBar(): SessionPlan | null {
  const { pathname } = useLocation()
  const [plan, setPlan] = useState<SessionPlan | null>(null)
  const [visible, setVisible] = useState(0)
  useEffect(() => {
    const back = () => document.visibilityState === 'visible' && setVisible((n) => n + 1)
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: each screen and each return reads it again
  useEffect(() => {
    let live = true
    api<{ plan: SessionPlan | null }>('/api/plan')
      .then((r) => live && setPlan(planOn(r.plan)))
      // The bar is a shortcut: without it, the screen is whole.
      .catch(() => {})
    return () => {
      live = false
    }
  }, [pathname, visible])
  return plan
}

export function PlanBar() {
  const plan = usePlanBar()
  const { search } = useLocation()
  const [closed, setClosed] = useState(closedFor)
  if (!plan || closed === plan.createdAt) return null
  // On the plan's own screen it would only repeat what is right there.
  if (new URLSearchParams(search).get('view') === 'session') return null
  const close = () => {
    try {
      localStorage.setItem(CLOSED, plan.createdAt)
    } catch {}
    setClosed(plan.createdAt)
  }
  return <PlanBarView plan={plan} onClose={close} />
}

export function PlanBarView({ plan, onClose }: { plan: SessionPlan; onClose: () => void }) {
  const t = useMessages(messages)
  const step = plan.steps[plan.nextIndex]
  const trophy = step ? trophyName({ name: step.trophy, nameEn: step.nameEn }) : ''
  return (
    <section className="plan-bar" aria-label={t('label')}>
      <Link className="plan-bar-link" to={`${titleHref(plan.game)}?view=session&from=bar`}>
        <span className="plan-bar-icon" aria-hidden="true">
          <Icon name="clock" />
        </span>
        <span className="plan-bar-copy">
          <small>{plan.gameName}</small>
          <b>{t('next', { step: plan.nextIndex + 1, total: plan.steps.length, trophy })}</b>
        </span>
        <Icon name="chevron-right" />
      </Link>
      <button type="button" className="plan-bar-close" aria-label={t('close')} onClick={onClose}>
        <Icon name="close" />
      </button>
    </section>
  )
}
