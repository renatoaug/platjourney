import { expect, test } from 'bun:test'
import { fireEvent, render } from '@testing-library/react'
import { TrophyArt } from '../../src/ui/trophy-art'

test('a trophy shows its icon, decorative', () => {
  const { container } = render(<TrophyArt url="/trophy.png" />)
  const img = container.querySelector('img') as HTMLImageElement
  expect(img.getAttribute('src')).toBe('/trophy.png')
  expect(img.getAttribute('alt')).toBe('')
})

test('without an icon, or when it fails to load, the trophy symbol shows instead', () => {
  expect(render(<TrophyArt />).container.querySelector('img')).toBeNull()
  const { container } = render(<TrophyArt url="/gone.png" />)
  fireEvent.error(container.querySelector('img') as HTMLImageElement)
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('svg')).not.toBeNull()
})
