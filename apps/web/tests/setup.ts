// Loaded before every web test (bun test --preload): a DOM for React to render into, and a clean
// slate between tests.
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register({ url: 'http://localhost:3000/' })
// A browser in Portuguese, so the app's own locale resolution lands on pt-BR too.
Object.defineProperty(navigator, 'language', { value: 'pt-BR', configurable: true })

const { afterEach, beforeEach } = await import('bun:test')
const { cleanup } = await import('@testing-library/react')
const { setLocale } = await import('../src/i18n/locale')

// Tests assert the pt-BR texts whatever the machine's language; a test that wants English
// calls setLocale('en', { persist: false }) itself.
beforeEach(() => setLocale('pt-BR', { persist: false }))

afterEach(() => {
  cleanup()
  localStorage.clear()
})
