import { expect, test } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import { CoverWall } from '../../../src/components/auth/cover-wall'

test('the covers fill the rows, each row twice so its drift never ends, and the count goes up', async () => {
  const covers = Array.from({ length: 8 }, (_, i) => `c${i}.jpg`)
  let count = 0
  const { container } = render(
    <CoverWall load={async () => ({ covers, guides: 1130 })} onCount={(n) => (count = n)} />,
  )
  await waitFor(() => expect(container.querySelectorAll('.cover-wall-row')).toHaveLength(4))
  expect(container.querySelectorAll('.cover-wall-row')[0].querySelectorAll('img')).toHaveLength(4)
  expect(count).toBe(1130)
})

test('without covers there is no wall', async () => {
  const { container } = render(<CoverWall load={async () => null} />)
  await Bun.sleep(10)
  expect(container.querySelector('.cover-wall')).toBeNull()
})
