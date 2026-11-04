import { expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { MockAppState, SAMPLE_ME } from '../../src/app/app-state'
import { useGameSpoilers } from '../../src/lib/use-game-spoilers'
import { mockApi } from '../support/web'

function Preference() {
  const { revealed, saving, setRevealed } = useGameSpoilers('game:1')
  return (
    <button type="button" disabled={saving} onClick={() => void setRevealed(true)}>
      {revealed ? 'revealed' : saving ? 'saving' : 'hidden'}
    </button>
  )
}

test('pending save blocks duplicate clicks and a late response cannot update a different account', async () => {
  let finish!: (value: unknown) => void
  const calls = mockApi({
    '/api/account/trophy-visibility': () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  })
  const setMe = mock(() => {})
  const view = (id: string) => (
    <MemoryRouter>
      <MockAppState value={{ me: { ...SAMPLE_ME, id }, setMe }}>
        <Preference />
      </MockAppState>
    </MemoryRouter>
  )
  const rendered = render(view('user:first'))
  fireEvent.click(screen.getByRole('button', { name: 'hidden' }))
  expect((screen.getByRole('button', { name: 'saving' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'saving' }))
  expect(calls).toHaveLength(1)
  expect(calls[0].body).toEqual({ game: 'game:1', owner: 'user:first', revealed: true })
  rendered.rerender(view('user:second'))
  await act(async () => finish({ revealedTrophyGames: ['game:1'] }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'hidden' })).toBeTruthy())
  expect(setMe).not.toHaveBeenCalled()
})

test('unmount before a save completes does not update account state', async () => {
  let finish!: (value: unknown) => void
  mockApi({
    '/api/account/trophy-visibility': () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  })
  const setMe = mock(() => {})
  const rendered = render(
    <MemoryRouter>
      <MockAppState value={{ setMe }}>
        <Preference />
      </MockAppState>
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'hidden' }))
  rendered.unmount()
  await act(async () => finish({ revealedTrophyGames: ['game:1'] }))
  expect(setMe).not.toHaveBeenCalled()
})
