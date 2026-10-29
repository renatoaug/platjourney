/** Session planner: pick the time you have, get the ordered route of trophies. */
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useApp } from '../app/app-state'
import { defineMessages, Language, type Translator, translator, useMessages } from '../i18n/i18n'
import { ApiError, api, del } from '../lib/api'
import { fmtClock, fmtDate, fmtMinutes } from '../lib/format'
import { plainText } from '../lib/text'
import type { AssistantKey } from '../lib/types'
import { modelWorkDone } from '../plugins'
import { Icon } from '../ui/icon'
import { GuideText, Markdown } from '../ui/markdown'
import { repeat, Sk } from '../ui/skeleton'
import { toast } from '../ui/toast'
import { assistantName } from './app-logo'
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
      short: 'Passo {step}',
      free: 'Livre',
      trick: 'Macete',
    },
    sectionLabel: 'Roteiro da sessão',
    eyebrow: 'ROTEIRO DA SESSÃO',
    eyebrowGame: 'ROTEIRO DA SESSÃO · {game}',
    by: 'feito no {name}',
    byOther: 'feito num assistente',
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
    reasonAsk: 'O roteiro não rolou? Se quiser, conta o porquê.',
    reasonSkip: 'Agora não',
    reasonThanks: 'Valeu, isso ajuda a melhorar os roteiros.',
    reason: {
      not_useful: 'Não ajudou',
      too_long: 'Longo demais',
      other_game: 'Mudei de jogo',
      no_time: 'Não deu pra jogar',
    },
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
      short: 'Step {step}',
      free: 'Any time',
      trick: 'Trick',
    },
    sectionLabel: 'Session route',
    eyebrow: 'SESSION ROUTE',
    eyebrowGame: 'SESSION ROUTE · {game}',
    by: 'made in {name}',
    byOther: 'made in an assistant',
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
    reasonAsk: 'Route didn’t work out? Tell me why, if you like.',
    reasonSkip: 'Not now',
    reasonThanks: 'Thanks, that helps make better routes.',
    reason: {
      not_useful: 'Didn’t help',
      too_long: 'Too long',
      other_game: 'Switched games',
      no_time: 'Didn’t get to play',
    },
  },
})
const tr = translator(messages)

// Why a route closed with no step done, asked once afterwards and never required.
const PLAN_REASONS = ['not_useful', 'too_long', 'other_game', 'no_time'] as const
export type PlanReason = (typeof PLAN_REASONS)[number]

// A roadmap for one sitting: trophies that fit in the time available, in the
// order to play them. It lives above the trophy list while the session lasts.
interface PlanStep {
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
  /** A plan a connected assistant made in its chat: which one. */
  assistant?: AssistantKey | null
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

/** The tag over a step: done, the one to play now, any time, or after the step before it. */
function stepLabel(t: Translator<typeof messages>, s: PlanStep, i: number, state: string) {
  if (s.done) return t('step.done')
  if (state === 'next') return t('step.now')
  if (s.flexible) return t('step.anytime')
  return t('step.after', { step: i })
}

/** The route as a track of its trophies (lit up to the step to play now) and, under it, the picked
 * step open: what to do, the trick and the time. The session's end waits at the end of the track. */
function Route({ plan }: { plan: SessionPlan }) {
  const t = useMessages(messages)
  const steps = plan.steps
  const [picked, setPicked] = useState<number | null>(null)
  const next =
    plan.nextIndex >= 0 && plan.nextIndex < steps.length && !steps[plan.nextIndex].done
      ? plan.nextIndex
      : steps.findIndex((s) => !s.done)
  const open = picked ?? (next >= 0 ? next : steps.length)
  const stops = steps.length + 1
  const lit = (next >= 0 ? next : steps.length) / (stops - 1)
  const s = steps[open] as PlanStep | undefined
  const state = (i: number) => (steps[i].done ? 'done' : i === next ? 'next' : 'later')
  // On the track a short tag: the step's number, unless it is done, now or free.
  const tag = (step: PlanStep, i: number) =>
    step.done
      ? t('step.done')
      : i === next
        ? t('step.now')
        : step.flexible
          ? t('step.free')
          : t('step.short', { step: i + 1 })
  // The stop open below stays in view on a track that scrolls sideways.
  const track = useRef<HTMLDivElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `open` is the trigger: the stop it presses
  useEffect(() => {
    const box = track.current
    const stop = box?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!box || !stop) return
    const left = stop.offsetLeft - (box.clientWidth - stop.offsetWidth) / 2
    box.scrollTo({ left: Math.max(0, left), behavior: picked === null ? 'auto' : 'smooth' })
  }, [open, picked])
  return (
    <>
      <div className="route-scroll" ref={track}>
        <ol className="route-track" style={{ '--stops': stops, '--lit': lit } as CSSProperties}>
          {steps.map((step, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: the route's order is fixed; a trophy can repeat
              key={`${step.trophy}-${i}`}
              className={`route-stop ${state(i)}${step.flexible ? ' flexible' : ''}`}
              style={{ '--i': i } as CSSProperties}
            >
              <button
                type="button"
                aria-pressed={i === open}
                data-step={i}
                onClick={() => setPicked(i)}
              >
                <span className={`route-art ${step.type ?? ''}`}>
                  {step.iconUrl ? (
                    <img src={step.iconUrl} alt="" loading="lazy" />
                  ) : (
                    <Icon name="trophy" />
                  )}
                  {step.done && (
                    <span className="route-check">
                      <Icon name="check" />
                    </span>
                  )}
                </span>
                <span className="route-tag">{tag(step, i)}</span>
                <span className="route-clock">{fmtMinutes(step.startsAt)}</span>
              </button>
            </li>
          ))}
          <li className="route-stop end" style={{ '--i': steps.length } as CSSProperties}>
            <button
              type="button"
              aria-pressed={open === steps.length}
              onClick={() => setPicked(steps.length)}
            >
              <span className="route-art">
                <Icon name="trophy" />
              </span>
              <span className="route-tag">{t('endTitle')}</span>
              <span className="route-clock">{fmtMinutes(plan.totalMinutes)}</span>
            </button>
          </li>
        </ol>
      </div>
      {s ? (
        <article key={open} className={`route-focus ${state(open)}`}>
          <div className="route-focus-art">
            {s.iconUrl ? <img src={s.iconUrl} alt="" /> : <Icon name="trophy" />}
          </div>
          <div className="route-focus-body">
            <header>
              <span className="road-tag">{stepLabel(t, s, open, state(open))}</span>
              <span className="road-time">
                <Icon name="clock" /> ~{fmtMinutes(s.minutes)}
              </span>
            </header>
            <h3>{s.trophy}</h3>
            <Markdown text={s.how} />
            {s.trick && (
              <div className="plan-trick">
                <Icon name="bookmark" />
                <span>
                  <b>{t('step.trick')}</b> <GuideText text={s.trick} />
                </span>
              </div>
            )}
          </div>
        </article>
      ) : (
        <article key="end" className="route-focus end">
          <div className="route-focus-art">
            <Icon name="trophy" />
          </div>
          <div className="route-focus-body">
            <h3>{t('endTitle')}</h3>
            {plan.ifTimeLeft && (
              <p>
                {t('timeLeft')} {plainText(plan.ifTimeLeft)}
              </p>
            )}
          </div>
        </article>
      )}
    </>
  )
}

