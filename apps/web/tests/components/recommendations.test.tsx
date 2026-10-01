import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { Recommendations } from '../../src/components/recommendations'
import { recsData } from '../../src/components/recommendations.stories'
import { mockApi, renderApp } from '../support/web'

afterEach(() => mock.restore())

const [horizon, sekiro] = recsData.items
const ok = { status: 'ok' as const, recs: recsData }
const row = (name: string) => screen.getByRole('link', { name: new RegExp(name) })

test('each row: platform, difficulty, time, runs and the reason', () => {
  renderApp(<Recommendations state={ok} onDismiss={() => {}} />)
  const h = row('Horizon Zero Dawn')
  expect(h.getAttribute('href')).toBe('/title/game/game%3A10')
  expect(h.textContent).toContain('3/10')
  expect(h.textContent).toContain('~50h')
  expect(h.textContent).toContain('1 jogada')
  expect(h.textContent).toContain('Sem troféu de dificuldade')
  expect(h.textContent).toContain('parecido com Days Gone e Ghost of Tsushima')
  expect(h.textContent).not.toContain('Perdíveis')

  const s = row('Sekiro')
  expect(s.textContent).toContain('3 jogadas')
  expect(s.textContent).toContain('Perdíveis')
  expect(s.textContent).not.toContain('troféu de dificuldade')
  expect(s.querySelector('.cover-placeholder')?.textContent).toBe('S')
})

test('a difficulty trophy and no run count', () => {
  const rec = { ...horizon, hasDifficultyTrophy: true, playthroughs: null }
  renderApp(
    <Recommendations
      state={{ status: 'ok', recs: { profile: null, items: [rec] } }}
      onDismiss={() => {}}
    />,
  )
  expect(row('Horizon').textContent).toContain('Troféu de dificuldade')
  expect(row('Horizon').textContent).not.toContain('jogada')
})

test('the taste profile opens with the genres, traits and what to avoid', () => {
  renderApp(<Recommendations state={ok} onDismiss={() => {}} />)
  const taste = document.getElementById('taste') as HTMLElement
  expect(within(taste).getByText('POR QUE ESSAS?')).toBeTruthy()
  expect([...taste.querySelectorAll('.taste-tag.genre')].map((t) => t.textContent)).toEqual([
    'Ação',
    'Aventura',
    'Mundo aberto',
  ])
  expect(taste.querySelectorAll('.taste-tag.avoid')).toHaveLength(2)
  expect(taste.textContent).toContain('Você curte mundos abertos')
})

test('dismissing asks why without opening the game, and a reason goes to the caller', () => {
  const onDismiss = mock()
  renderApp(<Recommendations state={ok} onDismiss={onDismiss} />, { path: '/discover' })
  fireEvent.click(screen.getByRole('button', { name: 'Não recomendar Sekiro: Shadows Die Twice' }))
  expect(screen.getByTestId('location').textContent).toBe('/discover')
  expect(onDismiss).not.toHaveBeenCalled()
  const ask = screen.getByRole('group', {
    name: 'Por que Sekiro: Shadows Die Twice não te interessa?',
  })
  fireEvent.click(within(ask).getByRole('button', { name: 'Muito difícil' }))
  expect(onDismiss).toHaveBeenCalledWith(sekiro, 'too_hard')
})

test('the reason is optional, and cancelling brings the game back', () => {
  const onDismiss = mock()
  renderApp(<Recommendations state={ok} onDismiss={onDismiss} />, { path: '/discover' })
  const open = () =>
    fireEvent.click(
      screen.getByRole('button', { name: 'Não recomendar Sekiro: Shadows Die Twice' }),
    )
  open()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByText(/não te interessa\?/)).toBeNull()
  expect(onDismiss).not.toHaveBeenCalled()
  open()
  fireEvent.click(screen.getByRole('button', { name: 'Só remover' }))
  expect(onDismiss).toHaveBeenCalledWith(sekiro)
})

test('saving a game puts it in the interests and fills the bookmark', async () => {
  const calls = mockApi({
    'POST /api/goals': {
      ...SAMPLE_DATA.goals,
      interests: [{ id: 'interest:1', game: horizon.game, position: 1, progress: 0, done: false }],
    },
  })
  renderApp(<Recommendations state={ok} onDismiss={() => {}} />, { path: '/discover' })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar Horizon Zero Dawn nos interesses' }))
  const saved = await screen.findByRole('button', {
    name: 'Remover Horizon Zero Dawn dos interesses',
  })
  await waitFor(() => expect(saved.hasAttribute('disabled')).toBe(false))
  expect(saved.className).toContain('saved')
  expect(calls[0].body).toEqual({ command: 'add game:10' })
  expect(screen.getByTestId('location').textContent).toBe('/discover')
})

test('loading, error and empty', () => {
  const { container, rerender } = renderApp(
    <Recommendations state={{ status: 'loading' }} onDismiss={() => {}} />,
  )
  expect(container.querySelectorAll('#recs .row')).toHaveLength(4)
  expect(document.getElementById('taste')?.textContent).toBe('')
  rerender(<Recommendations state={{ status: 'error' }} onDismiss={() => {}} />)
  expect(screen.getByRole('alert').textContent).toContain(
    'Não conseguimos montar suas recomendações agora.',
  )
})
