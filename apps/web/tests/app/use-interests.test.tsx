import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { useInterests } from '../../src/app/use-interests'
import { sampleGoals } from '../../src/components/goals/fixtures'
import type { YearGoals } from '../../src/lib/types'
import { mockApi, renderApp, reply } from '../support/web'

afterEach(() => mock.restore())

const ghost = sampleGoals.interests[0]
const goals = (interests = [ghost]): YearGoals => ({ ...sampleGoals, interests })

function Probe() {
  const { interests, find, toggle } = useInterests()
  return (
    <div>
      <output aria-label="count">{interests.length}</output>
      <output aria-label="saved">{find(ghost.game.id) ? 'sim' : 'não'}</output>
      <button type="button" onClick={() => toggle(ghost.game.id, ghost.game.name)}>
        alternar
      </button>
    </div>
  )
}

const out = (name: string) => screen.getByRole('status', { name }).textContent

test('reads the interests from the app state', () => {
  renderApp(<Probe />, { value: { data: { ...SAMPLE_DATA, goals: goals() } } })
  expect(out('count')).toBe('1')
  expect(out('saved')).toBe('sim')
})

test('no state yet is no interests', () => {
  renderApp(<Probe />, { value: { data: null } })
  expect(out('count')).toBe('0')
})

test('saving a game adds it and offers to see the list', async () => {
  const calls = mockApi({ 'POST /api/goals': goals() })
  renderApp(<Probe />, { value: { data: { ...SAMPLE_DATA, goals: goals([]) } } })
  expect(out('saved')).toBe('não')
  fireEvent.click(screen.getByRole('button', { name: 'alternar' }))
  await waitFor(() => expect(out('saved')).toBe('sim'))
  expect(calls[0].body).toEqual({ command: `add ${ghost.game.id}` })
  expect(screen.getByText('Ghost of Tsushima salvo nos interesses')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Ver' }).getAttribute('href')).toBe('/goals')
})

test('a saved game is removed by its interest id', async () => {
  const calls = mockApi({ 'POST /api/goals': goals([]) })
  renderApp(<Probe />, { value: { data: { ...SAMPLE_DATA, goals: goals() } } })
  fireEvent.click(screen.getByRole('button', { name: 'alternar' }))
  await waitFor(() => expect(out('saved')).toBe('não'))
  expect(calls[0].body).toEqual({ command: `remove ${ghost.id}` })
  expect(screen.getByText('Ghost of Tsushima removido dos interesses')).toBeTruthy()
})

test('a failure keeps the list and says so', async () => {
  mockApi({ 'POST /api/goals': reply(500) })
  renderApp(<Probe />, { value: { data: { ...SAMPLE_DATA, goals: goals([]) } } })
  fireEvent.click(screen.getByRole('button', { name: 'alternar' }))
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Não conseguimos salvar.'),
  )
  expect(out('saved')).toBe('não')
})
