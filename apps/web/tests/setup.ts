// Loaded before every web test (bun test --preload): a DOM for React to render into, and a clean
// slate between tests.
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register({ url: 'http://localhost:3000/' })
// Vite puts the platform's version in at build time; tests run without Vite.
;(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = '0.0.0-test'
// A browser in Portuguese, so the app's own locale resolution lands on pt-BR too.
Object.defineProperty(navigator, 'language', { value: 'pt-BR', configurable: true })

const { afterEach, beforeEach } = await import('bun:test')
const { cleanup } = await import('@testing-library/react')
const { setLocale } = await import('../src/i18n/locale')

// Tests assert the pt-BR texts whatever the machine's language; a test that wants English
// calls setLocale('en', { persist: false }) itself.
beforeEach(() => setLocale('pt-BR', { persist: false }))

// Tests never reach the network. A request no test faked (mockApi, or its own spy on fetch) is
// refused and fails the test that made it, instead of quietly hitting a server that is running here
// and missing in CI.
const unfaked: string[] = []
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  unfaked.push(url)
  throw new TypeError(`fetch not faked in this test: ${url}`)
}) as unknown as typeof fetch

afterEach(() => {
  cleanup()
  localStorage.clear()
  const urls = unfaked.splice(0)
  if (urls.length) throw new Error(`fetch not faked in this test: ${[...new Set(urls)].join(', ')}`)
})
