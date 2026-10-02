// Renders every Storybook story in a browser and fails on JS errors or a story that renders nothing.
// bun run build-storybook first; this serves storybook-static/ itself.
import { chromium } from 'playwright'

const root = new URL('../storybook-static/', import.meta.url).pathname
const server = Bun.serve({
  port: 0,
  fetch: (req) => {
    const path = new URL(req.url).pathname
    return new Response(Bun.file(root + (path === '/' ? 'index.html' : path.slice(1))))
  },
})
const base = `http://localhost:${server.port}`
const index = (await (await fetch(`${base}/index.json`)).json()) as {
  entries: Record<string, { id: string; type: string }>
}
const ids = Object.values(index.entries)
  .filter((e) => e.type === 'story')
  .map((e) => e.id)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const problems: string[] = []
let current = ''
page.on('pageerror', (e) => problems.push(`${current}: ${e.message}`))
page.on('console', (m) => {
  // Stories make no requests; missing images and fonts offline are not failures.
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text()))
    problems.push(`${current}: ${m.text().split('\n')[0]}`)
})
for (const id of ids) {
  current = id
  await page.goto(`${base}/iframe.html?id=${id}&viewMode=story`)
  await page.waitForTimeout(300)
  const rendered = await page.evaluate(
    () => !!document.querySelector('#storybook-root')?.children.length,
  )
  if (!rendered) problems.push(`${id}: rendered nothing`)
}
await browser.close()
server.stop()
console.log(`${ids.length} stories`)
if (problems.length) {
  console.log([...new Set(problems)].map((p) => `- ${p}`).join('\n'))
  process.exit(1)
}
console.log('every story renders without errors')
