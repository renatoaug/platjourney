import { afterEach, expect, mock, test } from 'bun:test'
import { act, fireEvent, screen } from '@testing-library/react'
import { SharePlatinum } from '../../src/components/share-platinum'
import { mockApi, renderApp } from '../support/web'

afterEach(() => mock.restore())

test('the button names the game it shares', () => {
  renderApp(<SharePlatinum gameId="game:1" name="Days Gone" />)
  expect(screen.getByRole('button', { name: 'Compartilhar a platina de Days Gone' })).toBeTruthy()
})

test('a card that cannot be built says so and lets the player try again', async () => {
  const calls = mockApi({})
  renderApp(<SharePlatinum gameId="game:1" name="Days Gone" />)
  const button = screen.getByRole('button', { name: 'Compartilhar a platina de Days Gone' })
  await act(async () => {
    fireEvent.click(button)
  })
  expect(calls.some((c) => c.path === '/api/share/platinum?game=game%3A1')).toBe(true)
  expect(await screen.findByText('Não foi possível montar a imagem. Tente de novo.')).toBeTruthy()
  expect(button.hasAttribute('disabled')).toBe(false)
})
