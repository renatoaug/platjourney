import { expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { EmptyState, ErrorState } from '../src/ui/states'

test('an empty state shows its text and the next step', () => {
  render(<EmptyState action={<button type="button">Ver todos</button>}>nenhuma ainda</EmptyState>)
  expect(screen.getByText('nenhuma ainda')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Ver todos' })).toBeTruthy()
})

test('an error state is announced', () => {
  render(<ErrorState>Não deu para carregar.</ErrorState>)
  expect(screen.getByRole('alert').textContent).toBe('Não deu para carregar.')
})

test('with an icon and a title a state becomes a small panel', () => {
  const { container } = render(
    <EmptyState icon="compass" title="Nada ainda" action={<button type="button">Buscar</button>}>
      Explica o que fazer
    </EmptyState>,
  )
  expect(container.querySelector('.empty-rich .empty-icon')).toBeTruthy()
  expect(screen.getByText('Nada ainda').tagName).toBe('B')
  expect(screen.getByRole('button', { name: 'Buscar' })).toBeTruthy()
})

test('a rich error is announced and marked as an error', () => {
  const { container } = render(
    <ErrorState icon="warning" title="Fora do ar">
      Tente de novo
    </ErrorState>,
  )
  expect(screen.getByRole('alert').textContent).toContain('Fora do ar')
  expect(container.querySelector('.empty-icon.error')).toBeTruthy()
})
