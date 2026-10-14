import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { emptyGoals, sampleGoals } from '../../src/components/goals/fixtures'
import type { Game, Interest } from '../../src/lib/types'
import { Goals, GoalsView } from '../../src/pages/goals'
import { mockApi, never, renderApp, reply } from '../support/web'

afterEach(() => mock.restore())

const elden: Game = { id: 'game:elden-ring', name: 'Elden Ring', platforms: ['PS5'] }
const search = async () => [elden]
const ok = () => mock(async (_text: string) => {})
const heading = () => screen.getByRole('heading', { name: /^Meus interesses/ })
const feedback = () => document.getElementById('goal-feedback')?.textContent

test('the screen shows the interests from the app state', () => {
  renderApp(<Goals />, { value: { data: { ...SAMPLE_DATA, goals: sampleGoals } } })
  expect(screen.getByRole('heading', { level: 1, name: 'Interesses' })).toBeTruthy()
  expect(heading().textContent).toBe('Meus interesses 13')
})

test('loading, and a failed sync', () => {
  const { container, unmount } = renderApp(<Goals />, { value: { data: null } })
  expect(container.querySelector('#goals .sk')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Conquistas do ano' })).toBeTruthy()
  unmount()
  renderApp(<Goals />, { value: { data: null, sync: 'failed' } })
  expect(screen.getByRole('alert').textContent).toContain(
    'Não foi possível carregar seus interesses.',
  )
})

test('no interests yet: the first step', () => {
  renderApp(<GoalsView goals={emptyGoals} command={ok()} />)
  expect(screen.getByText('Salve o primeiro jogo que você quer platinar.')).toBeTruthy()
})

test('setting the yearly target', async () => {
  const command = ok()
  renderApp(<GoalsView goals={sampleGoals} command={command} />)
  fireEvent.click(screen.getByRole('button', { name: 'Editar meta' }))
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Meta anual de platinas' }), {
    target: { value: '20' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar meta' }))
  await waitFor(() => expect(feedback()).toBe('Alterações salvas.'))
  expect(command).toHaveBeenCalledWith('set 20')
  expect(screen.queryByRole('button', { name: 'Salvar meta' })).toBeNull()
})

test('a failed save keeps the editor open and says so', async () => {
  const command = mock(async () => {
    throw new Error('offline')
  })
  renderApp(<GoalsView goals={sampleGoals} command={command} />)
  fireEvent.click(screen.getByRole('button', { name: 'Editar meta' }))
  fireEvent.click(screen.getByRole('button', { name: 'Salvar meta' }))
  await waitFor(() => expect(feedback()).toBe('Não foi possível salvar. Tente novamente.'))
  expect(screen.getByRole('button', { name: 'Salvar meta' })).toBeTruthy()
})

test('adding a game from the catalog', async () => {
  const command = ok()
  renderApp(<GoalsView goals={sampleGoals} command={command} search={search} />)
  const toggle = screen.getByRole('button', { name: 'Adicionar jogo' })
  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  const field = screen.getByRole('combobox', { name: 'Jogo para salvar nos interesses' })
  await waitFor(() => expect(document.activeElement).toBe(field))
  fireEvent.change(field, { target: { value: 'elden' } })
  fireEvent.click(await screen.findByRole('option', { name: /Elden Ring/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(await screen.findByText('Elden Ring salvo nos interesses')).toBeTruthy()
  expect(command).toHaveBeenCalledWith('add game:elden-ring')
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  await waitFor(() => expect(document.activeElement).toBe(toggle))
})

test('closing the add panel gives focus back to its button', async () => {
  renderApp(<GoalsView goals={sampleGoals} command={ok()} search={search} />)
  const toggle = screen.getByRole('button', { name: 'Adicionar jogo' })
  fireEvent.click(toggle)
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar inclusão' }))
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  await waitFor(() => expect(document.activeElement).toBe(toggle))
})

test('removing a game', async () => {
  const command = ok()
  renderApp(<GoalsView goals={sampleGoals} command={command} />)
  fireEvent.click(screen.getByRole('button', { name: 'Remover Astro Bot dos interesses' }))
  expect(await screen.findByText('Astro Bot removido dos interesses')).toBeTruthy()
  expect(command).toHaveBeenCalledWith('remove interest:1')
})

test('filters and pages are kept across visits', () => {
  const cache: Record<string, unknown> = {}
  const { unmount } = renderApp(<GoalsView goals={sampleGoals} command={ok()} />, {
    value: { cache },
  })
  const pager = screen.getByRole('navigation', { name: 'Páginas de interesses' })
  fireEvent.click(within(pager).getByRole('button', { name: 'Próxima página' }))
  expect(cache['goals.page']).toBe(2)
  fireEvent.click(screen.getByRole('button', { name: /^Platinados/ }))
  expect(cache['goals.filter']).toBe('done')
  expect(cache['goals.page']).toBe(1)
  unmount()
  renderApp(<GoalsView goals={sampleGoals} command={ok()} />, { value: { cache } })
  expect(screen.getByRole('button', { name: /^Platinados/ }).className).toContain('active')
})

test('without a fake, changes go through /api/goals and update the app state', async () => {
  const calls = mockApi({
    'POST /api/goals': { ...sampleGoals, interests: sampleGoals.interests.slice(2) },
  })
  renderApp(<Goals />, { value: { data: { ...SAMPLE_DATA, goals: sampleGoals } } })
  fireEvent.click(screen.getByRole('button', { name: 'Remover Astro Bot dos interesses' }))
  await waitFor(() => expect(heading().textContent).toBe('Meus interesses 11'))
  expect(calls[0].body).toEqual({ command: 'remove interest:1' })
})

test('the shared command failing is a failed save', async () => {
  mockApi({ 'POST /api/goals': reply(500) })
  renderApp(<Goals />, { value: { data: { ...SAMPLE_DATA, goals: sampleGoals } } })
  fireEvent.click(screen.getByRole('button', { name: 'Remover Astro Bot dos interesses' }))
  await waitFor(() => expect(feedback()).toBe('Não foi possível salvar. Tente novamente.'))
})

test('while saving, the add button is locked', () => {
  mockApi({ 'POST /api/goals': never })
  renderApp(<Goals />, { value: { data: { ...SAMPLE_DATA, goals: sampleGoals } } })
  fireEvent.click(screen.getByRole('button', { name: 'Remover Astro Bot dos interesses' }))
  expect(feedback()).toBe('Salvando…')
  expect(screen.getByRole('button', { name: 'Adicionar jogo' }).hasAttribute('disabled')).toBe(true)
})

test('deals and platinums get a column each only when both fill one', () => {
  const sale: Interest['deal'] = {
    price: 1000,
    base: 2000,
    discount: 50,
    plus: false,
    currency: 'BRL',
    endsAt: null,
    storeUrl: null,
  }
  const open = sampleGoals.interests.filter((g) => !g.done)
  const withDeals = (n: number) =>
    sampleGoals.interests.map((g) => (open.indexOf(g) < n && !g.done ? { ...g, deal: sale } : g))
  const plats = sampleGoals.platinumed.slice(0, 4)
  const columns = (interests: typeof sampleGoals.interests, platinumed = plats) => {
    const { container, unmount } = renderApp(
      <GoalsView goals={{ ...sampleGoals, interests, platinumed }} command={ok()} />,
    )
    const trio = container.querySelector('.goals-columns')?.classList.contains('trio')
    const deals = !!container.querySelector('.deals')
    unmount()
    return { trio, deals }
  }
  expect(columns(withDeals(0))).toEqual({ trio: false, deals: false })
  expect(columns(withDeals(3))).toEqual({ trio: false, deals: true })
  expect(columns(withDeals(4))).toEqual({ trio: true, deals: true })
  expect(columns(withDeals(6), plats.slice(0, 2))).toEqual({ trio: false, deals: true })
})
