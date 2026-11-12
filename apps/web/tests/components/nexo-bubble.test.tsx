import { expect, test } from 'bun:test'
import { clampBubble } from '../../src/components/nexo-bubble'

test('the floating Nexo stays inside the window and above the space a phone bottom bar takes', () => {
  expect(clampBubble({ x: -50, y: -50 }, 1280, 800)).toEqual({ x: 8, y: 8 })
  expect(clampBubble({ x: 5000, y: 5000 }, 1280, 800)).toEqual({ x: 1212, y: 732 })
  expect(clampBubble({ x: 5000, y: 5000 }, 375, 812, 70)).toEqual({ x: 307, y: 678 })
  expect(clampBubble({ x: 400, y: 300 }, 1280, 800)).toEqual({ x: 400, y: 300 })
})
