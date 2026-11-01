import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { samplePlan } from '../../src/components/plan.stories'
import { current } from '../../src/fixtures'
import type { CurrentGame } from '../../src/lib/types'
import { Game, GameScreen } from '../../src/pages/game'
import { mockApi, never, renderApp } from '../support/web'

afterEach(() => mock.restore())
const game: CurrentGame = {
  ...current,
  focus: { phases: [], trophy: current.trophies.find((t) => !t.earned && t.type !== 'platinum') },
}

test('journey prioritizes progress and server focus; plan and guide remain available', () => {
  mockApi({})
  renderApp(<GameScreen current={game} plan={<p>plano</p>} />)
  expect(screen.getByRole('heading', { level: 1, name: 'DAYS GONE' })).toBeTruthy()
  expect(screen.getByRole('progressbar', { name: 'Progresso do jogo' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Me ajuda com isso' }).getAttribute('href')).toContain(
    'trophy=',
  )
  expect(document.getElementById('journey-session')?.hasAttribute('open')).toBe(false)
  fireEvent.click(screen.getByText('Planejar minha sessão'))
  expect(screen.getByText('plano')).toBeTruthy()
  expect(document.getElementById('journey-trophies')?.textContent).toContain('De raspão')
  fireEvent.click(screen.getByText('Consultar o guia completo'))
  expect(document.querySelector('.journey-guide')?.textContent).toContain('Burnout Apocalipse')
})

test('no game offers the library without inventing progress', () => {
  renderApp(<GameScreen current={null} plan={<p>plano</p>} />)
  expect(screen.getByRole('link', { name: 'Ver meus jogos' }).getAttribute('href')).toBe('/games')
  expect(screen.queryByText('plano')).toBeNull()
})

test('loading shows skeletons, not an empty or invented journey', () => {
  const { container } = renderApp(<GameScreen current={undefined} plan={null} />)
  expect(container.querySelector('.sk')).toBeTruthy()
  expect(screen.queryByText('Qual vai ser sua próxima platina?')).toBeNull()
})

test('a selected game scopes the plan request', async () => {
  const calls = mockApi({ '/api/plan': { plan: samplePlan } })
  renderApp(<Game />, { value: { data: { ...SAMPLE_DATA, current: game } } })
  await waitFor(() => expect(calls.some((c) => c.path === `/api/plan?np=${game.np}`)).toBe(true))
})

test('before first state skeletons remain; a sync failure is explicit', () => {
  mockApi({ '/api/plan': never })
  const { container, unmount } = renderApp(<Game />, { value: { data: null } })
  expect(container.querySelector('.sk')).toBeTruthy()
  unmount()
  renderApp(<Game />, { value: { data: null, sync: 'failed' } })
  expect(screen.getByRole('alert').textContent).toContain('sincronizar')
})
