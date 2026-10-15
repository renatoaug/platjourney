import { expect, test } from 'bun:test'
import { fireEvent, screen, within } from '@testing-library/react'
import { SimilarGames } from '../../src/components/similar-games'
import { similarGamesData } from '../../src/components/similar-games.stories'
import { renderApp } from '../support/web'

const many = Array.from({ length: 9 }, (_, i) => ({
  ...similarGamesData[0],
  game: { id: `game:s${i}`, name: `Jogo ${i}` },
}))

test('six games a page, the base game first with its tag', () => {
  renderApp(
    <SimilarGames
      state={{
        status: 'ok',
        items: [...many, { ...similarGamesData[3], relation: 'base' }],
      }}
    />,
  )
  const cards = within(screen.getByRole('region', { name: 'Parecidos com este' })).getAllByRole(
    'link',
  )
  expect(cards).toHaveLength(6)
  expect(cards[0].textContent).toContain('Days Gone Remastered')
  const tag = cards[0].closest('.band-card')?.querySelector('.band-tag')
  expect(tag?.textContent).toBe('Jogo base')
  expect(document.querySelector('.game-band.compact')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
  expect(document.querySelectorAll('.band-card')).toHaveLength(4)
})

test('loading shows the band’s skeleton; empty and error show nothing', () => {
  const { container, rerender } = renderApp(<SimilarGames state={{ status: 'loading' }} />)
  expect(container.querySelectorAll('.game-band .band-cover.sk')).toHaveLength(6)
  expect(screen.getByRole('heading', { name: 'Parecidos com este' })).toBeTruthy()
  rerender(<SimilarGames state={{ status: 'ok', items: [] }} />)
  expect(container.querySelector('.game-band')).toBeNull()
  rerender(<SimilarGames state={{ status: 'error' }} />)
  expect(container.querySelector('.game-band')).toBeNull()
})
