import { afterEach, expect, mock, test } from 'bun:test'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { NextPickLink } from '../../src/components/goals/next-pick'
import { type NexoPick, NexoPickBox, NexoPickPanel } from '../../src/components/nexo-pick'
import { assistantPicksData, picksData } from '../../src/components/nexo-pick.stories'
import { mockApi, never, renderApp } from '../support/web'

afterEach(() => mock.restore())

const ask = () => screen.getByRole('button', { name: /Escolher (pra mim|outro)/ })
const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed')

test('the stored picks show the latest, with what was asked, and the earlier ones in a dialog', async () => {
  const cache: Record<string, unknown> = {}
  const calls = mockApi({ '/api/picks': { picks: picksData } })
  renderApp(<NexoPickBox />, { value: { cache } })
  expect(document.querySelector('.nexo-pick-result .sk')).toBeTruthy()
  expect(await screen.findByRole('link', { name: /Inside/ })).toBeTruthy()
  expect(screen.getByText('Você pediu: “Algo curto”')).toBeTruthy()
  expect(screen.getByText(/dá para fechar em duas noites/)).toBeTruthy()
  expect(ask().textContent).toContain('Escolher outro')
  expect(cache.picks).toEqual(picksData)
  expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /api/picks'])

  fireEvent.click(screen.getByRole('button', { name: /Ver as 2 escolhas anteriores/ }))
  const dialog = screen.getByRole('dialog', { name: 'Escolhas anteriores' })
  expect(within(dialog).getAllByRole('listitem')).toHaveLength(2)
  expect(within(dialog).getByText(/Qualquer jogo · só o que tenho/)).toBeTruthy()
  expect(within(dialog).getByRole('link', { name: /Days Gone/ })).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test("an assistant's pick is the latest one under its name and logo, without a first step", () => {
  renderApp(<NexoPickPanel picks={assistantPicksData} onAsk={() => {}} />)
  expect(screen.getByText(/ÚLTIMA ESCOLHA · CLAUDE ·/)).toBeTruthy()
  expect(document.querySelector('.nexo-pick-latest .app-logo')?.getAttribute('src')).toBe(
    '/claude.svg',
  )
  // Asking is still Nexo's.
  expect(document.querySelector('.nexo-pick-top > img')?.getAttribute('src')).toBe(
    '/nexo-avatar.svg',
  )
  expect(screen.queryByText('Por onde começar')).toBeNull()
  // Nexo's earlier picks keep where it looked.
  fireEvent.click(screen.getByRole('button', { name: /Ver as 3 escolhas anteriores/ }))
  const dialog = screen.getByRole('dialog', { name: 'Escolhas anteriores' })
  expect(within(dialog).getAllByText(/Meus interesses/)).toHaveLength(2)
})

test("an assistant the app does not know by name is one; Nexo's pick has no mark", () => {
  const other = [{ ...assistantPicksData[0], recommender: 'other' as const }]
  const { unmount } = renderApp(<NexoPickPanel picks={other} onAsk={() => {}} />)
  expect(screen.getByText(/ÚLTIMA ESCOLHA · ASSISTENTE ·/)).toBeTruthy()
  unmount()
  renderApp(<NexoPickPanel picks={picksData} onAsk={() => {}} />)
  expect(document.querySelector('.nexo-pick-latest .app-logo')).toBeNull()
})

test('a kept list shows at once; a failed load leaves the form to ask', async () => {
  const calls = mockApi({})
  const { unmount } = renderApp(<NexoPickBox />, { value: { cache: { picks: picksData } } })
  expect(screen.getByRole('link', { name: /Inside/ })).toBeTruthy()
  expect(calls).toHaveLength(0)
  unmount()
  renderApp(<NexoPickBox />, { value: { cache: {} } })
  await waitFor(() => expect(document.querySelector('.nexo-pick-result .sk')).toBeNull())
  expect(ask().textContent).toContain('Escolher pra mim')
})

test('coming back mid-load waits for the request already running', () => {
  const calls = mockApi({})
  renderApp(<NexoPickBox />, { value: { cache: { picksLoad: never() } } })
  expect(document.querySelector('.nexo-pick-result .sk')).toBeTruthy()
  expect(calls).toHaveLength(0)
})

test('asking sends the mood, where to look and only what I have, and the pick goes on top', async () => {
  const pick: NexoPick = {
    ...picksData[1],
    id: 'recommendation:9',
    game: { id: 'game:1', name: 'Days Gone' },
    mood: 'Pra relaxar',
    scope: 'interests',
    at: '2026-10-18T22:00:00Z',
  }
  const cache: Record<string, unknown> = { picks: [picksData[0]] }
  const calls = mockApi({ 'POST /api/picks': { pick } })
  renderApp(<NexoPickBox />, { value: { cache, data: SAMPLE_DATA } })
  // Giving a direction is optional, folded under the button.
  expect(screen.queryByRole('textbox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Dar uma direção/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Pra relaxar' }))
  expect(pressed('Pra relaxar')).toBe('true')
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Pra relaxar')
  // The same chip again clears it.
  fireEvent.click(screen.getByRole('button', { name: 'Pra relaxar' }))
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('')
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Pra relaxar ' } })
  expect(pressed('Pra relaxar')).toBe('true')
  // Any game unless the player says otherwise.
  expect(pressed('Qualquer jogo')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Meus interesses' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Só o que já tenho' }))
  fireEvent.click(ask())
  expect(screen.getByText('O Nexo está pensando…')).toBeTruthy()
  expect(await screen.findByRole('link', { name: /Days Gone/ })).toBeTruthy()
  expect(calls[0]).toEqual({
    path: '/api/picks',
    method: 'POST',
    body: { mood: 'Pra relaxar', scope: 'interests', ownedOnly: true },
  })
  expect((cache.picks as NexoPick[]).map((p) => p.id)).toEqual([
    'recommendation:9',
    'recommendation:3',
  ])
  expect(screen.getByRole('button', { name: /Ver a escolha anterior/ })).toBeTruthy()
})

