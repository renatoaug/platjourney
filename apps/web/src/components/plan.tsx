/** Session planner: pick the time you have, get the ordered route of trophies. */
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import { useApp } from '../app/app-state'
import { defineMessages, Language, translator, useMessages } from '../i18n/i18n'
import { ApiError, api, del } from '../lib/api'
import { fmtClock, fmtDate, fmtMinutes } from '../lib/format'
import { plainText } from '../lib/text'
import { Icon } from '../ui/icon'
import { Markdown } from '../ui/markdown'
import { modelWorkDone } from '../ui/plugin-slot'
import { repeat, Sk } from '../ui/skeleton'
import { toast } from '../ui/toast'
import { DemoNote } from './demo'
import './plan.css'

const messages = defineMessages({
  [Language.PtBR]: {
    optionMinutes: '{count} min',
    optionHours: {
      one: '{count} hora',
      other: '{count} horas',
    },
    question: 'Quanto tempo você tem agora?',
    timeAvailable: 'Tempo disponível',
    build: 'Montar roteiro',
    cancel: 'Cancelar',
    step: {
      done: 'Feito',
      now: 'Agora',
      anytime: 'Qualquer momento',
      after: 'Depois do passo {step}',
      trick: 'Macete',
    },
    sectionLabel: 'Roteiro da sessão',
    eyebrow: 'ROTEIRO DA SESSÃO',
    eyebrowGame: 'ROTEIRO DA SESSÃO · {game}',
    building: 'Montando o roteiro de {time}…',
    buildingLead: 'Escolhendo os troféus que cabem no seu tempo e a melhor ordem.',
    inviteTitle: 'Vai jogar agora? Eu monto o caminho.',
    inviteLead:
      'Você diz quanto tempo tem; o Nexo escolhe os troféus que cabem e a ordem para pegá-los. Vale só para esta sessão.',
    headingDone: 'Roteiro cumprido.',
    headingExpired: 'Sessão encerrada: {done} de {total} troféus.',
    headingActive: 'Siga na ordem · {done} de {total}',
    validUntil: '{time} · vale até {clock}',
    progressLabel: 'Progresso do roteiro',
    timeOf: '~{used} de {time}',
    warnings: {
      one: '{count} aviso para esta sessão',
      other: '{count} avisos para esta sessão',
    },
    endTitle: 'Fim da sessão',
    timeLeft: 'Sobrou tempo?',
    newRoute: 'Montar novo roteiro',
    redo: 'Refazer roteiro',
    dismiss: 'Dispensar',
    endSession: 'Encerrar sessão',
    ready: 'Roteiro de {time} pronto',
    failed: 'Não conseguimos montar o roteiro. Tenta de novo.',
  },
  [Language.En]: {
    optionMinutes: '{count} min',
    optionHours: {
      one: '{count} hour',
      other: '{count} hours',
    },
    question: 'How much time do you have now?',
    timeAvailable: 'Time available',
    build: 'Build route',
    cancel: 'Cancel',
    step: {
      done: 'Done',
      now: 'Now',
      anytime: 'Any time',
      after: 'After step {step}',
      trick: 'Trick',
    },
    sectionLabel: 'Session route',
    eyebrow: 'SESSION ROUTE',
    eyebrowGame: 'SESSION ROUTE · {game}',
    building: 'Building your {time} route…',
    buildingLead: 'Picking the trophies that fit your time and the best order.',
    inviteTitle: 'Playing now? I’ll map the way.',
    inviteLead:
      'Tell me how much time you have; Nexo picks the trophies that fit and the order to get them. Good for this session only.',
    headingDone: 'Route complete.',
    headingExpired: 'Session over: {done} of {total} trophies.',
    headingActive: 'Follow the order · {done} of {total}',
    validUntil: '{time} · valid until {clock}',
    progressLabel: 'Route progress',
    timeOf: '~{used} of {time}',
    warnings: {
      one: '{count} warning for this session',
      other: '{count} warnings for this session',
    },
    endTitle: 'End of session',
    timeLeft: 'Time left?',
    newRoute: 'Build a new route',
    redo: 'Redo route',
    dismiss: 'Dismiss',
    endSession: 'End session',
    ready: '{time} route ready',
    failed: 'We couldn’t build the route. Try again.',
  },
})
const tr = translator(messages)

