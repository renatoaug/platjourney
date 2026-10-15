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
const card = (x: HTMLElement) => x.closest('article') as HTMLElement

test('each card: difficulty, time, the facts as icons and Nexo’s reason', () => {
  renderApp(<Recommendations state={ok} onDismiss={() => {}} />)
  const h = row('Horizon Zero Dawn')
  expect(h.getAttribute('href')).toBe('/title/game/game%3A10')
  // The difficulty sits on the cover.
  expect(within(card(h)).getByRole('img', { name: 'Dificuldade 3 de 10: Fácil' })).toBeTruthy()
  expect(h.textContent).toContain('~50h')
  expect(within(h).getByRole('img', { name: '1 jogada' })).toBeTruthy()
  // Only what is true shows: no missables, no difficulty trophy.
  expect(within(h).queryByRole('img', { name: 'Há troféus perdíveis' })).toBeNull()
  expect(within(h).queryByRole('img', { name: /dificuldade específica/ })).toBeNull()
  const reason = h.querySelector('.band-reason') as HTMLElement
  expect(reason.textContent).toBe(
    'Mundo aberto como Days Gone, com colecionáveis rastreáveis e nada perdível.',
  )
  expect(reason.className).toContain('lines-3')
  expect(reason.getAttribute('title')).toBe(reason.textContent)

  const s = row('Sekiro')
  expect(within(s).getByRole('img', { name: '3 jogadas' })).toBeTruthy()
  expect(within(s).getByRole('img', { name: 'Há troféus perdíveis' })).toBeTruthy()
  expect(document.querySelector('.band-card .cover-placeholder')).toBeTruthy()
})

test('a difficulty trophy and no run count', () => {
  const rec = { ...horizon, hasDifficultyTrophy: true, playthroughs: null }
  renderApp(
    <Recommendations
      state={{ status: 'ok', recs: { profile: null, items: [rec] } }}
      onDismiss={() => {}}
    />,
  )
  expect(
    within(row('Horizon')).getByRole('img', {
      name: 'Há troféu que exige jogar em uma dificuldade específica',
    }),
  ).toBeTruthy()
  expect(within(row('Horizon')).queryByRole('img', { name: /jogada/ })).toBeNull()
})

test('the section: ANÁLISE DO NEXO, and six cards a page', () => {
  const many = Array.from({ length: 8 }, (_, i) => ({
    ...horizon,
    game: { id: `game:m${i}`, name: `Jogo ${i}` },
  }))
  renderApp(
    <Recommendations
      state={{ status: 'ok', recs: { profile: null, items: many } }}
      onDismiss={() => {}}
    />,
  )
  const section = screen.getByRole('region', { name: 'Escolhas do Nexo' })
  expect(within(section).getByText('ANÁLISE DO NEXO')).toBeTruthy()
  expect(section.querySelectorAll('.band-card')).toHaveLength(6)
  expect(within(section).getByText('1/2')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
  expect(section.querySelectorAll('.band-card')).toHaveLength(2)
})

test('before the player asks: one line and the button', () => {
  const onAsk = mock()
  renderApp(<Recommendations state={{ status: 'idle' }} onDismiss={() => {}} onAsk={onAsk} />)
  expect(screen.getByText(/O Nexo lê o seu gosto/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Gerar de novo/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Pedir ao Nexo/ }))
  expect(onAsk).toHaveBeenCalled()
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
  expect(calls[0].body).toEqual({ command: 'add game:10 from:recommendations' })
  expect(screen.getByTestId('location').textContent).toBe('/discover')
})

test('loading, error and empty', () => {
  const { container, rerender } = renderApp(
    <Recommendations state={{ status: 'loading' }} onDismiss={() => {}} />,
  )
  expect(container.querySelectorAll('#recs .band-card')).toHaveLength(6)
  expect(screen.getByText('O Nexo está montando suas recomendações…')).toBeTruthy()
  expect(document.getElementById('taste')?.textContent).toBe('')
  rerender(<Recommendations state={{ status: 'error' }} onDismiss={() => {}} />)
  expect(screen.getByRole('alert').textContent).toContain(
    'Não conseguimos montar suas recomendações agora.',
  )
})
