import { expect, test } from 'bun:test'
import { screen } from '@testing-library/react'
import { NextUp, nextUp } from '../../src/components/goals/next-up'
import type { Interest } from '../../src/lib/types'
import { renderApp } from '../support/web'

const interest = (n: number, position: number, extra: Partial<Interest> = {}) =>
  ({
    id: `interest:${n}`,
    game: { id: `game:${n}`, name: `Game ${n}`, cover_url: null },
    position,
    progress: null,
    done: false,
    ...extra,
  }) as Interest

test('the next platinum is the first in the player order that is not platinumed yet', () => {
  const list = [interest(1, 2), interest(2, 1, { done: true }), interest(3, 3)]
  expect(nextUp(list)?.id).toBe('interest:1')
  expect(nextUp([interest(4, 1, { done: true })])).toBeNull()
})

test('the card shows the progress, or that it was never started, and opens the game', () => {
  const { unmount } = renderApp(<NextUp interest={interest(1, 1, { progress: 38 })} />)
  expect(screen.getByText('38% dos troféus')).toBeTruthy()
  expect(screen.getByRole('link', { name: /Abrir jogo/ }).getAttribute('href')).toContain(
    'game%3A1',
  )
  unmount()
  renderApp(<NextUp interest={interest(2, 1)} />)
  expect(screen.getByText('Ainda não começou')).toBeTruthy()
})
