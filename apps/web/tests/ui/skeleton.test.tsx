import { expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { repeat, Sk } from '../../src/ui/skeleton'

test('skeleton bars take their size, and repeat makes n rows', () => {
  const { container } = render(
    <div>
      <Sk />
      <Sk w="40%" h={30} style={{ marginTop: 4 }} />
      {repeat(3, (i) => (
        <i className="row">{i}</i>
      ))}
    </div>,
  )
  const bars = container.querySelectorAll<HTMLElement>('.sk')
  expect(bars[0].style.width).toBe('100%')
  expect(bars[0].style.height).toBe('12px')
  expect(bars[1].style.width).toBe('40%')
  expect(bars[1].style.marginTop).toBe('4px')
  expect([...container.querySelectorAll('.row')].map((r) => r.textContent)).toEqual(['0', '1', '2'])
})
