import { expect, mock, test } from 'bun:test'
import { act, fireEvent, screen } from '@testing-library/react'
import { type NextPick, NextPickBox } from '../../src/components/goals/next-pick'
import { renderApp } from '../support/web'

const pick: NextPick = {
  game: { id: 'game:2', name: 'Inside' },
  why: 'Curto depois de um longo',
  firstStep: 'Comece pelos orbes',
}

test('asking shows the pick, why and where to start, and keeps it for the visit', async () => {
  const cache: Record<string, unknown> = {}
  const onDone = mock(() => {})
  renderApp(<NextPickBox ask={() => Promise.resolve({ pick })} cache={cache} onDone={onDone} />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Deixa o Nexo escolher' }))
  })
  expect(screen.getByRole('link', { name: /Inside/ })).toBeTruthy()
  expect(screen.getByText('Curto depois de um longo')).toBeTruthy()
  expect(screen.getByText('Comece pelos orbes')).toBeTruthy()
  expect(cache.nextPick).toEqual(pick)
  expect(onDone).toHaveBeenCalled()
})

test('a kept pick shows at once', () => {
  renderApp(<NextPickBox ask={() => new Promise(() => {})} cache={{ nextPick: pick }} />)
  expect(screen.getByRole('button', { name: 'Escolher de novo' })).toBeTruthy()
})

test('a failure says so and lets the player ask again', async () => {
  renderApp(<NextPickBox ask={() => Promise.reject(new Error('x'))} cache={{}} />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Deixa o Nexo escolher' }))
  })
  expect(screen.getByRole('alert').textContent).toBe(
    'O Nexo não conseguiu escolher agora. Tenta de novo.',
  )
})
