import { expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { DealsSpotlight } from '../../../src/components/goals/deals-spotlight'
import { sampleGoals } from '../../../src/components/goals/fixtures'
import type { Interest } from '../../../src/lib/types'

const deal = (price: number, base: number, discount: number): Interest['deal'] => ({
  price,
  base,
  discount,
  endsAt: '2026-10-22T12:00:00Z',
  plus: false,
  currency: 'BRL',
  storeUrl: 'https://store.playstation.com/pt-br/concept/1',
})
const open = sampleGoals.interests.filter((g) => !g.done)

test('the saved games on sale, deepest first, with the price, the old one and the store', () => {
  const interests = [
    { ...open[0], deal: deal(1425, 2850, 50) },
    { ...open[1], deal: deal(4485, 14950, 70) },
    { ...open[2], deal: { ...deal(0, 0, 0), plus: true } },
  ]
  const { container } = render(
    <MemoryRouter>
      <DealsSpotlight interests={interests as Interest[]} />
    </MemoryRouter>,
  )
  expect(screen.getByText('2 jogos dos seus interesses saem por menos')).toBeTruthy()
  const offs = [...container.querySelectorAll('.deal-off')].map((e) => e.textContent)
  expect(offs).toEqual(['-70%', '-50%'])
  expect(container.querySelector('s')?.textContent).toMatch(/149,50/)
  const store = screen.getAllByRole('link', { name: /Ver na PS Store/ })[0] as HTMLAnchorElement
  expect(store.target).toBe('_blank')
})

test('nothing on sale shows nothing', () => {
  const { container } = render(
    <MemoryRouter>
      <DealsSpotlight interests={sampleGoals.interests} />
    </MemoryRouter>,
  )
  expect(container.innerHTML).toBe('')
})

test("a game the player's own PS Plus includes comes first, free, and six fit a page", () => {
  const many = Array.from({ length: 8 }, (_, n) => ({
    ...open[n % open.length],
    id: `interest:${n}`,
    deal: deal(1000, 2000, 10 + n),
  }))
  many[5] = {
    ...many[5],
    deal: {
      ...(deal(0, 22990, 0) as NonNullable<Interest['deal']>),
      plus: true,
      plusTier: 'extra',
      mine: true,
    },
  }
  const { container } = render(
    <MemoryRouter>
      <DealsSpotlight interests={many as Interest[]} />
    </MemoryRouter>,
  )
  const cards = container.querySelectorAll('.deal')
  expect(cards).toHaveLength(6)
  expect(cards[0].classList.contains('mine')).toBe(true)
  expect(cards[0].textContent).toContain('No seu PS Plus Extra')
  expect(screen.getByRole('navigation', { name: 'Páginas de promoções' })).toBeTruthy()
})
