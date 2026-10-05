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

test('a plugin can add to the sign-in screen', () => {
  render(
    <PluginSlot
      name="sign-in"
      module={{ slots: { 'sign-in': () => <a href="/terms">termos</a> } }}
    />,
  )
  expect(screen.getByText('termos')).toBeTruthy()
})
