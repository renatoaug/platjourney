import { afterEach, beforeEach, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { CommandPalette, PaletteDialog } from '../../src/components/command-palette'
import type { GuidesPage } from '../../src/pages/guides'

const screens = [
  { to: '/', label: 'Visão geral', icon: 'dashboard' },
  { to: '/guides', label: 'Guias', icon: 'search' },
]
const page = (names: string[]): GuidesPage => ({
  page: 1,
  size: 24,
  total: names.length,
  items: names.map((name, i) => ({
    id: `game:${i + 1}`,
    name,
    cover_url: null,
    platforms: ['PS5'],
    release_year: 2020,
    guide:
      i === 0
        ? { difficulty: 3, hours: 40, hasMissables: false, hasOnline: false, unobtainable: null }
        : null,
  })),
})

let path = ''
function Where() {
  path = useLocation().pathname
  return null
}

const open = (search: (q: string) => Promise<GuidesPage>, onClose = () => {}) =>
  render(
    <MemoryRouter>
      <PaletteDialog screens={screens} onClose={onClose} search={search} />
      <Where />
    </MemoryRouter>,
  )

const type = async (text: string) => {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: text } })
  await act(() => new Promise((r) => setTimeout(r, 250)))
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  path = ''
})

test('typing finds games, the ones with a guide marked, and Enter opens the chosen one', async () => {
  const asked: string[] = []
  let closed = false
  open(
    async (q) => {
      asked.push(q)
      return page(['Days Gone', 'Days of War'])
    },
    () => {
      closed = true
    },
  )
  await type('days')
  expect(asked).toEqual(['days'])
  expect(screen.getByText('Days Gone')).toBeTruthy()
  expect(screen.getByText('Com guia')).toBeTruthy()
  expect(screen.getByText('Sem guia ainda')).toBeTruthy()
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
  expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true')
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
  expect(path).toBe('/title/game/game%3A2')
  expect(closed).toBe(true)
  // The game opened comes first next time, before anything is typed.
  expect(JSON.parse(localStorage.getItem('palette.recent') ?? '[]')[0].name).toBe('Days of War')
})

test('before typing it lists the recent games and the screens; a query narrows the screens', async () => {
  localStorage.setItem('palette.recent', JSON.stringify(page(['Saros']).items))
  open(async () => page([]))
  expect(screen.getByText('Vistos há pouco')).toBeTruthy()
  expect(screen.getByText('Saros')).toBeTruthy()
  expect(screen.getByText('Visão geral')).toBeTruthy()
  await type('guia')
  expect(screen.queryByText('Visão geral')).toBeNull()
  fireEvent.click(screen.getByText('Guias'))
  expect(path).toBe('/guides')
})

test('one letter does not search; no match and a failure say so', async () => {
  let calls = 0
  const { unmount } = open(async () => {
    calls++
    return page([])
  })
  await type('d')
  expect(calls).toBe(0)
  await type('zzzz')
  expect(screen.getByText('Nenhum jogo com “zzzz”.')).toBeTruthy()
  unmount()
  open(async () => {
    throw new Error('down')
  })
  await type('days')
  expect(screen.getByRole('alert').textContent).toContain('A busca falhou')
})

test('⌘K and "/" open the search from anywhere, but "/" in a field types', () => {
  render(
    <MemoryRouter>
      <input aria-label="campo" />
      <CommandPalette screens={screens} />
    </MemoryRouter>,
  )
  fireEvent.keyDown(window, { key: 'k', metaKey: true })
  expect(document.querySelector('.palette')).toBeTruthy()
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
  expect(document.querySelector('.palette')).toBeNull()
  screen.getByLabelText('campo').focus()
  fireEvent.keyDown(window, { key: '/' })
  expect(document.querySelector('.palette')).toBeNull()
  ;(document.activeElement as HTMLElement).blur()
  fireEvent.keyDown(window, { key: '/' })
  expect(document.querySelector('.palette')).toBeTruthy()
})
