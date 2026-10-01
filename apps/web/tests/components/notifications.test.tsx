import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { SAMPLE_DATA, useApp } from '../../src/app/app-state'
import { tipsData } from '../../src/components/nexo-brief.stories'
import { Notifications } from '../../src/components/notifications'
import { mockApi, never, renderApp, reply } from '../support/web'

afterEach(() => mock.restore())

// The fixture tips as notices: the first one still unread, one about the whole library.
const items = tipsData.map((t, i) => ({
  ...t,
  read_at: i === 0 ? null : t.created_at,
  game: i === 2 ? null : t.game,
}))

const bell = () => screen.getByRole('button', { name: /^Notificações/ })
const panel = () => document.getElementById('notif-panel') as HTMLElement

function Unread() {
  return <output aria-label="não lidas">{useApp().data?.unread}</output>
}

function setup(unread: number, routes: Parameters<typeof mockApi>[0]) {
  const calls = mockApi(routes)
  renderApp(
    <>
      <Notifications />
      <Unread />
    </>,
    { path: '/', value: { data: { ...SAMPLE_DATA, unread } } },
  )
  return calls
}

test('the bell counts what is new', () => {
  setup(2, {})
  expect(bell().getAttribute('aria-label')).toBe('Notificações, 2 novas')
  expect(bell().textContent).toBe('2')
  expect(panel().hidden).toBe(true)
})

test('more than nine is 9+, and none hides the badge', () => {
  const { unmount } = renderApp(<Notifications />, {
    value: { data: { ...SAMPLE_DATA, unread: 12 } },
  })
  expect(bell().textContent).toBe('9+')
  unmount()
  renderApp(<Notifications />, { value: { data: { ...SAMPLE_DATA, unread: 0 } } })
  expect(bell().getAttribute('aria-label')).toBe('Notificações')
  expect((document.getElementById('notif-badge') as HTMLElement).hidden).toBe(true)
})

test('opening lists the notices, then marks them read everywhere', async () => {
  const calls = setup(2, {
    '/api/notifications': { items, total: 3 },
    'POST /api/notifications/read': {},
  })
  fireEvent.click(bell())
  expect(panel().hidden).toBe(false)
  expect(bell().getAttribute('aria-expanded')).toBe('true')
  const articles = await within(panel()).findAllByRole('article')
  expect(articles).toHaveLength(3)
  expect(articles[0].className).toContain('is-new')
  expect(articles[1].className).not.toContain('is-new')
  expect(within(articles[0]).getByText('troféu')).toBeTruthy()
  expect(within(articles[2]).getByText('Sua biblioteca')).toBeTruthy()
  expect(within(panel()).getByText('3')).toBeTruthy()
  await waitFor(() =>
    expect(screen.getByRole('status', { name: 'não lidas' }).textContent).toBe('0'),
  )
  expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
    'GET /api/notifications?page=1&size=8',
    'POST /api/notifications/read',
  ])
  expect(within(panel()).getByRole('link', { name: /Ver histórico completo/ })).toBeTruthy()
})

test('with nothing new, opening does not mark anything', async () => {
  const calls = setup(0, { '/api/notifications': { items: [], total: 0 } })
  fireEvent.click(bell())
  expect(await within(panel()).findByText(/Nenhuma notificação ainda\./)).toBeTruthy()
  expect(calls).toHaveLength(1)
})

test('a failed load says so', async () => {
  setup(0, { '/api/notifications': reply(500) })
  fireEvent.click(bell())
  expect((await within(panel()).findByRole('alert')).textContent).toBe(
    'Não conseguimos carregar as notificações.',
  )
})

test('loading shows skeleton rows', () => {
  setup(0, { '/api/notifications': never })
  fireEvent.click(bell())
  expect(panel().querySelectorAll('.row')).toHaveLength(3)
})

test('many notices are paged', async () => {
  const calls = setup(0, { '/api/notifications': { items, total: 20 } })
  fireEvent.click(bell())
  const pages = await within(panel()).findByRole('navigation', { name: 'Páginas de notificações' })
  const buttons = within(pages).getAllByRole('button')
  expect(buttons.map((b) => b.textContent)).toEqual(['1', '2', '3'])
  expect(buttons[0].getAttribute('aria-current')).toBe('page')
  fireEvent.click(buttons[0])
  expect(calls).toHaveLength(1)
  fireEvent.click(within(pages).getByRole('button', { name: 'Página 3' }))
  await waitFor(() => expect(calls.at(-1)?.path).toBe('/api/notifications?page=3&size=8'))
  await waitFor(() =>
    expect(
      within(panel()).getByRole('button', { name: 'Página 3' }).getAttribute('aria-current'),
    ).toBe('page'),
  )
})

test('a click outside, Escape or the bell closes it; a click inside does not', async () => {
  setup(0, { '/api/notifications': { items, total: 3 } })
  const closed = () => waitFor(() => expect(panel().hidden).toBe(true))

  fireEvent.click(bell())
  await within(panel()).findAllByRole('article')
  fireEvent.click(panel())
  expect(panel().className).toContain('is-open')
  fireEvent.click(document.body)
  expect(panel().className).toContain('is-closing')
  await closed()

  fireEvent.click(bell())
  fireEvent.keyDown(document, { key: 'Enter' })
  expect(panel().className).toContain('is-open')
  fireEvent.keyDown(document, { key: 'Escape' })
  await closed()
  expect(document.activeElement === bell()).toBe(true)

  fireEvent.click(bell())
  expect(bell().hasAttribute('data-tip')).toBe(false)
  fireEvent.click(bell())
  await closed()
  expect(bell().getAttribute('data-tip')).toBe('Notificações')
})

test('following a game closes the panel', async () => {
  setup(0, { '/api/notifications': { items, total: 3 } })
  fireEvent.click(bell())
  const [first] = await within(panel()).findAllByRole('article')
  fireEvent.click(within(first).getByRole('link', { name: 'Days Gone' }))
  expect(screen.getByTestId('location').textContent).toBe('/title/game/game%3A19561')
  await waitFor(() => expect(panel().hidden).toBe(true))
})

test('a long notice starts clamped, with "Ler tudo"', async () => {
  const proto = HTMLElement.prototype
  const saved = Object.getOwnPropertyDescriptor(proto, 'scrollHeight')
  Object.defineProperty(proto, 'scrollHeight', { configurable: true, get: () => 200 })
  try {
    setup(0, { '/api/notifications': { items: items.slice(0, 1), total: 1 } })
    fireEvent.click(bell())
    const more = await within(panel()).findByRole('button', { name: 'Ler tudo' })
    fireEvent.click(more)
    expect(within(panel()).queryByRole('button', { name: 'Ler tudo' })).toBeNull()
    expect(within(panel()).getByRole('article').className).toContain('is-open')
  } finally {
    if (saved) Object.defineProperty(proto, 'scrollHeight', saved)
    else delete (proto as unknown as Record<string, unknown>).scrollHeight
  }
})