// A roadmap for one sitting: trophies that fit in the time available, in the
// order to play them. It lives above the trophy list while the session lasts.
export interface PlanStep {
  trophy: string
  minutes: number
  how: string
  why: string
  trick: string | null
  // Can be done at any point of the session (a grind, a purchase).
  flexible: boolean
  done: boolean
  startsAt: number
  iconUrl: string | null
  type: string | null
}

export interface SessionPlan {
  game: string
  gameName: string
  minutes: number
  createdAt: string
  summary: string
  steps: PlanStep[]
  totalMinutes: number
  warnings: string[]
  ifTimeLeft: string | null
  doneCount: number
  status: 'active' | 'done' | 'expired'
  // The step to play now, or -1 when nothing is left.
  nextIndex: number
  expiresAt: string
}

const PLAN_OPTIONS = [30, 60, 120, 180, 300]

// The last time picked, kept for the rest of the visit.
let lastMinutes = 120

function PlanPicker({
  minutes,
  onMinutes,
  onGo,
  onCancel,
  readOnly = false,
}: {
  minutes: number
  onMinutes: (m: number) => void
  onGo: () => void
  onCancel?: () => void
  readOnly?: boolean
}) {
  const t = useMessages(messages)
  return (
    <div className="plan-picker">
      <span className="plan-question">{t('question')}</span>
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would restyle the chip row; the group role names it */}
      <div className="plan-options" role="group" aria-label={t('timeAvailable')}>
        {PLAN_OPTIONS.map((m) => (
          <button
            key={m}
            type="button"
            className={`chip ${m === minutes ? 'active' : ''}`}
            aria-pressed={m === minutes}
            aria-label={
              m < 60 ? t('optionMinutes', { count: m }) : t('optionHours', { count: m / 60 })
            }
            onClick={() => onMinutes(m)}
          >
            {/* The short form ("1h") on a phone, where five options share one line. */}
            <span className="when-wide" aria-hidden="true">
              {m < 60 ? t('optionMinutes', { count: m }) : t('optionHours', { count: m / 60 })}
            </span>
            <span className="when-narrow" aria-hidden="true">
              {m < 60 ? t('optionMinutes', { count: m }) : `${m / 60}h`}
            </span>
          </button>
        ))}
      </div>
      <button type="button" id="plan-go" disabled={readOnly} onClick={onGo}>
        <Icon name="compass" /> {t('build')}
      </button>
      {onCancel && (
        <button type="button" className="ghost" id="plan-cancel" onClick={onCancel}>
          {t('cancel')}
        </button>
      )}
    </div>
  )
}

function Step({ s, i, plan }: { s: PlanStep; i: number; plan: SessionPlan }) {
  const t = useMessages(messages)
  const state = s.done ? 'done' : i === plan.nextIndex ? 'next' : 'later'
  const label = s.done
    ? t('step.done')
    : state === 'next'
      ? t('step.now')
      : s.flexible
        ? t('step.anytime')
        : t('step.after', { step: i })
  const prevDone = i > 0 && plan.steps[i - 1].done
  return (
    <li
      className={`road-step ${state} ${s.flexible ? 'flexible' : ''} ${prevDone ? 'prev-done' : ''}`}
    >
      <div className="road-rail">
        <span className="road-clock">{fmtMinutes(s.startsAt)}</span>
        <span className="road-node">{s.done ? <Icon name="check" /> : i + 1}</span>
      </div>
      {/* Only the step to play now is open; the rest is one line until asked for. */}
      <details className="road-card" data-step={i} open={state === 'next'}>
        <summary>
          {s.iconUrl ? (
            <img className={`road-art ${s.type ?? ''}`} src={s.iconUrl} alt="" loading="lazy" />
          ) : (
            <span className="road-art empty">
              <Icon name="trophy" />
            </span>
          )}
          <span className="road-title">
            <span className="road-tag">{label}</span>
            <h3>{s.trophy}</h3>
          </span>
          <span className="road-time">
            <Icon name="clock" /> ~{fmtMinutes(s.minutes)}
          </span>
          <span className="road-chevron">
            <Icon name="chevron-down" />
          </span>
        </summary>
        <div className="road-body">
          <Markdown text={s.how} />
          {s.trick && (
            <div className="plan-trick">
              <Icon name="bookmark" />
              <span>
                <b>{t('step.trick')}</b> {plainText(s.trick)}
              </span>
            </div>
          )}
        </div>
      </details>
    </li>
  )
}

