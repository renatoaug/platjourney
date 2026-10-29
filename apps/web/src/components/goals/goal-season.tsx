/** Season overview on the Interests screen: platinums of the year against the target, the pace, and the yearly target editor. */
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { defineMessages, getLocale, Language, useMessages } from '../../i18n/i18n'
import type { YearGoals } from '../../lib/types'
import { BoldText } from '../../ui/bold-text'
import { Icon } from '../../ui/icon'
import { Sk } from '../../ui/skeleton'
import { season } from './season'
import '../annual-goal.css'
import './goal-season.css'

const messages = defineMessages({
  [Language.PtBR]: {
    season: {
      invalid: 'Informe um número inteiro maior que zero.',
      eyebrow: 'TEMPORADA {year}',
      title: 'Cada platina conta.',
      captionTop: 'platinas',
      captionBottom: 'conquistadas',
      ofTarget: 'da meta',
      progressLabel: 'Progresso da meta anual',
      target: 'OBJETIVO ANUAL',
      decrease: 'Diminuir meta',
      increase: 'Aumentar meta',
      inputLabel: 'Meta anual de platinas',
      unit: 'platinas para conquistar em {year}',
      save: 'Salvar meta',
      cancel: 'Cancelar',
      platinums: 'platinas',
      noTarget: 'Ainda sem meta',
      edit: 'Editar meta',
      set: 'Definir meta',
      months: 'Platinas por mês',
      projection: 'No seu ritmo: <b>~{count}</b> até dezembro',
      ahead: 'acima da meta',
      behind: 'abaixo da meta',
    },
  },
  [Language.En]: {
    season: {
      invalid: 'Enter a whole number greater than zero.',
      eyebrow: '{year} SEASON',
      title: 'Every platinum counts.',
      captionTop: 'platinums',
      captionBottom: 'earned',
      ofTarget: 'of goal',
      progressLabel: 'Yearly goal progress',
      target: 'YEARLY GOAL',
      decrease: 'Lower goal',
      increase: 'Raise goal',
      inputLabel: 'Yearly platinum goal',
      unit: 'platinums to earn in {year}',
      save: 'Save goal',
      cancel: 'Cancel',
      platinums: 'platinums',
      noTarget: 'No goal yet',
      edit: 'Edit goal',
      set: 'Set goal',
      months: 'Platinums per month',
      projection: 'At your pace: <b>~{count}</b> by December',
      ahead: 'above the goal',
      behind: 'below the goal',
    },
  },
})

/** The year's twelve months as cells, each lit with how many platinums it had; the current one
 * marked, the ones still ahead dim. */
function MonthStrip({ goals: p, now }: { goals: YearGoals; now: Date }) {
  const t = useMessages(messages)
  const counts = Array.from({ length: 12 }, () => 0)
  for (const x of p.platinumed) {
    const at = new Date(x.at)
    if (at.getFullYear() === p.year) counts[at.getMonth()] += 1
  }
  const month = p.year === now.getFullYear() ? now.getMonth() : 11
  // Three letters a month (JAN, FEV…), without the abbreviation's dot some locales add.
  const name = (m: number) =>
    new Date(p.year, m, 1)
      .toLocaleDateString(getLocale(), { month: 'short' })
      .replace('.', '')
      .slice(0, 3)
  return (
    <div className="goal-months" role="img" aria-label={t('season.months')}>
      {counts.map((n, m) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: the twelve months, fixed
          key={m}
          className={`goal-month${n ? ' on' : ''}${m === month ? ' now' : ''}${m > month ? ' ahead' : ''}`}
        >
          <b>{n || ''}</b>
          <small>{name(m)}</small>
        </span>
      ))}
    </div>
  )
}

/** Where the year ends at the pace so far (platinums per month elapsed, times twelve): green when
 * it reaches the goal, gold when it falls short. */
function Projection({ goals: p, now }: { goals: YearGoals; now: Date }) {
  const t = useMessages(messages)
  if (p.year !== now.getFullYear() || !p.done) return null
  const elapsed = now.getMonth() + now.getDate() / 31
  const count = Math.round((p.done / Math.max(elapsed, 1)) * 12)
  const reaches = !!p.target && count >= p.target
  return (
    <span className={`goal-projection ${reaches ? 'ahead' : 'behind'}`}>
      <BoldText text={t('season.projection', { count })} />
      {p.target ? ` · ${t(reaches ? 'season.ahead' : 'season.behind')}` : ''}
    </span>
  )
}

export interface Feedback {
  text: string
  error?: boolean
}

