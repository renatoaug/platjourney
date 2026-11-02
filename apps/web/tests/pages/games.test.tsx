import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { emptyGoals, sampleGoals } from '../../src/components/goals/fixtures'
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

test('interests keeps game management without annual goals', () => {
  const { container } = renderApp(
    <GamesView {...handlers} library={null} side="interests" goals={sampleGoals} />,
  )
  expect(screen.getByRole('heading', { name: /^Meus interesses/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Adicionar jogo' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: /Organizar interesses/ })).toBeNull()
  expect(container.querySelector('.games-goal-details')).toBeNull()
  expect(container.querySelector('.goal-season')).toBeNull()
  expect(container.querySelector('.page-top')).toBeNull()
})

test('explicit interests URL opens the integrated section and tab history is navigable', async () => {
  mockApi({ '/api/library': sampleLibrary })
  renderApp(<Games />, {
    path: '/games?tab=interests',
    value: { data: { ...SAMPLE_DATA, goals: emptyGoals } },
  })
  expect(screen.getByText('Salve o primeiro jogo que você quer platinar.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Biblioteca PSN' }))
  await screen.findByText('ASTRO BOT')
  expect(screen.getByTestId('location').textContent).toBe('/games?tab=library')
  fireEvent.click(screen.getByRole('button', { name: 'Interesses' }))
  expect(screen.getByTestId('location').textContent).toBe('/games?tab=interests')
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

test('goals and achievements have their own URL without losing interests', async () => {
  mockApi({ '/api/library': sampleLibrary })
  renderApp(<Games />, {
    path: '/games?tab=goals',
    value: { data: { ...SAMPLE_DATA, goals: sampleGoals } },
  })
  expect(
    screen.getByRole('button', { name: 'Metas e conquistas' }).getAttribute('aria-pressed'),
  ).toBe('true')
  expect(screen.queryByRole('heading', { name: /^Meus interesses/ })).toBeNull()
  expect(document.querySelector('.goal-season')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Interesses' }))
  expect(screen.getByTestId('location').textContent).toBe('/games?tab=interests')
  expect(screen.getByRole('heading', { name: /^Meus interesses/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Metas e conquistas' }))
  expect(screen.getByTestId('location').textContent).toBe('/games?tab=goals')
})
