/** The active locale: resolved once, kept in a small store that React and plain helpers both read. */

/** The languages the app speaks. Every message set has one entry per member. */
export enum Language {
  PtBR = 'pt-BR',
  En = 'en',
}

export const LOCALES = Object.values(Language)
/** A language as stored and sent around: an enum member or its plain value ('pt-BR', 'en'). */
export type Locale = `${Language}`
export const DEFAULT_LOCALE: Locale = Language.PtBR

const STORAGE_KEY = 'locale'

export const isLocale = (v: unknown): v is Locale =>
  (LOCALES as readonly string[]).includes(v as string)

/** Any language tag to one we have: Portuguese of any region is pt-BR, everything else English. */
export const fromLanguage = (tag: string | null | undefined): Locale =>
  tag?.toLowerCase().startsWith('pt') ? Language.PtBR : Language.En

/** The user's saved setting, then what this browser chose before, then the browser's language. */
export function resolveLocale(sources: {
  saved?: string | null
  stored?: string | null
  language?: string | null
}): Locale {
  if (isLocale(sources.saved)) return sources.saved
  if (isLocale(sources.stored)) return sources.stored
  return fromLanguage(sources.language)
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Private windows can refuse storage; the locale still applies to this page.
  }
}

const browserLanguage = () => (typeof navigator === 'undefined' ? null : navigator.language)

let current: Locale = resolveLocale({ stored: readStored(), language: browserLanguage() })
const listeners = new Set<() => void>()

function applyToDocument(locale: Locale) {
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}
applyToDocument(current)

export const getLocale = (): Locale => current

/**
 * Switches the whole app. `persist` (the default) remembers it in this browser; tests and
 * stories pass `false` so nothing leaks between runs.
 */
export function setLocale(locale: Locale, { persist = true }: { persist?: boolean } = {}): void {
  if (persist) writeStored(locale)
  applyToDocument(locale)
  if (locale === current) return
  current = locale
  for (const listener of listeners) listener()
}

const PICKED_KEY = 'platjourney:locale-picked'

/** A language picked on the sign-in screen: it should win over the account's when they sign in. */
export function pickLocaleBeforeSignIn(locale: Locale): void {
  setLocale(locale)
  try {
    sessionStorage.setItem(PICKED_KEY, '1')
  } catch {
    // Without storage the account's language applies after sign-in, as before.
  }
}

/** Whether a language was picked on the sign-in screen; asking clears it. */
export function takePickedLocale(): boolean {
  try {
    const picked = sessionStorage.getItem(PICKED_KEY) === '1'
    sessionStorage.removeItem(PICKED_KEY)
    return picked
  } catch {
    return false
  }
}

/** After sign-in: the account's saved locale wins over the browser's guess. */
export function applySavedLocale(saved: string | null | undefined): void {
  setLocale(resolveLocale({ saved, stored: readStored(), language: browserLanguage() }), {
    persist: isLocale(saved),
  })
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