/** Placeholder route: four steps, used while the plan loads and while Nexo builds it. */
function PlanSkeleton() {
  return (
    <>
      <div className="route-scroll">
        <ol className="route-track" style={{ '--stops': 5, '--lit': 0 } as CSSProperties}>
          {repeat(5, () => (
            <li className="route-stop later">
              <span className="route-stop-sk">
                <Sk w="56px" h={56} />
                <Sk w="64px" h={10} />
                <Sk w="32px" h={8} />
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="route-focus">
        <Sk w="96px" h={96} />
        <div className="route-focus-body">
          <Sk w="120px" h={18} />
          <Sk w="240px" h={22} />
          <Sk w="100%" h={12} />
          <Sk w="80%" h={12} />
        </div>
      </div>
    </>
  )
}

/** Redo or end the route; once it is over, start a new one or put it away. */
function PlanActions({
  closed,
  discarding,
  onNew,
  onDiscard,
}: {
  closed: boolean
  discarding?: boolean
  onNew: () => void
  onDiscard: () => void
}) {
  const t = useMessages(messages)
  return (
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
  /** The route just closed with no step done: ask why, optionally. */
  reasonAsk?: ReasonAskProps
}

interface ReasonAskProps {
  onReason: (reason: PlanReason) => void
  onSkip: () => void
}

/** Above the invite, once: why the last route did not work out. Any answer, or none, closes it. */
function PlanReasonAsk({ ask }: { ask?: ReasonAskProps }) {
  const t = useMessages(messages)
  if (!ask) return null
  const { onReason, onSkip } = ask
  return (
    <fieldset className="plan-reason" aria-label={t('reasonAsk')}>
      <small className="muted">{t('reasonAsk')}</small>
      <div className="chips">
        {PLAN_REASONS.map((reason) => (
          <button key={reason} type="button" className="chip" onClick={() => onReason(reason)}>
            {t(`reason.${reason}`)}
          </button>
        ))}
        <button type="button" className="button ghost sm" onClick={onSkip}>
          {t('reasonSkip')}
        </button>
      </div>
    </fieldset>
  )
}

function planHeading(t: Translator<typeof messages>, plan: SessionPlan) {
  const total = plan.steps.length
  if (plan.status === 'done') return t('headingDone')
  if (plan.status === 'expired') return t('headingExpired', { done: plan.doneCount, total })
  return t('headingActive', { done: plan.doneCount, total })
}

/** Under the heading: until when an active route holds, or when a closed one was made; and the
 * assistant that made it, when one did. */
function planSub(t: Translator<typeof messages>, plan: SessionPlan) {
  const when =
    plan.status === 'active'
      ? t('validUntil', { time: fmtMinutes(plan.minutes), clock: fmtClock(plan.expiresAt) })
      : `${fmtMinutes(plan.minutes)} · ${fmtDate(plan.createdAt)}, ${fmtClock(plan.createdAt)}`
  if (!plan.assistant) return when
  const name = assistantName(plan.assistant)
  return `${when} · ${name ? t('by', { name }) : t('byOther')}`
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
  reasonAsk,
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
        <PlanReasonAsk ask={reasonAsk} />
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
  const heading = planHeading(t, plan)
  const sub = planSub(t, plan)
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
      <Route plan={plan} />
      {!readOnly && (
        <PlanActions closed={closed} discarding={discarding} onNew={onNew} onDiscard={onDiscard} />
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
  // The route just closed with no step done, to ask why: its id.
  const [closed, setClosed] = useState<string | null>(null)
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
    setClosed(null)
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
    const r = await del<{ closed: string | null; askReason: boolean }>('/api/plan').catch(
      () => null,
    )
    setDiscarding(false)
    setPlan(null)
    setClosed(r?.askReason && r.closed ? r.closed : null)
  }

  const reason = (why: PlanReason) => {
    if (closed) api('/api/plan/reason', { id: closed, reason: why }).catch(() => {})
    setClosed(null)
    toast(tr('reasonThanks'), 'success')
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
      reasonAsk={closed ? { onReason: reason, onSkip: () => setClosed(null) } : undefined}
    />
  )
}
