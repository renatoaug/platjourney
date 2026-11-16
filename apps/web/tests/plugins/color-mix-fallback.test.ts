import { expect, test } from 'bun:test'
import {
  componentTokens,
  themeTokens,
  withColorMixFallback,
  withoutColorMix,
} from '../../color-mix-fallback'

const tokens = themeTokens(`
:root {
  --palette-white: #ffffff;
  --palette-lime: #c2f366;
  /* a comment */
  --color-overlay: var(--palette-white);
  --color-accent: var(--palette-lime);
  --alpha-line: 22%;
}
:root[data-accent="cyan"] { --color-accent: #4ff0e4; }
@media (min-width: 761px) { :root { --alpha-line: 30%; } }
`)

test('the default theme is read from the top-level :root blocks only', () => {
  expect(tokens.get('--color-accent')).toBe('var(--palette-lime)')
  expect(tokens.get('--alpha-line')).toBe('22%')
})

test('a mix with transparent becomes the color at that share of its opacity', () => {
  expect(
    withoutColorMix(
      'color-mix(in srgb, var(--color-overlay) var(--alpha-line), transparent)',
      tokens,
    ),
  ).toBe('rgba(255, 255, 255, 0.22)')
  expect(
    withoutColorMix(
      '0 0 4px color-mix(in srgb, var(--color-accent) 50%, transparent), 0 0 1px red',
      tokens,
    ),
  ).toBe('0 0 4px rgba(194, 243, 102, 0.5), 0 0 1px red')
  expect(withoutColorMix('color-mix(in srgb, #000000 50%, #ffffff)', tokens)).toBe(
    'rgba(128, 128, 128, 1)',
  )
})

test('a mix it cannot compute is left out', () => {
  expect(withoutColorMix('color-mix(in srgb, var(--unknown) 50%, transparent)', tokens)).toBe(
    undefined,
  )
  expect(withoutColorMix('color-mix(in oklch, red 50%, blue)', tokens)).toBe(undefined)
})

test('each rule that mixes is repeated with plain colors, only for browsers without color-mix', () => {
  const css = `@layer screens {
  .ring-track { stroke: color-mix(in srgb, var(--color-overlay) var(--alpha-line), transparent); fill: none; }
  .plain { color: red; }
  @keyframes pulse { from { color: color-mix(in srgb, red 50%, blue); } }
}`
  const out = withColorMixFallback(css, tokens)
  expect(out).toContain(
    '@supports not (color: color-mix(in srgb, red 50%, blue)) {\n.ring-track { stroke: rgba(255, 255, 255, 0.22); }\n}',
  )
  expect(out.match(/@supports not/g)).toHaveLength(1)
})

test('a token a component defines is read, and a token that is a mix is replaced too', () => {
  const all = new Map(tokens)
  componentTokens(
    `.tinted { --game-tint-deep: color-mix(in srgb, var(--game-tint, var(--color-accent)) 50%, transparent); }`,
    all,
  )
  expect(
    withoutColorMix(
      'linear-gradient(var(--game-tint-deep), color-mix(in srgb, var(--game-tint-deep) 50%, transparent))',
      all,
    ),
  ).toBe('linear-gradient(rgba(194, 243, 102, 0.5), rgba(194, 243, 102, 0.25))')
})
