import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { Games, GamesView } from '../../src/pages/games'
import { sampleLibrary } from '../../src/pages/games.stories'
import { mockApi, renderApp } from '../support/web'

afterEach(() => mock.restore())
const handlers = { onSide: () => {}, onQuery: () => {}, onPage: () => {}, onRetry: () => {} }

test('library uses personal PSN titles, not platinum ranking, with explicit journey links', async () => {
  const calls = mockApi({ '/api/library': sampleLibrary })
  renderApp(<Games />, { value: { data: { ...SAMPLE_DATA, ranking: [] } } })
  await screen.findByRole('link', { name: 'Abrir jornada de ASTRO BOT' })
  expect(calls[0]?.path).toContain('scope=owned')
  expect(screen.getByText('Platina conquistada')).toBeTruthy()
  expect(screen.getByText('Nenhum troféu conquistado')).toBeTruthy()
  expect(screen.queryByText('Biblioteca e conquistas')).toBeNull()
  fireEvent.click(screen.getByRole('link', { name: 'Abrir jornada de DAYS GONE' }))
  expect(screen.getByTestId('location').textContent).toBe(`/title/id/${sampleLibrary.items[0].np}`)
})

test('search requests only owned games; no matches can be cleared', async () => {
  const calls = mockApi({
    '/api/library': ({ path }) =>
      path.includes('q=zzz') ? { ...sampleLibrary, total: 0, items: [] } : sampleLibrary,
  })
  renderApp(<Games />)
  await screen.findByText('ASTRO BOT')
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
  await screen.findByText('Nenhum jogo com esse nome.')
  expect(calls.at(-1)?.path).toContain('scope=owned&page=1&q=zzz')
  fireEvent.click(screen.getByRole('button', { name: 'Limpar busca' }))
  await screen.findByText('ASTRO BOT')
})

test('interests do not claim ownership or invented progress and keep management accessible', () => {
  renderApp(
    <GamesView
      {...handlers}
      library={null}
      side="interests"
      interests={[
        {
          id: 'saved:1',
          game: { id: 'game:1', name: 'Saved game' },
          position: 1,
          progress: null,
          done: false,
        },
      ]}
    />,
  )
  expect(screen.queryByRole('progressbar')).toBeNull()
  expect(screen.queryByRole('link', { name: /Abrir jornada/ })).toBeNull()
  expect(screen.getByRole('link', { name: 'Ver Saved game' }).getAttribute('href')).toBe(
    '/title/game/game%3A1',
  )
  expect(screen.getByRole('link', { name: /Organizar interesses/ }).getAttribute('href')).toBe(
    '/goals',
  )
})

test('loading and failure are separate and retry works', () => {
  const retry = mock(() => {})
  const { rerender } = renderApp(<GamesView {...handlers} library={null} />)
  expect(document.querySelector('.games-list .sk')).toBeTruthy()
  rerender(<GamesView {...handlers} onRetry={retry} failed library={null} />)
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(retry).toHaveBeenCalledTimes(1)
})

test('empty library explains synced PSN games without substituting catalog recommendations', () => {
  renderApp(<GamesView {...handlers} library={{ items: [], total: 0, page: 1, size: 12 }} />)
  expect(screen.getByText('Sua biblioteca PSN ainda está vazia.')).toBeTruthy()
  expect(screen.getByText(/Os jogos com troféus sincronizados/)).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Ver conexão PSN' }).getAttribute('href')).toBe(
    '/settings',
  )
  expect(screen.queryByRole('link', { name: /Abrir jornada/ })).toBeNull()
})

test('pagination preserves scope and opens later library entries', async () => {
  const calls = mockApi({
    '/api/library': ({ path }) => ({
      ...sampleLibrary,
      total: 13,
      page: path.includes('page=2') ? 2 : 1,
    }),
  })
  renderApp(<Games />)
  await screen.findByText('ASTRO BOT')
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
  await waitFor(() => expect(calls.at(-1)?.path).toContain('scope=owned&page=2'))
})

test('game art loads lazily and falls back when the image fails', () => {
  renderApp(
    <GamesView {...handlers} library={{ ...sampleLibrary, items: [sampleLibrary.items[0]] }} />,
  )
  const art = document.querySelector('.games-art') as HTMLImageElement
  expect(art.loading).toBe('lazy')
  expect(art.getAttribute('src')).toBe(sampleLibrary.items[0].art ?? null)
  fireEvent.error(art)
  expect(document.querySelector('.games-art-placeholder')?.textContent).toBe('D')
  expect(screen.getByRole('link', { name: 'Abrir jornada de DAYS GONE' })).toBeTruthy()
})
