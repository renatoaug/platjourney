/** Message lookup with `{name}` interpolation and plurals picked by `Intl.PluralRules`. No React here. */

/** A text that changes with a count: `{ one: '{count} jogo', other: '{count} jogos' }`. */
export interface Plural {
  zero?: string
  one?: string
  two?: string
  few?: string
  many?: string
  other: string
}

export type Leaf = string | Plural
export interface Tree {
  [key: string]: Leaf | Tree
}

/**
 * The shape every other locale must follow: the same keys as pt-BR, the same plural categories,
 * any text. Extra or missing keys fail the type check.
 */
export type Shape<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Plural
      ? { [C in keyof T[K]]: string }
      : Shape<T[K]>
}

/** Every dotted path to a text: `'shell.nav.home'`. */
export type Keys<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends Leaf ? `${P}${K}` : Keys<T[K], `${P}${K}.`>
}[keyof T & string]

export type Params = Record<string, string | number | null | undefined>

const isPlural = (v: unknown): v is Plural =>
  typeof v === 'object' && v !== null && typeof (v as Plural).other === 'string'

export function lookup(tree: Tree, key: string): Leaf | undefined {
  let node: Leaf | Tree | undefined = tree
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || isPlural(node)) return undefined
    node = (node as Tree)[part]
  }
  return typeof node === 'string' || isPlural(node) ? node : undefined
}

const rules = new Map<string, Intl.PluralRules>()
function pluralRule(locale: string): Intl.PluralRules {
  let rule = rules.get(locale)
  if (!rule) {
    rule = new Intl.PluralRules(locale)
    rules.set(locale, rule)
  }
  return rule
}

/** `zero` is honoured for a count of 0 even where the language has no such category. */
export function pickPlural(plural: Plural, count: number, locale: string): string {
  // Zero reads as plural in both languages ("0 platinas"), though CLDR puts pt's 0 with "one".
  if (count === 0) return plural.zero ?? plural.other
  const category = pluralRule(locale).select(count) as keyof Plural
  return plural[category] ?? plural.other
}

export function interpolate(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined || value === null ? match : String(value)
  })
}

/**
 * The text for `key` in `messages`, falling back to `fallback` (pt-BR) and then to the key itself.
 * A plural reads its count from `params.count`.
 */
export function translate(
  messages: Tree,
  fallback: Tree,
  locale: string,
  key: string,
  params?: Params,
): string {
  const leaf = lookup(messages, key) ?? lookup(fallback, key)
  if (leaf === undefined) return key
  const text =
    typeof leaf === 'string' ? leaf : pickPlural(leaf, Number(params?.count ?? 0), locale)
  return interpolate(text, params)
}

/** Every key of a tree, for parity checks. */
export function flatKeys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' || isPlural(v) ? [`${prefix}${k}`] : flatKeys(v, `${prefix}${k}.`),
  )
}
