import { expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { BootScreen } from '../../src/components/boot-screen'

test('the page under the boot screen stays still until it starts to fade', () => {
  const html = document.documentElement
  const { rerender, unmount } = render(<BootScreen />)
  expect('booting' in html.dataset).toBe(true)
  rerender(<BootScreen leaving />)
  expect('booting' in html.dataset).toBe(false)
  rerender(<BootScreen />)
  unmount()
  expect('booting' in html.dataset).toBe(false)
})
