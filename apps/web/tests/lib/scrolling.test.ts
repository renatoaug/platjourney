import { expect, test } from 'bun:test'
import { markScrolling } from '../../src/lib/scrolling'

test('the root is marked while the page scrolls, and unmarked once it is still', async () => {
  const root = document.documentElement
  const stop = markScrolling(root)
  document.dispatchEvent(new Event('scroll'))
  expect(root.classList.contains('is-scrolling')).toBe(true)
  // A box of its own scrolling counts too.
  const box = document.createElement('div')
  document.body.append(box)
  box.dispatchEvent(new Event('scroll'))
  expect(root.classList.contains('is-scrolling')).toBe(true)
  await new Promise((done) => setTimeout(done, 250))
  expect(root.classList.contains('is-scrolling')).toBe(false)
  stop()
  box.remove()
})