export function GoalSeason({
  goals: p,
  editing,
  onEditing,
  busy = false,
  feedback,
  onFeedback,
  onSet,
}: {
  goals: YearGoals
  editing: boolean
  onEditing: (editing: boolean) => void
  busy?: boolean
  feedback: Feedback
  onFeedback: (feedback: Feedback) => void
  /** Saves the new target; resolves false when it failed (the feedback line says so). */
  onSet: (target: number) => Promise<boolean>
}) {
  const t = useMessages(messages)
  const now = new Date()
  const { progress, pace } = season(p, now)
  const [value, setValue] = useState(String(p.target ?? 12))
  const input = useRef<HTMLInputElement>(null)
  const edit = useRef<HTMLButtonElement>(null)
  // Where focus goes once the editor opens or closes (and its buttons are enabled again).
  const pendingFocus = useRef<'edit' | 'target' | null>(null)

  useEffect(() => {
    if (busy) return
    if (editing && pendingFocus.current === 'target') {
      input.current?.focus()
      input.current?.select()
    } else if (!editing && pendingFocus.current === 'edit') edit.current?.focus()
    else return
    pendingFocus.current = null
  }, [editing, busy])

  const number = Number(value)
  useEffect(() => {
    input.current?.setCustomValidity(
      value && (!Number.isSafeInteger(number) || number < 1) ? t('season.invalid') : '',
    )
  }, [value, number, t])

  const open = () => {
    setValue(String(p.target ?? 12))
    onFeedback({ text: '' })
    pendingFocus.current = 'target'
    onEditing(true)
  }
  const cancel = () => {
    pendingFocus.current = 'edit'
    onEditing(false)
    onFeedback({ text: '' })
  }
  const step = (delta: number) =>
    setValue(
      String(Math.max(1, (Number.isSafeInteger(number) ? number : (p.target ?? 12)) + delta)),
    )
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!input.current?.reportValidity()) return
    pendingFocus.current = 'edit'
    if (!(await onSet(number))) pendingFocus.current = null
  }

  return (
    <div className="card goal-season">
      <div className="goal-overview">
        <div className="goal-season-heading">
          <span className="goal-season-icon">
            <Icon name="trophy" />
          </span>
          <div>
            <span className="eyebrow">{t('season.eyebrow', { year: p.year })}</span>
            <h2>{t('season.title')}</h2>
          </div>
        </div>
        <div className="goal-progress-heading">
          <div className="goal-big">
            {p.done}
            {p.target ? <span> / {p.target}</span> : null}
          </div>
          <span className="goal-progress-caption">
            {t('season.captionTop')}
            <br />
            {t('season.captionBottom')}
          </span>
          {p.target ? (
            <span className="goal-percent">
              {progress}% <small>{t('season.ofTarget')}</small>
            </span>
          ) : null}
        </div>
        <div
          className="bar"
          role="progressbar"
          aria-label={t('season.progressLabel')}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${progress}%` }} />
        </div>
        <MonthStrip goals={p} now={now} />
        <p className="goal-pace">
          {pace}
          <Projection goals={p} now={now} />
        </p>
      </div>
      <div className="goal-control-wrap">
        <div id="goal-control">
          {editing ? (
            <form id="goal-set" className="goal-editor" onSubmit={submit}>
              <label htmlFor="goal-target" className="eyebrow">
                {t('season.target')}
              </label>
              <div className="goal-stepper">
                <button
                  type="button"
                  id="goal-decrease"
                  aria-label={t('season.decrease')}
                  disabled={busy || number <= 1}
                  onClick={() => step(-1)}
                >
                  <Icon name="minus" />
                </button>
                <input
                  ref={input}
                  id="goal-target"
                  aria-label={t('season.inputLabel')}
                  aria-describedby="goal-feedback"
                  type="number"
                  min="1"
                  step="1"
                  required
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
                <button
                  type="button"
                  id="goal-increase"
                  aria-label={t('season.increase')}
                  disabled={busy}
                  onClick={() => step(1)}
                >
                  <Icon name="plus" />
                </button>
              </div>
              <span className="goal-unit">{t('season.unit', { year: p.year })}</span>
              <div className="goal-editor-actions">
                <button type="submit" className="goal-save" disabled={busy}>
                  <Icon name="check" /> {t('season.save')}
                </button>
                <button
                  type="button"
                  id="goal-cancel"
                  className="ghost"
                  disabled={busy}
                  onClick={cancel}
                >
                  {t('season.cancel')}
                </button>
              </div>
            </form>
          ) : (
            <>
              <span className="goal-control-icon">
                <Icon name="target" />
              </span>
              <span className="eyebrow">{t('season.target')}</span>
              {p.target ? (
                <div className="goal-target-value">
                  {p.target}
                  <span>{t('season.platinums')}</span>
                </div>
              ) : (
                <div className="goal-target-none">{t('season.noTarget')}</div>
              )}
              <button
                ref={edit}
                type="button"
                id="goal-edit"
                className="ghost"
                disabled={busy}
                onClick={open}
              >
                <Icon name="edit" /> {p.target ? t('season.edit') : t('season.set')}
              </button>
            </>
          )}
        </div>
        <p
          id="goal-feedback"
          role="status"
          className={`goal-feedback${feedback.error ? ' error' : ''}`}
        >
          {feedback.text}
        </p>
      </div>
    </div>
  )
}

export function GoalSeasonSkeleton() {
  return (
    <div className="card goal-season">
      <div className="goal-overview">
        <div className="goal-season-heading">
          <Sk w="44px" h={44} style={{ borderRadius: 'var(--radius-control)', flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <Sk w="30%" h={9} />
            <Sk w="50%" h={18} style={{ marginTop: 8 }} />
          </div>
        </div>
        <div className="goal-progress-heading">
          <Sk w="120px" h={60} />
          <Sk w="80px" h={12} />
        </div>
        <Sk w="100%" h={5} />
        <Sk w="70%" h={12} style={{ marginTop: 14 }} />
      </div>
      <div className="goal-control-wrap">
        <Sk w="40%" h={9} />
        <Sk w="60%" h={38} style={{ marginTop: 8 }} />
        <Sk w="50%" h={36} style={{ marginTop: 18 }} />
      </div>
    </div>
  )
}
