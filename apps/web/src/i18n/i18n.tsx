/**
 * The web app's texts. Each module declares its own with `defineMessages` at the top of the file;
 * components read them with `useMessages(messages)` so they render again when the locale changes,
 * and code outside React render (helpers, toasts) uses `translator(messages)`.
 */
import { type ReactNode, useLayoutEffect, useMemo, useSyncExternalStore } from 'react'
import { getLocale, Language, type Locale, setLocale, subscribeLocale } from './locale'
import { type Keys, type Params, type Shape, type Tree, translate } from './translate'

export {
  applySavedLocale,
  getLocale,
  Language,
  LOCALES,
  type Locale,
  pickLocaleBeforeSignIn,
  resolveLocale,
  setLocale,
  takePickedLocale,
} from './locale'
export type { Params } from './translate'

/** One module's texts: pt-BR is the reference, every other locale has exactly its shape. */
export interface MessageSet<P extends Tree = Tree> {
  [Language.PtBR]: P
  [Language.En]: Shape<P>
}

/** Every key of a message set: `'title'`, `'status.earned'`. */
export type MessageKey<M extends MessageSet> = Keys<M[Language.PtBR]>

/** `t(key, params)` for one message set. */
export type Translator<M extends MessageSet> = (key: MessageKey<M>, params?: Params) => string

/**
 * Declares a module's texts. `en` must have the keys and plural categories of `pt-BR`, no more
 * and no fewer; anything else is a type error.
 */
export const defineMessages = <P extends Tree>(messages: {
  [Language.PtBR]: P
  [Language.En]: NoInfer<Shape<P>>
}): MessageSet<P> => {
  registry.push(messages)
  return messages
}

// Every message set declared so far, so a test can check them all without a list to maintain.
const registry: MessageSet[] = []
export const declaredMessages = (): readonly MessageSet[] => registry

/**
 * `t` for a message set outside React render (helpers, toasts, event handlers): it reads the
 * active locale on every call, or always uses `locale` when one is given.
 */
export function translator<M extends MessageSet>(messages: M, locale?: Locale): Translator<M> {
  const fallback = messages[Language.PtBR]
  return (key, params) => {
    const active = locale ?? getLocale()
    return translate(messages[active] as Tree, fallback, active, key, params)
  }
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale)
}

/** `t` bound to the active locale; a new function when it changes, so memos see the change. */
export function useMessages<M extends MessageSet>(messages: M): Translator<M> {
  const locale = useLocale()
  return useMemo(() => translator(messages, locale), [messages, locale])
}

/** Optional: forces a locale for what it wraps (Storybook's toolbar, a test). */
export function I18nProvider({ locale, children }: { locale?: Locale; children: ReactNode }) {
  useLayoutEffect(() => {
    if (locale) setLocale(locale, { persist: false })
  }, [locale])
  useLocale()
  return <>{children}</>
}
