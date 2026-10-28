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

/** A guide's time to platinum: minutes under an hour ("35 min"), hours above ("22,5h", "18h"). */
export const fmtPlayTime = (h: number) => (h < 1 ? fmtMinutes(h * 60) : fmtHours(h))

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(getLocale()) : ''

/** A date in two digits each: 19/10/26 (10/19/26 in English). */
export const fmtShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(getLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })

// Timestamps come as ISO with a zone; older rows were stored as UTC without one.
export const fmtWhen = (iso?: string | null) =>
  iso
    ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).toLocaleString(getLocale(), {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : ''

/** How long ago, in words: "agora", "há 5 minutos", "ontem", "há 3 dias" (English the same way). */
export function fmtAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 60) return rtf.format(0, 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 30 * 86_400) return rtf.format(Math.round(seconds / 86_400), 'day')
  return rtf.format(Math.round(seconds / (30 * 86_400)), 'month')
}

export const pct = (value: unknown) => Math.max(0, Math.min(100, Number(value) || 0))

export const number = (value: unknown) => Number(value || 0).toLocaleString(getLocale())

/** A short number for tight spaces: 1.895 becomes 1,9k (1.9k in English); below a thousand it stays whole. */
export const compact = (value: unknown) => {
  const n = Number(value || 0)
  return n < 1000
    ? number(n)
    : `${(n / 1000).toLocaleString(getLocale(), { maximumFractionDigits: 1 })}k`
}

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

/** A release day, written out: 26 de abril de 2019. Stored as midnight UTC, so read in UTC. */
export const fmtRelease = (iso: string) =>
  new Date(iso).toLocaleDateString(getLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
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
