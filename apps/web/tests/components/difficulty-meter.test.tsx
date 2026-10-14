import { expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { bandOf, DifficultyMeter } from '../../src/components/difficulty-meter'

test('each number falls in its band', () => {
  expect([1, 3, 4, 5, 6, 7, 8, 10].map(bandOf)).toEqual([
    'easy',
    'easy',
    'medium',
    'medium',
    'hard',
    'hard',
    'brutal',
    'brutal',
  ])
})

test('the meter reads its number and band, and fills as many segments as the number', () => {
  const { container } = render(<DifficultyMeter value={7} look="badge" />)
  expect(screen.getByRole('img', { name: 'Dificuldade 7 de 10: Difícil' })).toBeTruthy()
  expect(container.querySelectorAll('.dm-segments i.on')).toHaveLength(7)
  expect(container.querySelector('.dm-hard')).toBeTruthy()
})

test('an estimated band has no number and says it is estimated', () => {
  render(<DifficultyMeter value="medium" look="compact" estimated />)
  expect(screen.getByRole('img', { name: 'Dificuldade ? de 10: Média' }).textContent).toContain(
    'estimada',
  )
})
