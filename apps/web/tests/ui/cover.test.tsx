import { expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { Cover } from '../../src/ui/cover'

test('a cover shows the art, decorative', () => {
  const { container } = render(<Cover url="/logo.svg" name="Days Gone" className="rec-cover" />)
  const img = container.querySelector('img') as HTMLImageElement
  expect(img.getAttribute('src')).toBe('/logo.svg')
  expect(img.getAttribute('alt')).toBe('')
  expect(img.className).toBe('rec-cover')
})

test('without art the cover is the first letter', () => {
  const { container } = render(<Cover name="  days gone" />)
  const el = container.firstElementChild as HTMLElement
  expect(el.textContent).toBe('D')
  expect(el.className).toBe('cover-placeholder')
  expect(el.getAttribute('aria-hidden')).toBe('true')
  render(<Cover />)
  expect(screen.getByText('?')).toBeTruthy()
})
