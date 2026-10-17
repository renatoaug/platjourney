// bun run test:coverage — runs every test suite with coverage and fails below the floor.
//
// Each app is checked on its own: the server and the web app with bun's lcov report, the AI service
// with pytest-cov. Coverage tools only measure the files a test loads, so a module nobody tests
// would not lower the number at all. The source list is therefore discovered from disk, and a
// file that no test loads counts with all its lines uncovered.
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const FLOOR = 80

interface Suite {
  name: string
  tests: string
  preload?: string
  sources: string
  // Files with nothing to test on their own: entry points that only start the app, and stories.
  skip: RegExp
  // Test files per Bun process. One process for the whole web suite grows until Bun stalls for
  // seconds (tests time out) or crashes; smaller runs stay well clear of it.
  chunk?: number
}

const SUITES: Suite[] = [
  {
    name: 'server',
    tests: 'apps/server/tests',
    // Every server test file runs with tests/env.ts first, so none can reach a real database.
    preload: './apps/server/tests/env.ts',
    sources: 'apps/server/src',
    skip: /\/index\.ts$/,
  },
  {
    name: 'web',
    tests: 'apps/web/tests',
    preload: './apps/web/tests/setup.ts',
    sources: 'apps/web/src',
    skip: /(\.stories\.tsx$|\/stories\/|\/main\.tsx$|\.d\.ts$|\/fixtures\.ts$)/,
    chunk: 12,
  },
]

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

// Lines that count as code when a file was never loaded: everything but blanks and comments.
function codeLines(file: string): number {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => {
      const t = l.trim()
      return t && !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*')
    }).length
}

// A file that only declares types has no line to run, so no test can cover it.
function typesOnly(file: string): boolean {
  const code = readFileSync(file, 'utf8')
  return !/^\s*(export\s+)?(default\s+)?(async\s+)?(const|let|var|function|class|enum)\b/m.test(
    code,
  )
}

function run(cmd: string[], cwd = ROOT): boolean {
  const proc = Bun.spawnSync(cmd, { cwd, stdout: 'inherit', stderr: 'inherit' })
  return proc.exitCode === 0
}

// Bun itself sometimes crashes mid-suite (a segfault: killed by a signal or exit code 128+), which
// says nothing about the tests. A crashed suite runs once more; a test that fails does not.
function runTests(cmd: string[]): boolean {
  for (let attempt = 1; ; attempt++) {
    const proc = Bun.spawnSync(cmd, { cwd: ROOT, stdout: 'inherit', stderr: 'inherit' })
    if (proc.exitCode === 0) return true
    const crashed = proc.signalCode != null || (proc.exitCode ?? 0) >= 128
    if (!crashed || attempt === 2) return false
    console.warn('\nBun crashed, not a test: running the suite again\n')
  }
}

const problems: string[] = []
const tmp = mkdtempSync(join(tmpdir(), 'platjourney-cov-'))
try {
  for (const suite of SUITES) {
    const files = walk(join(ROOT, suite.tests))
      .filter((f) => /\.test\.tsx?$/.test(f))
      .map((f) => relative(ROOT, f))
      .sort()
    const size = suite.chunk ?? files.length
    const reports: string[] = []
    for (let i = 0; i < files.length; i += size) {
      const dir = join(tmp, `${suite.name}-${i}`)
      const ok = runTests([
        'bun',
        'test',
        ...files.slice(i, i + size).map((f) => `./${f}`),
        ...(suite.preload ? ['--preload', suite.preload] : []),
        '--coverage',
        '--coverage-reporter=lcov',
        `--coverage-dir=${dir}`,
      ])
      if (!ok) problems.push(`${suite.name}: tests failed`)
      const lcov = join(dir, 'lcov.info')
      if (Bun.file(lcov).size) reports.push(readFileSync(lcov, 'utf8'))
    }

    // Each run reports the files it loaded; a line counts as covered if any run hit it.
    const hits = new Map<string, Map<number, number>>()
    let file: string | null = null
    for (const raw of reports.join('\n').split('\n')) {
      const line = raw.trim()
      if (line.startsWith('SF:')) {
        file = relative(ROOT, resolve(ROOT, line.slice(3)))
        if (!hits.has(file)) hits.set(file, new Map())
      } else if (line.startsWith('DA:') && file) {
        const [n, count] = line.slice(3).split(',').map(Number)
        const seen = hits.get(file) as Map<number, number>
        seen.set(n, Math.max(seen.get(n) ?? 0, count))
      }
    }

    const sources = walk(join(ROOT, suite.sources))
      .map((f) => relative(ROOT, f))
      .filter((f) => /\.(ts|tsx)$/.test(f) && !suite.skip.test(`/${f}`))
      .filter((f) => hits.has(f) || !typesOnly(join(ROOT, f)))
      .sort()
    let total = 0
    let covered = 0
    const rows: [string, number, number][] = []
    for (const f of sources) {
      const lines = hits.get(f)
      const found = lines?.size ? lines.size : codeLines(join(ROOT, f))
      const hit = lines ? [...lines.values()].filter((c) => c > 0).length : 0
      total += found
      covered += hit
      rows.push([f, found, hit])
    }
    const pct = total ? (covered / total) * 100 : 100
    console.log(`\n${suite.name}`)
    for (const [f, found, hit] of rows.sort((a, b) => a[2] / a[1] - b[2] / b[1])) {
      const shown = hits.has(f) ? `${((hit / found) * 100).toFixed(1)}%` : 'NOT LOADED'
      console.log(`  ${f.padEnd(56)}${String(found).padStart(6)}${shown.padStart(12)}`)
    }
    console.log(
      `  ${'TOTAL'.padEnd(56)}${String(total).padStart(6)}${`${pct.toFixed(1)}%`.padStart(12)}`,
    )
    if (pct < FLOOR) problems.push(`${suite.name}: ${pct.toFixed(1)}% is below the ${FLOOR}% floor`)
  }

  const ai = run(
    [
      'uv',
      'run',
      'pytest',
      '-q',
      '--cov=platjourney_ai',
      '--cov-report=term',
      `--cov-fail-under=${FLOOR}`,
    ],
    join(ROOT, 'services/ai'),
  )
  if (!ai) problems.push(`ai: tests failed or coverage is below the ${FLOOR}% floor`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

if (problems.length) {
  console.error('\nCoverage check failed:')
  for (const p of new Set(problems)) console.error(`  - ${p}`)
  console.error('\nAdd tests for the code you changed.')
  process.exit(1)
}
console.log(`\nOK: every app at or above ${FLOOR}%`)
