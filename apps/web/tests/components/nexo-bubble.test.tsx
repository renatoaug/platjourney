import { expect, test } from 'bun:test'
import { fireEvent, screen } from '@testing-library/react'
import { clampBubble, NexoBubble } from '../../src/components/nexo-bubble'
import { renderApp } from '../support/web'

test('the floating Nexo stays inside the window and above the space a phone bottom bar takes', () => {
  expect(clampBubble({ x: -50, y: -50 }, 1280, 800)).toEqual({ x: 8, y: 8 })
  expect(clampBubble({ x: 5000, y: 5000 }, 1280, 800)).toEqual({ x: 1212, y: 732 })
  expect(clampBubble({ x: 5000, y: 5000 }, 375, 812, 70)).toEqual({ x: 307, y: 678 })
  expect(clampBubble({ x: 400, y: 300 }, 1280, 800)).toEqual({ x: 400, y: 300 })
})

test('while Nexo is held it shows it, and a finger moving does not scroll the page', () => {
  renderApp(<NexoBubble initial={{ x: 100, y: 100 }} />)
  const bubble = screen.getByRole('button', { name: 'Falar com o Nexo' })
  const swipe = () => {
    const move = new Event('touchmove', { cancelable: true, bubbles: true })
    bubble.dispatchEvent(move)
    return move.defaultPrevented
  }
  expect(swipe()).toBe(false)
  fireEvent.pointerDown(bubble, { button: 0, clientX: 130, clientY: 130 })
  // Held at once, before it moves: Nexo grows and glows.
  expect(bubble.classList.contains('is-held')).toBe(true)
  expect(swipe()).toBe(true)
  fireEvent.pointerUp(bubble)
  expect(bubble.classList.contains('is-held')).toBe(false)
  expect(swipe()).toBe(false)
})
