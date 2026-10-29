import { expect, test } from 'bun:test'
import { screen } from '@testing-library/react'
import { TrophyRoom } from '../../src/components/trophy-room'
import type { Platinum } from '../../src/pages/profile'
import { renderApp } from '../support/web'

const plat = (name: string, earnedAt: string, rarity: number, hours: number | null) =>
  ({
    game: { id: `game:${name}`, name, cover_url: null },
    platform: 'PS5',
    earnedAt,
    rarity,
    hours,
  }) as unknown as Platinum

const list = [
  plat('Ghost', '2025-11-02', 7, 54),
  plat('Detroit', '2026-04-10', 1.4, 19),
  plat('Hogwarts', '2026-03-18', 1.9, 73),
  plat('Spider', '2026-05-08', 13.8, 16),
  plat('Old', '2021-01-10', 9, 30),
]
const card = (label: string) => screen.getByText(label).closest('a') as HTMLElement

test('the records: the rarest, the fastest, the longest and the first, each linking to its game', () => {
  renderApp(<TrophyRoom platinums={list} />)
  expect(card('A mais rara').textContent).toContain('Detroit')
  expect(card('A mais rara').textContent).toContain('1,4% dos jogadores têm')
  expect(card('A mais rápida').textContent).toContain('Spider')
  expect(card('A mais longa').textContent).toContain('Hogwarts')
  expect(card('A primeira').textContent).toContain('Old')
  expect(card('A mais rara').getAttribute('href')).toBe('/title/game/game%3ADetroit')
})

test('without hours the time records are left out', () => {
  renderApp(<TrophyRoom platinums={list.map((p) => ({ ...p, hours: null }))} />)
  expect(screen.queryByText('A mais rápida')).toBeNull()
  expect(screen.getByText('A mais rara')).toBeTruthy()
})

test('no platinum, no room', () => {
  const { container } = renderApp(<TrophyRoom platinums={[]} />)
  expect(container.querySelector('.trophy-room')).toBeNull()
})
