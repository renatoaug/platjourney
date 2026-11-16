import { expect, test } from 'bun:test'
import { withContainerFallback } from '../../container-fallback'

test('a container query is followed by the same rules on the window, for browsers without it', () => {
  const css = `@layer screens {
  .grid { grid-template-columns: 1fr 1fr; }
  @container (max-width: 720px) {
    .grid { grid-template-columns: 1fr; }
  }
}`
  const out = withContainerFallback(css)
  expect(out).toContain('@container (max-width: 720px)')
  expect(out).toContain(
    '@supports not (container-type: inline-size) {\n@media (max-width: 752px) {\n    .grid { grid-template-columns: 1fr; }\n  }\n}',
  )
  // Still inside the layer, so the cascade order does not change.
  expect(out.trimEnd().endsWith('}\n}')).toBe(true)
})

test('nested blocks, min-width and several queries in a file are all kept whole', () => {
  const css = `@container (min-width: 640px) { .a { & .b { gap: 4px; } } }
.c { color: red; }
@container (max-width: 380px) { .d { flex: 1; } }`
  const out = withContainerFallback(css)
  expect(out).toContain('@media (min-width: 672px) { .a { & .b { gap: 4px; } } }')
  expect(out).toContain('@media (max-width: 412px) { .d { flex: 1; } }')
  expect(out).toContain('.c { color: red; }')
})

test('a file without container queries is left as it is', () => {
  const css = '.a { color: red; }\n@media (max-width: 760px) { .a { color: blue; } }'
  expect(withContainerFallback(css)).toBe(css)
})
