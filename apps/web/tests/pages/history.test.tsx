import { expect, test } from 'bun:test'
import { fireEvent, screen } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import type { Tip } from '../../src/lib/types'
import { History } from '../../src/pages/history'
import { renderApp } from '../support/web'

const game = { id: 'game:19561', name: 'Days Gone' }
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

// The same timeline as the History stories.
const TIPS: Tip[] = [
  {
    id: 't1',
    kind: 'unlock',
    content: 'Achados e perdidos (bronze). Próximo: **Faça você mesmo no Oregon**.',
    created_at: hoursAgo(0),
    game,
  },
  {
    id: 't2',
    kind: 'chat',
    content: 'Sim: antes de terminar **Sarah está viva**, pegue os colecionáveis.',
    created_at: hoursAgo(0),
    game,
  },
  {
    id: 't4',
    kind: 'server',
    content: 'Os servidores de *Gran Turismo 7* voltaram.',
    created_at: hoursAgo(80),
    game: null,
  },
]

const filters = () => screen.getAllByRole('button').filter((b) => b.classList.contains('chip'))

test('everything Nexo said, grouped by day', () => {
  renderApp(<History />, { value: { data: { ...SAMPLE_DATA, tips: TIPS } } })
  expect(screen.getByRole('heading', { level: 1, name: 'Histórico' })).toBeTruthy()
  const days = screen.getAllByRole('heading', { level: 3 })
  expect(days).toHaveLength(2)
  expect(days[0].textContent).toBe('Hoje2')
  expect(screen.getAllByRole('article')).toHaveLength(3)
  expect(filters().find((b) => b.className.includes('active'))?.textContent).toBe('todos')
})

test('a filter narrows the list and is kept for the next visit', () => {
  const cache: Record<string, unknown> = {}
  const { unmount } = renderApp(<History />, {
    value: { data: { ...SAMPLE_DATA, tips: TIPS }, cache },
  })
  fireEvent.click(screen.getByRole('button', { name: 'servidor' }))
  expect(screen.getAllByRole('article')).toHaveLength(1)
  expect(screen.getByText('Sua biblioteca')).toBeTruthy()
  expect(cache.tipKind).toBe('server')
  unmount()

  renderApp(<History />, { value: { data: { ...SAMPLE_DATA, tips: TIPS }, cache } })
  expect(screen.getByRole('button', { name: 'servidor' }).className).toContain('active')
})

test('a filter with nothing has its own empty state, with a way back', () => {
  renderApp(<History />, {
    value: { data: { ...SAMPLE_DATA, tips: TIPS }, cache: { tipKind: 'route' } },
  })
  expect(screen.getByText('Nada de rota ainda')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Ver todos' }))
  expect(screen.getAllByRole('article')).toHaveLength(3)
})

test('an unknown kind is named as it came', () => {
  renderApp(<History />, {
    value: { data: { ...SAMPLE_DATA, tips: TIPS }, cache: { tipKind: 'novo' } },
  })
  expect(screen.getByText('Nada de novo ainda')).toBeTruthy()
})

test('no history yet', () => {
  renderApp(<History />, { value: { data: { ...SAMPLE_DATA, tips: [] } } })
  expect(screen.getByText('Nada no histórico ainda')).toBeTruthy()
})

test('loading, then a failed sync', () => {
  const { container, unmount } = renderApp(<History />, { value: { data: null } })
  expect(container.querySelectorAll('#tips .tip')).toHaveLength(5)
  unmount()
  renderApp(<History />, { value: { data: null, sync: 'failed' } })
  expect(screen.getByRole('alert').textContent).toContain('Não conseguimos carregar o histórico.')
})
