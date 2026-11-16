import type { Plugin } from 'vite'

// Container queries reach Chrome and Android WebView only from version 105. The Android app runs in
// the phone's WebView, which can be older: there a rule like `@container (max-width: 720px)` never
// applies, so a grid built for a wide screen stays wide on a phone. After each container query this
// adds the same rules under a media query on the window, for browsers without container queries.
// A container sits inside the page's side padding, so the window is taken as 32px wider.
const PADDING = 32
const QUERY = /@container\s*\(\s*(max|min)-width:\s*(\d+)px\s*\)\s*\{/g

/** The index just past the brace that closes the block opened at `open`. */
function blockEnd(css: string, open: number): number {
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return i + 1
  }
  return -1
}

export function withContainerFallback(css: string): string {
  let out = ''
  let from = 0
  for (const match of css.matchAll(QUERY)) {
    const start = match.index ?? 0
    if (start < from) continue
    const open = start + match[0].length - 1
    const end = blockEnd(css, open)
    if (end < 0) break
    const rules = css.slice(open + 1, end - 1)
    const width = Number(match[2]) + PADDING
    out += `${css.slice(from, end)}\n@supports not (container-type: inline-size) {\n@media (${match[1]}-width: ${width}px) {${rules}}\n}`
    from = end
  }
  return out + css.slice(from)
}

export function containerFallback(): Plugin {
  return {
    name: 'platjourney:container-fallback',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.css($|\?)/.test(id) || !code.includes('@container')) return null
      return { code: withContainerFallback(code), map: null }
    },
  }
}
