// What the server writes for a player (notices, Telegram, error messages) in the player's
// language. Each module declares its own texts with `defineMessages` at the top of the file and
// reads them with `translator(messages, user)`; what the model writes is not translated here.

/** The languages the bot and the notices speak. Every message set has one entry per member. */
export enum Language {
  PtBR = 'pt-BR',
  En = 'en',
}

const LOCALES = Object.values(Language)
/** A language as stored on the user: an enum member or its plain value ('pt-BR', 'en'). */
export type Locale = `${Language}`
export const DEFAULT_LOCALE: Locale = Language.PtBR

export const isLocale = (v: unknown): v is Locale =>
  (LOCALES as readonly string[]).includes(v as string)

/** Any language tag to one we have: Portuguese of any region is pt-BR, everything else English. */
export const fromLanguage = (tag: string | null | undefined): Locale =>
  tag?.trim().toLowerCase().startsWith('pt') ? Language.PtBR : Language.En

/** The first language of an Accept-Language header, or undefined when there is none. */
export function fromAcceptLanguage(header: string | null | undefined): Locale | undefined {
  const first = header?.split(',')[0]?.split(';')[0]?.trim()
  return first ? fromLanguage(first) : undefined
}

/** The player's saved language; pt-BR for accounts that never chose one (what they always got). */
export const userLocale = (user: { locale?: string | null } | null | undefined): Locale =>
  isLocale(user?.locale) ? user.locale : DEFAULT_LOCALE

/** A text that changes with a count: `{ one: '{count} run', other: '{count} runs' }`. */
interface Plural {
  zero?: string
  one?: string
  two?: string
  few?: string
  many?: string
  other: string
}
type Leaf = string | Plural
export interface Tree {
  [key: string]: Leaf | Tree
}

/**
 * The shape every other locale must follow: the same keys as pt-BR, the same plural categories,
 * any text. Extra or missing keys fail the type check.
 */
type Shape<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Plural
      ? { [C in keyof T[K]]: string }
      : Shape<T[K]>
}

/** Every dotted path to a text: `'help.title'`. */
type Keys<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends Leaf ? `${P}${K}` : Keys<T[K], `${P}${K}.`>
}[keyof T & string]

type Params = Record<string, string | number | null | undefined>

/** One module's texts: pt-BR is the reference, every other locale has exactly its shape. */
export interface MessageSet<P extends Tree = Tree> {
  [Language.PtBR]: P
  [Language.En]: Shape<P>
}

/** Every key of a message set: `'title'`, `'help.status'`. */
export type MessageKey<M extends MessageSet> = Keys<M[Language.PtBR]>

/** `t(key, params)` for one message set. */
type Translator<M extends MessageSet> = (key: MessageKey<M>, params?: Params) => string

// Every message set declared so far, so a test can check them all without a list to maintain.
const registry: MessageSet[] = []
export const declaredMessages = (): readonly MessageSet[] => registry

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

const isPlural = (v: unknown): v is Plural =>
  typeof v === 'object' && v !== null && typeof (v as Plural).other === 'string'

function lookup(tree: Tree, key: string): Leaf | undefined {
  let node: Leaf | Tree | undefined = tree
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || isPlural(node)) return undefined
    node = (node as Tree)[part]
  }
  return typeof node === 'string' || isPlural(node) ? node : undefined
}

function pickPlural(plural: Plural, count: number, locale: Locale): string {
  // Zero reads as plural in both languages ("0 platinas"), though CLDR puts pt's 0 with "one".
  if (count === 0) return plural.zero ?? plural.other
  const category = new Intl.PluralRules(locale).select(count) as keyof Plural
  return plural[category] ?? plural.other
}

/**
 * The text for `key` in `messages`, falling back to `fallback` (pt-BR) and then to the key itself.
 * A plural reads its count from `params.count`.
 */
export function translate(
  messages: Tree,
  fallback: Tree,
  locale: Locale,
  key: string,
  params?: Params,
): string {
  const leaf = lookup(messages, key) ?? lookup(fallback, key)
  if (leaf === undefined) return key
  const text =
    typeof leaf === 'string' ? leaf : pickPlural(leaf, Number(params?.count ?? 0), locale)
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined || value === null ? match : String(value)
  })
}

/** `t` for a message set, bound to a locale or to a player's saved one. */
export function translator<M extends MessageSet>(
  messages: M,
  who: Locale | { locale?: string | null } | null | undefined,
): Translator<M> {
  const locale = typeof who === 'string' ? who : userLocale(who)
  return (key, params) =>
    translate(messages[locale] as Tree, messages[Language.PtBR], locale, key, params)
}

/** Every key of a tree, for the parity test. */
export function flatKeys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' || isPlural(v) ? [`${prefix}${k}`] : flatKeys(v, `${prefix}${k}.`),
  )
}

// Share of players with a trophy in the player's language: 11.700000000000001 is 11,7 or 11.7.
export const fmtRate = (locale: Locale, rate: number) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(rate)
