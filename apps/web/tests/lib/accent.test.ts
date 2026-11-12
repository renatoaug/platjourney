import { afterEach, expect, test } from 'bun:test'
import { applyAccent } from '../../src/lib/accent'

afterEach(() => {
  delete document.documentElement.dataset.accent
  localStorage.clear()
})

test('a picked accent paints the page and is remembered for the next visit', () => {
  applyAccent('violet')
  expect(document.documentElement.dataset.accent).toBe('violet')
  expect(localStorage.getItem('platjourney:accent')).toBe('violet')
})

test('lime, nothing or an unknown value is the default: no attribute, nothing remembered', () => {
  for (const accent of ['lime', undefined, null, 'neon'] as const) {
    applyAccent('cyan')
    applyAccent(accent as never)
    expect(document.documentElement.dataset.accent).toBeUndefined()
    expect(localStorage.getItem('platjourney:accent')).toBeNull()
  }
})
