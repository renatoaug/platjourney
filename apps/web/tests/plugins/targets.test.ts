import { expect, test } from 'bun:test'
import { componentsIn, pluginTargets, scanTargets } from '../../plugin-targets'

test('top-level components are targets; inner ones and constants are not', () => {
  const code = `
export function GameCard({ g }: Props) {
  function Inner() { return null }
  return null
}
function Row() { return null }
export default function Page() { return null }
const Badge = ({ n }: { n: number }) => null
export const Panel = memo(function Panel() { return null })
const NAV = [1, 2]
const LABELS = { a: 1 }
`
  expect(componentsIn(code)).toEqual(['GameCard', 'Row', 'Page', 'Badge', 'Panel'])
})

test('the build tags each component of an app file with its name', () => {
  const file = new URL('../../src/components/hero.tsx', import.meta.url).pathname
  const step = pluginTargets() as { transform: (code: string, id: string) => { code: string } }
  const out = step.transform('function HeroMeta() { return null }', file)
  expect(out.code).toContain('HeroMeta.__target = "HeroMeta";')
})

test('stories, tests and files outside the app are left alone', () => {
  const step = pluginTargets() as { transform: (code: string, id: string) => unknown }
  const stories = new URL('../../src/components/hero.stories.tsx', import.meta.url).pathname
  expect(step.transform('function Story() {}', stories)).toBeUndefined()
  expect(step.transform('function Plugin() {}', '/elsewhere/plugins/web.tsx')).toBeUndefined()
})

test('every component name in the app is unique and listed for plugins', async () => {
  const targets = scanTargets()
  const listed = await Bun.file(new URL('../../src/plugins/targets.ts', import.meta.url)).text()
  for (const name of targets.keys()) expect(listed).toContain(`'${name}'`)
})
