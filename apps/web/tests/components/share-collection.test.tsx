import { afterEach, expect, mock, test } from 'bun:test'
import { act, fireEvent, screen } from '@testing-library/react'
import { ShareCollection } from '../../src/components/share-collection'
import { mockApi, renderApp } from '../support/web'

afterEach(() => mock.restore())

test('the button opens this month, this year and all of them, and Escape closes it', () => {
  renderApp(<ShareCollection />)
  fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }))
  for (const name of ['Deste mês', 'Deste ano', 'Todas'])
    expect(screen.getByRole('button', { name })).toBeTruthy()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('button', { name: 'Deste mês' })).toBeNull()
})

test('a period with no platinum says so instead of an empty image', async () => {
  const calls = mockApi({
    '/api/share/platinums?period=month': {
      player: { onlineId: 'Kratos', avatarUrl: null },
      period: 'month',
      month: 11,
      year: 2026,
      total: 0,
      overall: 3,
      hours: null,
      platinums: [],
    },
  })
  renderApp(<ShareCollection />)
  fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }))
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Deste mês' }))
  })
  expect(calls.some((c) => c.path === '/api/share/platinums?period=month')).toBe(true)
  expect(await screen.findByText('Nenhuma platina neste período ainda.')).toBeTruthy()
})
