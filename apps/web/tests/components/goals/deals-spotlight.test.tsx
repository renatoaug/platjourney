import { expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
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

test("a game the player's own PS Plus includes comes first, free, and four fit a page", () => {
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
  expect(cards).toHaveLength(4)
  expect(cards[0].classList.contains('mine')).toBe(true)
  expect(cards[0].textContent).toContain('No seu PS Plus Extra')
  const pages = screen.getByRole('navigation', { name: 'Páginas de promoções' })
  // The band's pager: only the arrows and the page count.
  expect(within(pages).getByText(/^1\/\d+$/)).toBeTruthy()
  expect(within(pages).getByRole('button', { name: 'Próxima página' })).toBeTruthy()
  expect(within(pages).queryByRole('button', { name: 'Página 2' })).toBeNull()
})

test('"Já tenho" hands the game to the page, and only when the page allows it', () => {
  const interests = [{ ...open[0], deal: deal(1425, 2850, 50) }] as Interest[]
  const owned: string[] = []
  const { rerender } = render(
    <MemoryRouter>
      <DealsSpotlight interests={interests} onOwned={(i) => owned.push(i.id)} />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: /Já tenho/ }))
  expect(owned).toEqual([interests[0].id])
  rerender(
    <MemoryRouter>
      <DealsSpotlight interests={interests} />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('button', { name: /Já tenho/ })).toBeNull()
})
