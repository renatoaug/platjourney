import { expect, test } from 'bun:test'
import { fireEvent, screen } from '@testing-library/react'
import { type Release, ReleasesView } from '../../src/components/releases'
import { renderApp } from '../support/web'

const NOW = Date.UTC(2026, 9, 13, 15)
const day = (offset: number) => new Date(Date.UTC(2026, 9, 13 + offset)).toISOString()
const release = (id: number, offset: number, extra: Partial<Release> = {}): Release => ({
  id: `game:${id}`,
  name: `Game ${id}`,
  cover_url: null,
  platforms: ['PS5', 'PC'],
  released_at: day(offset),
  listed: false,
  guide: null,
  ...extra,
})
const releases = [
  release(1, -3, { guide: { difficulty: 4, hours: 30 } }),
  release(2, -1, { listed: true }),
  release(3, 0),
  release(4, 1, { listed: true }),
  release(5, 9, { guide: { difficulty: 0, hours: 10 } }),
]

test('coming up first: today, tomorrow and a date, with what we have for each game', () => {
  renderApp(<ReleasesView load={{ status: 'ok', releases }} now={NOW} />)
  const names = screen
    .getAllByRole('article')
    .map((a) => a.querySelector('.release-body b')?.textContent)
  expect(names).toEqual(['Game 3', 'Game 4', 'Game 5'])
  expect(screen.getByText('Hoje')).toBeTruthy()
  expect(screen.getByText('Amanhã')).toBeTruthy()
  expect(screen.getByText('22 de out.')).toBeTruthy()
  expect(screen.getByText('Lista de troféus')).toBeTruthy()
  expect(screen.getByText('Lista ainda não saiu')).toBeTruthy()
  expect(screen.getByText('~10h')).toBeTruthy()
  // Only the consoles the app covers.
  expect(screen.getAllByText('PS5')).toHaveLength(3)
})

test('the other tab lists what just came out, the newest first, with its difficulty', () => {
  renderApp(<ReleasesView load={{ status: 'ok', releases }} now={NOW} />)
  fireEvent.click(screen.getByRole('button', { name: 'Acabaram de sair' }))
  const names = screen
    .getAllByRole('article')
    .map((a) => a.querySelector('.release-body b')?.textContent)
  expect(names).toEqual(['Game 2', 'Game 1'])
  expect(screen.getByRole('img', { name: 'Dificuldade 4 de 10: Média' })).toBeTruthy()
})

test('each game can be saved to the interests', () => {
  renderApp(<ReleasesView load={{ status: 'ok', releases: [release(3, 0)] }} now={NOW} />)
  expect(screen.getByRole('button', { name: 'Salvar Game 3 nos interesses' })).toBeTruthy()
})

test('nothing coming up, a failure and the wait each have their state', () => {
  const { unmount } = renderApp(
    <ReleasesView load={{ status: 'ok', releases: [release(1, -2)] }} now={NOW} />,
  )
  expect(screen.getByText('Nenhum lançamento de PS4 ou PS5 nas próximas semanas.')).toBeTruthy()
  unmount()
  const failed = renderApp(<ReleasesView load={{ status: 'error' }} now={NOW} />)
  expect(screen.getByText('Não conseguimos carregar o calendário.')).toBeTruthy()
  failed.unmount()
  const { container } = renderApp(<ReleasesView load={{ status: 'loading' }} now={NOW} />)
  expect(container.querySelectorAll('.release-cover.sk')).toHaveLength(6)
})