/** Placeholder route: four steps, used while the plan loads and while Nexo builds it. */
export function PlanSkeleton() {
  return (
    <ol className="road">
      {repeat(4, (i) => (
        <li className="road-step later">
          <div className="road-rail">
            <Sk w="34px" h={10} />
            <span className="road-node sk" style={{ animation: 'shimmer 1.3s infinite' }} />
          </div>
          <div className="road-card">
            <div className="road-summary">
              <Sk w="44px" h={44} style={{ borderRadius: 'var(--radius-control)', flex: 'none' }} />
              <span className="road-title">
                <Sk w="70px" h={14} />
                <Sk w={`${140 + i * 30}px`} h={16} style={{ marginTop: 8 }} />
              </span>
              <Sk w="60px" h={12} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export interface PlanProps {
  /** undefined while the first GET is on its way. */
  plan: SessionPlan | null | undefined
  /** Nexo is building a new route. */
  busy?: boolean
  /** The player asked for a new route and is picking the time again. */
  picking?: boolean
  minutes: number
  discarding?: boolean
  onMinutes: (m: number) => void
  onGo: () => void
  onCancel: () => void
  onNew: () => void
  onDiscard: () => void
  sectionRef?: RefObject<HTMLElement | null>
  /** The demo: the stored route shows; building, redoing and ending one are not offered. */
  readOnly?: boolean
}

/** The session plan card, every state of it. The container is `PlanCard`. */
export function Plan({
  plan,
  busy,
  picking,
  minutes,
  discarding,
  onMinutes,
  onGo,
  onCancel,
  onNew,
  onDiscard,
  sectionRef,
  readOnly = false,
}: PlanProps) {
  const t = useMessages(messages)
  const section = (className: string, children: ReactNode) => (
    <section className={className} id="plan-card" aria-label={t('sectionLabel')} ref={sectionRef}>
      {children}
    </section>
  )
  if (plan === undefined && !busy)
    return section(
      'plan',
      <>
        <div className="plan-head">
          <div>
            <Sk w="120px" h={9} />
            <Sk w="220px" h={20} style={{ marginTop: 10 }} />
          </div>
        </div>
        <PlanSkeleton />
      </>,
    )
  if (busy)
    return section(
      'plan plan-open',
      <>
        <header className="plan-top">
          <div>
            <span className="eyebrow">{t('eyebrow')}</span>
            <h2>{t('building', { time: fmtMinutes(minutes) })}</h2>
            <p>{t('buildingLead')}</p>
          </div>
        </header>
        <PlanSkeleton />
      </>,
    )
  if (!plan || picking)
    return section(
      'plan plan-empty',
      <>
        <div className="plan-invite">
          <span className="plan-badge">
            <Icon name="compass" />
          </span>
          <div className="plan-invite-text">
            <span className="eyebrow">{t('eyebrow')}</span>
            <h2>{t('inviteTitle')}</h2>
            <p>{t('inviteLead')}</p>
          </div>
        </div>
        <PlanPicker
          minutes={minutes}
          onMinutes={onMinutes}
          onGo={onGo}
          onCancel={picking && plan ? onCancel : undefined}
          readOnly={readOnly}
        />
        {readOnly && <DemoNote />}
      </>,
    )
  const total = plan.steps.length
  const progress = total ? Math.round((plan.doneCount / total) * 100) : 0
  const closed = plan.status !== 'active'
  const heading =
    plan.status === 'done'
      ? t('headingDone')
      : plan.status === 'expired'
        ? t('headingExpired', { done: plan.doneCount, total })
        : t('headingActive', { done: plan.doneCount, total })
  const sub =
    plan.status === 'active'
      ? t('validUntil', { time: fmtMinutes(plan.minutes), clock: fmtClock(plan.expiresAt) })
      : `${fmtMinutes(plan.minutes)} · ${fmtDate(plan.createdAt)}, ${fmtClock(plan.createdAt)}`
  return section(
    `plan plan-open ${closed ? 'plan-closed' : ''}`,
    <>
      <header className="plan-top">
        <div>
          <span className="eyebrow">{t('eyebrowGame', { game: plan.gameName })}</span>
          <h2>{heading}</h2>
          <p>{plainText(plan.summary)}</p>
          <span className="plan-validity">
            <Icon name="clock" /> {sub}
          </span>
        </div>
        <div className="plan-meter">
          <b>{progress}%</b>
          <div
            className="bar"
            role="progressbar"
            aria-label={t('progressLabel')}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i style={{ width: `${progress}%` }} />
          </div>
          <span>
            <Icon name="clock" />{' '}
            {t('timeOf', {
              used: fmtMinutes(plan.totalMinutes),
              time: fmtMinutes(plan.minutes),
            })}
          </span>
        </div>
      </header>
      {plan.warnings.length > 0 && (
        <details className="plan-warnings">
          <summary>
            <Icon name="warning" /> {t('warnings', { count: plan.warnings.length })}{' '}
            <Icon name="chevron-down" />
          </summary>
          <ul>
            {plan.warnings.map((w) => (
              <li key={w}>{plainText(w)}</li>
            ))}
          </ul>
        </details>
      )}
      <ol className="road">
        {plan.steps.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the route's order is fixed; a trophy can repeat
          <Step key={`${s.trophy}-${i}`} s={s} i={i} plan={plan} />
        ))}
        <li className={`road-step road-end ${plan.steps.at(-1)?.done ? 'prev-done' : ''}`}>
          <div className="road-rail">
            <span className="road-clock">{fmtMinutes(plan.totalMinutes)}</span>
            <span className="road-node">
              <Icon name="trophy" />
            </span>
          </div>
          <div className="road-card road-finish">
            <h3>{t('endTitle')}</h3>
            {plan.ifTimeLeft && (
              <p>
                {t('timeLeft')} {plainText(plan.ifTimeLeft)}
              </p>
            )}
          </div>
        </li>
      </ol>
      {!readOnly && (
        <footer className="plan-actions">
          <button type="button" className="ghost sm" id="plan-new" onClick={onNew}>
            <Icon name="refresh" /> {closed ? t('newRoute') : t('redo')}
          </button>
          <button
            type="button"
            className="ghost sm"
            id="plan-discard"
            disabled={discarding}
            onClick={onDiscard}
          >
            <Icon name="close" /> {closed ? t('dismiss') : t('endSession')}
          </button>
        </footer>
      )}
    </>,
  )
}

/** Loads the session plan, refreshes it with the app state and builds or discards it. */
export function PlanCard() {
  const { syncedAt, me } = useApp()
  const [plan, setPlan] = useState<SessionPlan | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [minutes, setMinutes] = useState(lastMinutes)
  const sectionRef = useRef<HTMLElement>(null)
  // Background refreshes must not replace the picker or a plan being built.
  const hold = useRef(false)
  hold.current = busy || picking
  const synced = syncedAt?.getTime()

  // Steps get ticked as trophies pop, so the plan reloads with every state sync.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `synced` is the trigger, not an input
  useEffect(() => {
    if (hold.current) return
    let live = true
    api<{ plan: SessionPlan | null }>('/api/plan')
      .then((r) => live && !hold.current && setPlan(r.plan))
      .catch(() => live && !hold.current && setPlan(null))
    return () => {
      live = false
    }
  }, [synced])

  const go = async () => {
    const asked = minutes
    setBusy(true)
    setPicking(false)
    try {
      const r = await api<{ plan: SessionPlan }>('/api/plan', { minutes: asked })
      setPlan(r.plan)
      setBusy(false)
      requestAnimationFrame(() =>
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      )
      toast(tr('ready', { time: fmtMinutes(asked) }), 'success')
      modelWorkDone()
    } catch (e) {
      setBusy(false)
      if (!(e instanceof ApiError && e.handled)) toast(tr('failed'))
    }
  }

  const discard = async () => {
    setDiscarding(true)
    await del('/api/plan').catch(() => {})
    setDiscarding(false)
    setPlan(null)
  }

  return (
    <Plan
      plan={plan}
      busy={busy}
      picking={picking}
      minutes={minutes}
      discarding={discarding}
      sectionRef={sectionRef}
      onMinutes={(m) => {
        lastMinutes = m
        setMinutes(m)
      }}
      onGo={go}
      onCancel={() => setPicking(false)}
      onNew={() => setPicking(true)}
      onDiscard={discard}
      readOnly={me.demo === true}
    />
  )
}
