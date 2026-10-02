// Screenshots every screen at desktop and phone width and runs axe on each one.
// bun run ui:check [route ...]   routes like /, /game, /goals; default is all of them.
// Needs the built app running (bun run build, then UI_URL, default http://localhost:3000) and a user in the database
// (UI_USER = PSN online id; default is the first user). Output goes to .ui-check/.
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, rmSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { type Browser, chromium, type Page } from 'playwright'
import { closeDb } from '../../server/src/db.ts'
import { createSession } from '../../server/src/repository/auth.ts'
import { listUsers } from '../../server/src/repository/user.ts'

const BASE = process.env.UI_URL ?? 'http://localhost:3000'
const OUT = '.ui-check'
const ROUTES = [
  '/',
  '/game',
  '/nexo',
  '/goals',
  '/discover',
  '/guides',
  '/history',
  '/usage',
  '/profile',
]
const VIEWPORTS = [
  { name: '1280', width: 1280, height: 900 },
  { name: '375', width: 375, height: 812 },
]

async function sessionToken(): Promise<string> {
  const users = await listUsers()
  const user = process.env.UI_USER
    ? users.find((u) => u.psn_online_id.toLowerCase() === process.env.UI_USER?.toLowerCase())
    : users[0]
  if (!user) throw new Error('no user found; set UI_USER to a PSN online id in the database')
  const token = randomBytes(32).toString('hex')
  await createSession(user.id, createHash('sha256').update(token).digest('hex'), 1)
  return token
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  await page.waitForSelector('#root > *', { timeout: 20_000 }).catch(() => {})
  await page
    .waitForFunction(() => !document.querySelector('.page.active .sk'), null, { timeout: 20_000 })
    .catch(() => {})
  await page.waitForTimeout(300)
}

async function check(browser: Browser, token: string | null, routes: string[]) {
  const problems: string[] = []
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: vp, colorScheme: 'dark' })
    if (token) await context.addCookies([{ name: 'platjourney_session', value: token, url: BASE }])
    const page = await context.newPage()
    page.on('pageerror', (e) => problems.push(`${vp.name} js error: ${e.message}`))
    for (const route of token ? routes : ['login']) {
      const url = route === 'login' ? `${BASE}/` : `${BASE}/#${route}`
      await page.goto(url)
      await settle(page)
      const name = route === '/' ? 'home' : route.replace(/^\//, '').replace(/[/.]/g, '-')
      await page.screenshot({ path: `${OUT}/${name}-${vp.name}.png`, fullPage: true })
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      if (overflow) problems.push(`${name} @${vp.name}: horizontal scroll`)
      const { violations } = await new AxeBuilder({ page }).analyze()
      for (const v of violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'))
        problems.push(
          `${name} @${vp.name}: ${v.id} (${v.nodes.length}) ${v.help}${process.env.UI_VERBOSE ? `\n    ${v.nodes.map((n) => `${n.target.join(' ')} ${n.failureSummary?.split('\n')[1] ?? ''}`).join('\n    ')}` : ''}`,
        )
    }
    await context.close()
  }
  return problems
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const token = await sessionToken()
await closeDb()
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ROUTES
const browser = await chromium.launch()
const problems = [...(await check(browser, token, routes)), ...(await check(browser, null, []))]
await browser.close()
console.log(`screenshots in ${OUT}/`)
if (problems.length) {
  console.log(problems.map((p) => `- ${p}`).join('\n'))
  process.exit(1)
}
console.log('no serious axe violations, no horizontal scroll')
