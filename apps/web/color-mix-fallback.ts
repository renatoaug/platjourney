import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

// color-mix() reaches Chrome and Android WebView only from version 111. On an older WebView a
// declaration that uses it is dropped whole: a cover loses the gradient that keeps its text
// readable, a ring loses its track. The mixes here are of the theme's tokens, so this computes each
// one from the default theme (theme.css, before any skin or accent the player picks) and repeats the
// rule with the plain color, only for browsers without color-mix(). A token a component defines
// (a game's tint, set per game at runtime) is taken at the value its stylesheet gives it.
const SUPPORTS = '@supports not (color: color-mix(in srgb, red 50%, blue))'

type Rgba = [number, number, number, number]

const NAMED: Record<string, Rgba> = {
  transparent: [0, 0, 0, 0],
  white: [255, 255, 255, 1],
  black: [0, 0, 0, 1],
}

/** The declarations of the default theme: the top-level :root blocks of theme.css. */
export function themeTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>()
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  let depth = 0
  let i = 0
  while (i < clean.length) {
    const c = clean[i]
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (depth === 0 && clean.startsWith(':root', i) && /^:root\s*\{/.test(clean.slice(i))) {
      const open = clean.indexOf('{', i)
      const close = clean.indexOf('}', open)
      for (const decl of clean.slice(open + 1, close).split(';')) {
        const m = decl.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/)
        if (m) tokens.set(m[1], m[2])
      }
      i = close + 1
      continue
    }
    i++
  }
  return tokens
}

/** Custom properties the other stylesheets define, for the tokens the theme does not have. The
 * first definition found wins, and the theme's always does. */
export function componentTokens(css: string, tokens: Map<string, string>): void {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of clean.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+?)\s*;/g)) {
    if (!tokens.has(m[1])) tokens.set(m[1], m[2].replace(/\s+/g, ' '))
  }
}

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return cssFiles(path)
    return entry.name.endsWith('.css') ? [path] : []
  })
}

/** The default theme, then what the app's other stylesheets define. */
export function appTokens(themePath: string, srcDir: string): Map<string, string> {
  const tokens = themeTokens(readFileSync(themePath, 'utf8'))
  for (const file of cssFiles(srcDir)) componentTokens(readFileSync(file, 'utf8'), tokens)
  return tokens
}

/** The index of the parenthesis that closes the one at `open`. */
function closing(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')' && --depth === 0) return i
  }
  return -1
}

/** Splits on top-level commas. */
function args(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') depth--
    else if (text[i] === ',' && depth === 0) {
      out.push(text.slice(from, i).trim())
      from = i + 1
    }
  }
  out.push(text.slice(from).trim())
  return out
}

function resolve(value: string, tokens: Map<string, string>, seen = 0): string | undefined {
  const v = value.trim()
  if (seen > 20) return undefined
  const ref = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/)
  if (ref) {
    const next = tokens.get(ref[1]) ?? ref[2]
    return next === undefined ? undefined : resolve(next, tokens, seen + 1)
  }
  return v
}

function fromHex(hex: string): Rgba | undefined {
  const h = hex.length <= 4 ? [...hex].map((x) => x + x).join('') : hex
  if (h.length !== 6 && h.length !== 8) return undefined
  const n = (i: number) => Number.parseInt(h.slice(i, i + 2), 16)
  return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1]
}

function fromRgb(list: string): Rgba | undefined {
  const p = list.split(/[\s,/]+/).filter(Boolean)
  const alpha = p[3] ?? '1'
  const a = alpha.endsWith('%') ? Number.parseFloat(alpha) / 100 : Number(alpha)
  const c = [Number(p[0]), Number(p[1]), Number(p[2]), a] as Rgba
  return c.every((x) => Number.isFinite(x)) ? c : undefined
}

function parseColor(value: string, tokens: Map<string, string>): Rgba | undefined {
  const v = resolve(value, tokens)?.toLowerCase()
  if (!v) return undefined
  if (v in NAMED) return NAMED[v]
  const hex = v.match(/^#([0-9a-f]{3,8})$/)
  if (hex) return fromHex(hex[1])
  const rgb = v.match(/^rgba?\(([^)]+)\)$/)
  if (rgb) return fromRgb(rgb[1])
  return v.startsWith('color-mix(') ? mix(v, tokens) : undefined
}

function percent(value: string | undefined, tokens: Map<string, string>): number | undefined {
  if (value === undefined) return undefined
  const v = resolve(value, tokens)
  const m = v?.match(/^(-?[\d.]+)%$/)
  return m ? Number(m[1]) / 100 : undefined
}

/** Splits on top-level spaces. */
function words(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i <= text.length; i++) {
    const c = text[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if ((c === ' ' || i === text.length) && depth === 0) {
      if (i > from) out.push(text.slice(from, i))
      from = i + 1
    }
  }
  return out
}

/** One color and its share: `var(--color-accent) var(--alpha-tint)` or `#fff 40%`. */
function stop(text: string, tokens: Map<string, string>): [Rgba, number | undefined] | undefined {
  const parts = words(text)
  if (parts.length === 0 || parts.length > 2) return undefined
  const color = parseColor(parts[0], tokens)
  if (!color) return undefined
  if (parts.length === 1) return [color, undefined]
  const share = percent(parts[1], tokens)
  return share === undefined ? undefined : [color, share]
}

