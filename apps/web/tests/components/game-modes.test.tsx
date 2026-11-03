import { expect, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { GameAbout } from '../../src/components/game-showcase'

/** A deterministic clock and measured overflow; no real animation, network or player data. */
function clock() {
  let now = 0
  let width = 100
  let reduced = false
  let id = 0
  const frames = new Map<number, FrameRequestCallback>()
  const media = new EventTarget() as MediaQueryList
  Object.defineProperty(media, 'matches', { get: () => reduced })
  const spies = [
    spyOn(performance, 'now').mockImplementation(() => now),
    spyOn(window, 'matchMedia').mockReturnValue(media),
    spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.set(++id, callback)
      return id
    }),
    spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((frame) => {
      frames.delete(frame)
    }),
  ]
  const dimensions = ['clientWidth', 'scrollWidth'] as const
  const descriptors = dimensions.map((key) =>
    Object.getOwnPropertyDescriptor(HTMLElement.prototype, key),
  )
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => width,
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get: () => 220,
  })
  return {
    advance(ms: number) {
      act(() => {
        for (let elapsed = 0; elapsed < ms; elapsed += 40) {
          now += 40
          const pending = [...frames.values()]
          frames.clear()
          for (const callback of pending) callback(now)
        }
      })
    },
    resize(value: number) {
      width = value
      act(() => window.dispatchEvent(new Event('resize')))
    },
    reduce() {
      reduced = true
      act(() => media.dispatchEvent(new Event('change')))
    },
    pending: () => frames.size,
    restore() {
      for (const spy of spies.reverse()) spy.mockRestore()
      dimensions.forEach((key, index) => {
        const descriptor = descriptors[index]
        if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor)
        else Reflect.deleteProperty(HTMLElement.prototype, key)
      })
    },
  }
}

const modes = ['Single player', 'Multiplayer', 'Co-operative']
const name = 'Um jogador, Multijogador, Cooperativo'

test('modes pause at both ends, return, and yield to focus and manual input', () => {
  const time = clock()
  const { unmount } = render(
    <GameAbout
      game={{ id: 'game:1', name: 'Example', modes, platforms: ['PS5'] }}
      name="Example"
    />,
  )
  try {
    const row = screen.getByRole('region', { name })
    expect(row.tabIndex).toBe(0)
    expect(row.parentElement?.dataset.preview).toBe('true')
    expect(
      row.parentElement?.querySelector('.game-modes-preview')?.getAttribute('aria-hidden'),
    ).toBe('true')
    time.advance(1600)
    expect(row.scrollLeft).toBe(0)
    time.advance(1400)
    expect(row.scrollLeft).toBeGreaterThan(0)
    expect(row.parentElement?.dataset.preview).toBe('false')
    fireEvent.focus(row)
    const focusedAt = row.scrollLeft
    time.advance(3000)
    expect(row.scrollLeft).toBe(focusedAt)
    fireEvent.blur(row)
    fireEvent.wheel(row)
    row.scrollLeft = 60
    time.advance(5800)
    expect(row.scrollLeft).toBe(60)
    time.advance(3000)
    expect(row.scrollLeft).toBe(120)
    time.advance(400)
    expect(row.scrollLeft).toBe(120)
    time.advance(2400)
    expect(row.scrollLeft).toBe(0)
    fireEvent.pointerEnter(row, { pointerType: 'mouse' })
    time.advance(4000)
    expect(row.scrollLeft).toBe(0)
    fireEvent.pointerLeave(row, { pointerType: 'mouse' })
    expect(row.textContent).toBe(name)
    expect(row.parentElement?.dataset.preview).toBe('true')
  } finally {
    unmount()
    expect(time.pending()).toBe(0)
    time.restore()
  }
})

test('modes stop automatically for reduced motion or when resize removes overflow', () => {
  const time = clock()
  const { unmount } = render(
    <GameAbout
      game={{ id: 'game:1', name: 'Example', modes, platforms: ['PS5'] }}
      name="Example"
    />,
  )
  try {
    const row = screen.getByRole('region', { name })
    time.resize(300)
    expect(time.pending()).toBe(0)
    expect(row.hasAttribute('tabindex')).toBe(false)
    expect(row.parentElement?.dataset.preview).toBe('false')
    time.resize(100)
    expect(time.pending()).toBe(1)
    expect(row.tabIndex).toBe(0)
    time.reduce()
    expect(time.pending()).toBe(0)
    row.scrollLeft = 40
    time.advance(10000)
    expect(row.scrollLeft).toBe(40)
  } finally {
    unmount()
    time.restore()
  }
})