test('nothing on the list fitting: Nexo says so and looks beyond it with the same mood', async () => {
  const noFit = { ...picksData[0], mood: 'Um desafio', fits: false }
  const beyond = { ...picksData[1], id: 'recommendation:10', scope: 'any' as const }
  const calls = mockApi({ 'POST /api/picks': { pick: beyond } })
  renderApp(<NexoPickBox />, { value: { cache: { picks: [noFit] } } })
  expect(screen.getByText(/Nenhum dos seus interesses combina direito com isso/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Procurar fora da lista' }))
  expect(await screen.findByRole('link', { name: /Journey/ })).toBeTruthy()
  expect(calls[0].body).toEqual({ mood: 'Um desafio', scope: 'any', ownedOnly: false })
  expect(pressed('Qualquer jogo')).toBe('true')
  expect(screen.queryByText(/Nenhum dos seus interesses/)).toBeNull()
})

test('one tap is enough: no direction looks at any game', async () => {
  const calls = mockApi({ 'POST /api/picks': { pick: null } })
  renderApp(<NexoPickBox />, { value: { cache: { picks: [] } } })
  expect(
    screen.getByRole('button', { name: /Dar uma direção/ }).getAttribute('aria-expanded'),
  ).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: 'Como ele escolhe?' }))
  expect(screen.getByText(/qualquer jogo parecido com os que você joga/)).toBeTruthy()
  fireEvent.click(ask())
  await waitFor(() => expect(calls).toHaveLength(1))
  expect(calls[0].body).toEqual({ mood: '', scope: 'any', ownedOnly: false })
})

test('nothing to pick says so; a failure says so too', async () => {
  mockApi({ 'POST /api/picks': { pick: null } })
  renderApp(<NexoPickBox initialScope="interests" />, { value: { cache: { picks: [] } } })
  // Sent from the interests: where it looks shows at once.
  expect(pressed('Meus interesses')).toBe('true')
  fireEvent.click(ask())
  expect(await screen.findByText(/Nada para escolher com esses filtros/)).toBeTruthy()

  mock.restore()
  mockApi({ 'POST /api/picks': () => new Response('{}', { status: 500 }) })
  fireEvent.click(ask())
  expect((await screen.findByRole('alert')).textContent).toBe(
    'O Nexo não conseguiu escolher agora. Tenta de novo.',
  )
})

test('the demo sees the panel but cannot ask', () => {
  const onAsk = mock(() => {})
  renderApp(<NexoPickPanel picks={[]} disabled onAsk={onAsk} />)
  expect(ask().hasAttribute('disabled')).toBe(true)
})

test('in English', async () => {
  const { setLocale } = await import('../../src/i18n/locale')
  setLocale('en', { persist: false })
  renderApp(<NexoPickPanel picks={picksData} onAsk={() => {}} />)
  expect(screen.getByRole('heading', { name: 'What to play now?' })).toBeTruthy()
  expect(screen.getByText('You asked for: “Algo curto”')).toBeTruthy()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /See the 2 previous picks/ }))
  })
  setLocale('pt-BR', { persist: false })
})

test('the interests send the player to Discover, looking among the saved games', () => {
  renderApp(<NextPickLink />)
  const link = screen.getByRole('link', { name: /Deixa o Nexo escolher/ })
  expect(link.getAttribute('href')).toBe('/discover?scope=interests')
})
