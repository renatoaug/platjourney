import { afterEach, beforeEach, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { useLingered } from '../../src/lib/use-lingered'

// One observer at a time, driven by the test: `show(true)` puts the element on screen.
let notify: ((entries: { isIntersecting: boolean }[]) => void) | null = null
const real = globalThis.IntersectionObserver
beforeEach(() => {
  globalThis.IntersectionObserver = class {
    constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
      notify = cb
    }
    observe() {}
    disconnect() {
      notify = null
    }
  } as unknown as typeof IntersectionObserver
})
afterEach(() => {
  globalThis.IntersectionObserver = real
})

const show = (on: boolean) => act(() => notify?.([{ isIntersecting: on }]))
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)))

function Part() {
  const ref = useRef<HTMLDivElement>(null)
  return <div ref={ref}>{useLingered(ref, 30) ? 'lingered' : 'reading'}</div>
}

test('only a stay on screen without a break counts, and then it sticks', async () => {
  render(<Part />)
  show(true)
  await wait(15)
  show(false)
  await wait(30)
  expect(screen.getByText('reading')).toBeTruthy()
  show(true)
  await wait(45)
  expect(screen.getByText('lingered')).toBeTruthy()
  show(false)
  expect(screen.getByText('lingered')).toBeTruthy()
})
