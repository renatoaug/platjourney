import { expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { Icon } from '../../src/ui/icon'

test('an icon points into the sprite and stays out of the accessibility tree', () => {
  const { container } = render(<Icon name="bell" className="big" />)
  const svg = container.querySelector('svg') as SVGElement
  expect(svg.getAttribute('class')).toBe('icon big')
  expect(svg.getAttribute('aria-hidden')).toBe('true')
  expect(svg.querySelector('use')?.getAttribute('href')).toBe('/icons.svg#bell')
})
