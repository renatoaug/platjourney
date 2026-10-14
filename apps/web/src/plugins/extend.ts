/** Where plugins change the interface. Every app component carries its name (`__target`, set at
 * build time by plugin-targets.ts) and every element passes through `extended` (the JSX runtime),
 * so a plugin can put something before or after any component, replace it or hide it, without the
 * screen knowing. No plugin, no rule: each element keeps its own component. */
import { type ComponentType, createContext, createElement, type ReactNode, useContext } from 'react'

// biome-ignore lint/suspicious/noExplicitAny: a target's props are whatever its component takes
type Props = Record<string, any>
/** What a plugin's component gets in place of a replaced one: the same props, and the original
 * already rendered, to show, wrap or leave out. */
export type ReplaceProps<P = Props> = P & { original: ReactNode }

type ByName<C, N extends string> = Partial<Record<N, C>>

/** A plugin's changes, by component name (`N`: the app's targets, see targets.ts). */
export interface Extension<N extends string = string> {
  /** Rendered just before the component, with the same props. */
  before?: ByName<ComponentType<Props>, N>
  /** Rendered just after the component, with the same props. */
  after?: ByName<ComponentType<Props>, N>
  /** Rendered instead of the component, with its props and `original`. */
  replace?: ByName<ComponentType<ReplaceProps>, N>
  /** Components that render nothing. */
  hide?: N[]
}

interface Rule {
  before: ComponentType<Props>[]
  after: ComponentType<Props>[]
  replace: ComponentType<ReplaceProps>[]
  hide: boolean
}

let rules = new Map<string, Rule>()
let wrappers = new WeakMap<object, ComponentType<Props>>()

/** Takes the plugins' extensions; later ones go after (and replace on top of) earlier ones. */
export function install(extensions: Extension[]): void {
  const named = <C>(by?: Partial<Record<string, C>>) =>
    Object.entries(by ?? {}).filter((e): e is [string, C] => !!e[1])
  rules = new Map()
  wrappers = new WeakMap()
  const rule = (name: string) => {
    const r = rules.get(name) ?? { before: [], after: [], replace: [], hide: false }
    rules.set(name, r)
    return r
  }
  for (const e of extensions) {
    for (const [name, c] of named(e.before)) rule(name).before.push(c)
    for (const [name, c] of named(e.after)) rule(name).after.push(c)
    for (const [name, c] of named(e.replace)) rule(name).replace.push(c)
    for (const name of e.hide ?? []) rule(name).hide = true
  }
}

// The targets being drawn by a plugin right now: a plugin's component that shows its own target
// (a replaced button rendering the button) gets the original, not itself again.
const Drawing = createContext<ReadonlySet<string>>(new Set())

function wrapperFor(type: ComponentType<Props>, name: string, rule: Rule): ComponentType<Props> {
  function Extended(props: Props) {
    const drawing = useContext(Drawing)
    if (drawing.has(name)) return createElement(type, props)
    if (rule.hide) return null
    let node: ReactNode = createElement(type, props)
    for (const R of rule.replace) node = createElement(R, { ...props, original: node })
    const inner = new Set(drawing).add(name)
    return createElement(
      Drawing.Provider,
      { value: inner },
      ...rule.before.map((B) => createElement(B, props)),
      node,
      ...rule.after.map((A) => createElement(A, props)),
    )
  }
  Extended.displayName = `Extended(${name})`
  return Extended
}

/** The component an element is drawn with: the app's own, or the same one with the plugins' rules
 * around it. One wrapper per component, so React keeps its state between renders. */
export function extended<T>(type: T): T {
  if (!rules.size || !type || (typeof type !== 'function' && typeof type !== 'object')) return type
  const name = (type as { __target?: string }).__target
  const rule = name ? rules.get(name) : undefined
  if (!name || !rule) return type
  const key = type as object
  let wrapper = wrappers.get(key)
  if (!wrapper) {
    wrapper = wrapperFor(type as ComponentType<Props>, name, rule)
    wrappers.set(key, wrapper)
  }
  return wrapper as T
}
