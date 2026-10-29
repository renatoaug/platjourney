import { expect, test } from 'bun:test'
import { screen } from '@testing-library/react'
import { GuideSpotlight, pickOfTheDay } from '../../src/components/guide-spotlight'
import { renderApp } from '../support/web'

const game = (n: number, shot: string | null = `s${n}`, guide = true) => ({
  id: `game:${n}`,
  name: `Game ${n}`,
  cover_url: null,
  platforms: ['PS5'],
  release_year: 2020,
  shot,
  guide: guide ? { difficulty: 4, hours: 40, hasMissables: n === 2 } : null,
})

test('the guide of the day is the same all day and another the next, never one without a scene or guide', () => {
  const items = [game(1), game(2), game(3, null), game(4, 's4', false)]
  const day = new Date('2026-10-29T08:00:00Z')
  const later = new Date('2026-10-29T22:00:00Z')
  const tomorrow = new Date('2026-10-30T08:00:00Z')
  expect(pickOfTheDay(items, day)?.id).toBe(pickOfTheDay(items, later)?.id)
  expect(pickOfTheDay(items, tomorrow)?.id).not.toBe(pickOfTheDay(items, day)?.id)
  expect(['game:1', 'game:2']).toContain(pickOfTheDay(items, day)?.id ?? '')
  expect(pickOfTheDay([game(3, null)], day)).toBeNull()
})

test('the card links to the guide with its facts', () => {
  renderApp(<GuideSpotlight game={game(2)} />)
  expect(screen.getByRole('link', { name: /Abrir guia/ }).getAttribute('href')).toContain(
    'game%3A2',
  )
  expect(screen.getByText('Tem perdíveis')).toBeTruthy()
  expect(screen.getByTitle('~40h até a platina')).toBeTruthy()
})
