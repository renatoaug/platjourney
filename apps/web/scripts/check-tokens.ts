// Fails when the web app uses a CSS custom property nobody defines (a renamed or misspelled token).
// A var() with a fallback, like var(--i, 0), is allowed: it is set per element.
import { Glob } from 'bun'

const root = new URL('../', import.meta.url).pathname
const files = [
  ...new Glob('{src,.storybook}/**/*.{css,ts,tsx}').scanSync({ cwd: root, dot: true }),
].map((f) => `${root}${f}`)
const defined = new Set<string>()
const used = new Map<string, string>()
for (const file of files) {
  const text = await Bun.file(file).text()
  for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(m[1])
  // Custom properties set from React, like style={{ '--i': i }}.
  for (const m of text.matchAll(/'(--[a-z0-9-]+)'\s*:/g)) defined.add(m[1])
  for (const m of text.matchAll(/var\((--[a-z0-9-]+)\s*([,)])/g))
    if (m[2] === ')' && !used.has(m[1])) used.set(m[1], file)
}
const missing = [...used].filter(([name]) => !defined.has(name))
for (const [name, file] of missing) console.log(`${file}: ${name} is not defined in any stylesheet`)
if (missing.length) process.exit(1)
