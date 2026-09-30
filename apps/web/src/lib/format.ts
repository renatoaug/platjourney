/** Formatting for numbers, hours and dates, in the active locale (`Intl`). */
import { defineMessages, Language, translator } from '../i18n/i18n'
import { getLocale } from '../i18n/locale'

const messages = defineMessages({
  [Language.PtBR]: {
    today: 'Hoje',
    yesterday: 'Ontem',
  },
  [Language.En]: {
    today: 'Today',
    yesterday: 'Yesterday',
  },
})
const t = translator(messages)

const oneDecimal = () => new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 })

// Share of players with a trophy, as PSN reports it; floats like 11.700000000000001 show as 11.7.
export const fmtRate = (rate?: number | null) => (rate == null ? '' : oneDecimal().format(rate))

export const fmtHours = (h?: number | null) =>
  h == null ? '' : h >= 10 ? `${Math.round(h)}h` : `${oneDecimal().format(h)}h`

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(getLocale()) : ''

// Timestamps come as ISO with a zone; older rows were stored as UTC without one.
export const fmtWhen = (iso?: string | null) =>
  iso
    ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).toLocaleString(getLocale(), {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : ''

export const pct = (value: unknown) => Math.max(0, Math.min(100, Number(value) || 0))

export const number = (value: unknown) => Number(value || 0).toLocaleString(getLocale())

export const fmtMinutes = (m: number) =>
  m >= 60
    ? `${Math.floor(m / 60)}h${m % 60 ? String(Math.round(m % 60)).padStart(2, '0') : ''}`
    : `${Math.round(m)} min`

export const fmtClock = (iso: string) =>
  new Date(iso).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })

export const fmtLong = (iso: string) =>
  new Date(iso).toLocaleDateString(getLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

// The allowance resets at midnight UTC on the 1st; show that calendar day.
export const fmtReset = (iso: string) =>
  new Date(iso).toLocaleDateString(getLocale(), {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })

export const fmtDay = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const label = same(d, today)
    ? t('today')
    : same(d, yesterday)
      ? t('yesterday')
      : d.toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}
