import { afterEach, expect, jest, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  AppStateProvider,
  MockAppState,
  SAMPLE_DATA,
  SAMPLE_ME,
  useApp,
} from '../../src/app/app-state'
import { ToastHost } from '../../src/ui/toast'
import { mockApi, never, reply } from '../support/web'

afterEach(() => {
  jest.useRealTimers()
  mock.restore()
})

// Shows what a screen would read from the app state, with buttons for its actions.
function Probe() {
  const app = useApp()
  return (
    <div>
      <output aria-label="sync">{app.sync}</output>
      <output aria-label="who">{app.me.onlineId}</output>
      <output aria-label="level">{app.data?.profile?.level ?? 'sem dados'}</output>
      <output aria-label="loading">{String(app.loading)}</output>
      <output aria-label="synced">{app.syncedAt ? 'sim' : 'não'}</output>
      <output aria-label="warming">{String(app.warming)}</output>
      <button type="button" onClick={() => app.loadState()}>
        recarregar
      </button>
      <button type="button" onClick={() => app.setData((d) => ({ ...d, unread: 5 }))}>
        ler
      </button>
      <button type="button" onClick={() => app.setMe({ ...app.me, onlineId: 'outro' })}>
        trocar
      </button>
    </div>
  )
}

const out = (name: string) => screen.getByRole('status', { name }).textContent

function renderProvider() {
  return render(
    <AppStateProvider me={SAMPLE_ME}>
      <Probe />
      <ToastHost />
    </AppStateProvider>,
  )
}

test('useApp outside the provider is a programming error', () => {
  const spy = mock(() => {})
  const original = console.error
  console.error = spy
  try {
    expect(() => render(<Probe />)).toThrow('useApp outside <AppStateProvider>')
  } finally {
    console.error = original
  }
})

test('loads /api/state on mount and marks the sync', async () => {
  mockApi({ '/api/state': SAMPLE_DATA })
  renderProvider()
  expect(out('sync')).toBe('connecting')
  expect(out('level')).toBe('sem dados')
  await waitFor(() => expect(out('sync')).toBe('connected'))
  expect(out('level')).toBe('312')
  expect(out('synced')).toBe('sim')
  expect(out('who')).toBe('jogador')
})

test('private trophies mark the sync private without an error toast', async () => {
  mockApi({ '/api/state': reply(409, { error: 'trophies_private' }) })
  renderProvider()
  await waitFor(() => expect(out('sync')).toBe('private'))
  expect(screen.queryByRole('alert')).toBeNull()
})

test('a failure marks the sync failed and says how to retry', async () => {
  mockApi({ '/api/state': reply(500) })
  renderProvider()
  await waitFor(() => expect(out('sync')).toBe('failed'))
  expect(screen.getByRole('alert').textContent).toContain('Não foi possível atualizar.')
})

test('a signed-out answer leaves it to the login screen', async () => {
  const calls = mockApi({ '/api/state': reply(401) })
  renderProvider()
  await waitFor(() => expect(calls).toHaveLength(1))
  await waitFor(() => expect(out('loading')).toBe('false'))
  expect(out('sync')).toBe('connecting')
  expect(screen.queryByRole('alert')).toBeNull()
})

test('a second load while one is running is ignored', async () => {
  const calls = mockApi({ '/api/state': never })
  renderProvider()
  await waitFor(() => expect(out('loading')).toBe('true'))
  fireEvent.click(screen.getByRole('button', { name: 'recarregar' }))
  expect(calls).toHaveLength(1)
})

test('reloads when the DLC preference changes and every minute', async () => {
  const calls = mockApi({ '/api/state': SAMPLE_DATA })
  jest.useFakeTimers()
  renderProvider()
  await act(async () => {})
  expect(calls).toHaveLength(1)
  await act(async () => {
    document.dispatchEvent(new Event('preferences:changed'))
  })
  expect(calls).toHaveLength(2)
  await act(async () => {
    jest.advanceTimersByTime(60_000)
  })
  expect(calls).toHaveLength(3)
})

test('setData does nothing before the first state, and setMe changes the player', async () => {
  mockApi({ '/api/state': never })
  renderProvider()
  fireEvent.click(screen.getByRole('button', { name: 'ler' }))
  expect(out('level')).toBe('sem dados')
  fireEvent.click(screen.getByRole('button', { name: 'trocar' }))
  expect(out('who')).toBe('outro')
})

test('MockAppState serves the sample data, or what the story passes', () => {
  render(
    <MockAppState>
      <Probe />
    </MockAppState>,
  )
  expect(out('level')).toBe('312')
  expect(out('sync')).toBe('connected')
  fireEvent.click(screen.getByRole('button', { name: 'recarregar' }))
  fireEvent.click(screen.getByRole('button', { name: 'trocar' }))
  fireEvent.click(screen.getByRole('button', { name: 'ler' }))
  expect(out('who')).toBe('jogador')
})

test('MockAppState with no data stays loading', () => {
  render(
    <MockAppState value={{ data: null, sync: 'failed' }}>
      <Probe />
    </MockAppState>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'ler' }))
  expect(out('level')).toBe('sem dados')
  expect(out('sync')).toBe('failed')
})

test('after sign-in it asks again every 3 s until the first game arrives, for up to 30 s', async () => {
  jest.useFakeTimers()
  let calls = 0
  const playing = { ...SAMPLE_DATA, current: { name: 'Astro Bot' } as typeof SAMPLE_DATA.current }
  mockApi({ '/api/state': () => (++calls >= 3 ? playing : SAMPLE_DATA) })
  renderProvider()
  await act(async () => {})
  expect(out('warming')).toBe('true')
  await act(async () => {
    jest.advanceTimersByTime(3_000)
  })
  await act(async () => {
    jest.advanceTimersByTime(3_000)
  })
  expect(calls).toBe(3)
  await act(async () => {
    jest.advanceTimersByTime(3_000)
  })
  expect(out('warming')).toBe('false')
  await act(async () => {
    jest.advanceTimersByTime(30_000)
  })
  expect(calls).toBe(3)
})

test('the quick retries stop after 30 s even without a game', async () => {
  jest.useFakeTimers()
  let calls = 0
  mockApi({
    '/api/state': () => {
      calls++
      return SAMPLE_DATA
    },
  })
  renderProvider()
  for (let i = 0; i < 12; i++)
    await act(async () => {
      jest.advanceTimersByTime(3_000)
    })
  expect(out('warming')).toBe('false')
  expect(calls).toBeLessThanOrEqual(11)
})

test('the demo never warms up', () => {
  mockApi({ '/api/state': SAMPLE_DATA })
  render(
    <AppStateProvider me={{ ...SAMPLE_ME, demo: true }}>
      <Probe />
    </AppStateProvider>,
  )
  expect(out('warming')).toBe('false')
})
