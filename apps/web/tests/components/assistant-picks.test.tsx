import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { AssistantPicks } from '../../src/components/assistant-picks'
import type { AssistantPick } from '../../src/lib/types'
import { mockApi, renderApp } from '../support/web'

afterEach(() => mock.restore())

const pick = (id: string, name: string, assistant = 'Claude'): AssistantPick => ({
  game: { id, name } as AssistantPick['game'],
  reason: `${name} is short and fun.`,
  assistant,
  savedAt: '2026-10-20T12:00:00Z',
  difficulty: 3,
  hours: 12,
  playthroughs: 1,
  hasMissables: false,
  hasOnline: false,
  hasDifficultyTrophy: null,
})

test("the assistant's suggestions, with its name and reason; one leaves when removed", async () => {
  const calls = mockApi({
    '/api/assistant-picks': { items: [pick('game:1', 'Far Cry 5'), pick('game:2', 'Inside')] },
    'POST /api/assistant-picks/dismiss': { ok: true },
    '/api/interests': { items: [] },
  })
  renderApp(<AssistantPicks />)
  const shelf = await screen.findByRole('region', { name: 'Sugeridos pelo Claude' })
  expect(within(shelf).getByText('Far Cry 5 is short and fun.')).toBeTruthy()
  expect(shelf.querySelector('.band-tag')?.textContent).toBe('Claude')
  fireEvent.click(within(shelf).getByRole('button', { name: 'Tirar Far Cry 5 das sugestões' }))
  await waitFor(() => expect(within(shelf).queryByText('Far Cry 5')).toBeNull())
  expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ game: 'game:1' })
})

test('suggestions from both assistants share one title; none or a failure shows nothing', async () => {
  mockApi({
    '/api/assistant-picks': {
      items: [pick('game:1', 'Far Cry 5'), pick('game:2', 'Inside', 'ChatGPT')],
    },
  })
  renderApp(<AssistantPicks />)
  expect(await screen.findByRole('region', { name: 'Sugeridos no seu chat' })).toBeTruthy()
  mock.restore()
  mockApi({})
  const { container } = renderApp(<AssistantPicks />)
  await new Promise((r) => setTimeout(r, 10))
  expect(container.querySelector('.game-band')).toBeNull()
})
