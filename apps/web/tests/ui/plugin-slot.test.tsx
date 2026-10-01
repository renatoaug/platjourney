import { expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { PluginSlot } from '../../src/ui/plugin-slot'

test('a plain build renders nothing in a slot', () => {
  const { container } = render(<PluginSlot name="top-bar" />)
  expect(container.innerHTML).toBe('')
})

test('a plugin fills its slot', () => {
  render(<PluginSlot name="profile" module={{ slots: { profile: () => <p>plano</p> } }} />)
  expect(screen.getByText('plano')).toBeTruthy()
})
