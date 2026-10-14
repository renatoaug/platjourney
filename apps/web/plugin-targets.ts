/** Every component of the app is a place a plugin can reach: at build time each one is tagged with
 * its name (`Name.__target = 'Name'`), and the JSX runtime (src/plugins/jsx-runtime.ts) looks the
 * tag up. Nothing in the screens marks anything; a new component is a target as soon as it exists. */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Plugin } from 'vite'

const SRC = new URL('./src/', import.meta.url).pathname

// Top-level components: `function Name(` or `const Name = (…) =>`, `memo(`, `forwardRef(`, `lazy(`,
// exported or not. Indented declarations live inside another component and are not targets.
const DECLARATION =
  /^(?:export\s+)?(?:default\s+)?(?:function\s+([A-Z][A-Za-z0-9]*)\s*[(<]|const\s+([A-Z][a-z][A-Za-z0-9]*)\s*(?::[^=]+)?=\s*(?:\(|memo\(|forwardRef\(|lazy\(|function))/gm

/** The app's own component files: not stories, tests or the plugin machinery. */
export function isAppComponentFile(path: string): boolean {
  return (
    path.startsWith(SRC) &&
    path.endsWith('.tsx') &&
    !/\.(stories|test)\.tsx$/.test(path) &&
    !path.startsWith(join(SRC, 'plugins/'))
  )
}

/** The component names a file declares at its top level. */
export function componentsIn(code: string): string[] {
  return [...code.matchAll(DECLARATION)].map((m) => m[1] ?? m[2])
}

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  )
}

/** Every target, by name, with the file that declares it. Two components with one name would make
 * the name ambiguous for a plugin, so that is an error to fix by renaming one of them. */
export function scanTargets(): Map<string, string> {
  const targets = new Map<string, string>()
  const clashes: string[] = []
  for (const file of files(SRC).filter(isAppComponentFile).sort()) {
    for (const name of componentsIn(readFileSync(file, 'utf8'))) {
      const where = relative(SRC, file)
      const other = targets.get(name)
      if (other) clashes.push(`${name}: ${other} and ${where}`)
      else targets.set(name, where)
    }
  }
  if (clashes.length)
    throw new Error(`components share a name, rename one of each:\n${clashes.join('\n')}`)
  return targets
}

/** The Vite step that tags each component with its name, after its declaration. */
export function pluginTargets(): Plugin {
  return {
    name: 'platjourney-plugin-targets',
    enforce: 'pre',
    buildStart() {
      scanTargets()
    },
    transform(code, id) {
      const path = id.split('?')[0]
      if (!isAppComponentFile(path)) return
      const names = componentsIn(code)
      if (!names.length) return
      const tags = names.map((n) => `${n}.__target = ${JSON.stringify(n)};`).join('\n')
      return { code: `${code}\n${tags}\n`, map: null }
    },
  }
}