/** color-mix(in srgb, A p, B q) with premultiplied alpha, as the spec mixes it. */
function mix(text: string, tokens: Map<string, string>): Rgba | undefined {
  const open = text.indexOf('(')
  const [space, a, b] = args(text.slice(open + 1, closing(text, open)))
  if (space !== 'in srgb' || !a || !b) return undefined
  const first = stop(a, tokens)
  const second = stop(b, tokens)
  if (!first || !second) return undefined
  let p = first[1]
  let q = second[1]
  if (p === undefined && q === undefined) p = q = 0.5
  else if (p === undefined) p = 1 - (q as number)
  else if (q === undefined) q = 1 - p
  const sum = p + (q as number)
  if (sum <= 0) return undefined
  const [wa, wb] = [p / sum, (q as number) / sum]
  const alpha = (first[0][3] * wa + second[0][3] * wb) * Math.min(sum, 1)
  const channel = (i: number) =>
    alpha === 0
      ? 0
      : (first[0][i] * first[0][3] * wa + second[0][i] * second[0][3] * wb) /
        (first[0][3] * wa + second[0][3] * wb)
  return [channel(0), channel(1), channel(2), alpha]
}

function rgba([r, g, b, a]: Rgba): string {
  const n = (x: number) => Math.round(x)
  return `rgba(${n(r)}, ${n(g)}, ${n(b)}, ${Math.round(a * 1000) / 1000})`
}

/** The value with every color-mix() replaced by its color, or undefined if one cannot be computed. */
export function withoutColorMix(value: string, tokens: Map<string, string>): string | undefined {
  let out = value
  for (let at = out.indexOf('color-mix('); at >= 0; at = out.indexOf('color-mix(')) {
    const end = closing(out, at + 'color-mix'.length)
    if (end < 0) return undefined
    const color = mix(out.slice(at, end + 1), tokens)
    if (!color) return undefined
    out = out.slice(0, at) + rgba(color) + out.slice(end + 1)
  }
  // A token that is itself a mix would bring color-mix() back where it is used.
  return out.replace(/var\(\s*--[\w-]+\s*\)/g, (ref) => {
    const value = resolve(ref, tokens)
    const color = value?.startsWith('color-mix(') ? mix(value, tokens) : undefined
    return color ? rgba(color) : ref
  })
}

/** The declarations of a rule's body that mix, with plain colors; those it cannot compute are left out. */
function plainDeclarations(body: string, tokens: Map<string, string>): string[] {
  const out: string[] = []
  for (const d of body.replace(/\/\*[\s\S]*?\*\//g, '').split(/;(?![^(]*\))/)) {
    if (!d.includes('color-mix(')) continue
    const colon = d.indexOf(':')
    const value = withoutColorMix(d.slice(colon + 1), tokens)
    if (value !== undefined) out.push(`${d.slice(0, colon).trim()}: ${value.trim()};`)
  }
  return out
}

/** Where a comment or a string that starts at `i` ends, or `i` when none starts there. */
function skip(css: string, i: number): number {
  if (css.startsWith('/*', i)) {
    const end = css.indexOf('*/', i + 2)
    return end < 0 ? css.length : end + 2
  }
  const c = css[i]
  if (c !== '"' && c !== "'") return i
  const end = css.indexOf(c, i + 1)
  return end < 0 ? css.length : end + 1
}

type Block = { head: string; open: number; nested: boolean }

function open(stack: Block[], head: string, at: number) {
  if (stack.length) stack[stack.length - 1].nested = true
  stack.push({ head, open: at, nested: false })
}

/** Every block of the stylesheet as it closes, with its parent and where it ends. */
function* blocks(css: string): Generator<[Block, Block | undefined, number]> {
  // Each open block: its header and whether it holds other blocks.
  const stack: Block[] = []
  let headFrom = 0
  for (let i = 0; i < css.length; i++) {
    const next = skip(css, i)
    if (next !== i) {
      i = next - 1
      continue
    }
    const c = css[i]
    if (c === '{') open(stack, css.slice(headFrom, i), i)
    else if (c === '}') {
      const block = stack.pop()
      if (block) yield [block, stack[stack.length - 1], i]
    }
    if (c === '{' || c === '}' || c === ';') headFrom = i + 1
  }
}

/** After every rule that uses color-mix(), the same rule with plain colors under @supports not. */
export function withColorMixFallback(css: string, tokens: Map<string, string>): string {
  if (!css.includes('color-mix(')) return css
  const inserts: [number, string][] = []
  for (const [block, parent, at] of blocks(css)) {
    const head = block.head.replace(/\/\*[\s\S]*?\*\//g, '').trim()
    if (block.nested || head.startsWith('@') || parent?.head.includes('@keyframes')) continue
    const plain = plainDeclarations(css.slice(block.open + 1, at), tokens)
    if (plain.length) inserts.push([at + 1, `\n${SUPPORTS} {\n${head} { ${plain.join(' ')} }\n}`])
  }
  let out = css
  for (const [at, text] of inserts.reverse()) out = out.slice(0, at) + text + out.slice(at)
  return out
}

export function colorMixFallback(themePath: string, srcDir: string): Plugin {
  let tokens: Map<string, string> | undefined
  return {
    name: 'platjourney:color-mix-fallback',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.css($|\?)/.test(id) || !code.includes('color-mix(')) return null
      tokens ??= appTokens(themePath, srcDir)
      return { code: withColorMixFallback(code, tokens), map: null }
    },
  }
}
