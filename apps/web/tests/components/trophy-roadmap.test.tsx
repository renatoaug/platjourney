import { expect, test } from 'bun:test'
import { fireEvent, screen } from '@testing-library/react'
import { Journey } from '../../src/components/journey'
import { TrophyRoadmap } from '../../src/components/trophy-roadmap'
import { current } from '../../src/fixtures'
import type { CurrentGame, GuideDetail } from '../../src/lib/types'
import { renderApp } from '../support/web'

const game: CurrentGame = {
  ...current,
  trophies: [
    {
      id: 0,
      name: 'Complete',
      detail: 'Earn everything',
      type: 'platinum',
      groupId: 'default',
      earned: false,
    },
    {
      id: 1,
      name: 'First step',
      detail: 'Explore',
      type: 'bronze',
      groupId: 'default',
      earned: true,
    },
    {
      id: 2,
      name: 'Secret scene',
      detail: 'Secret plot',
      type: 'gold',
      groupId: 'default',
      earned: false,
      hidden: true,
    },
  ],
  guide: {
    ...(current.guide as GuideDetail),
    roadmap: [{ phase: 'Explore', goal: '', trophies: ['First step', 'Secret scene'] }],
    tricks: [
      { trophy: 'First step', trick: 'Use **the path** <script>bad()</script>' },
      { trophy: 'Secret scene', trick: 'Secret advice' },
    ],
    missables: [],
    onlineTrophies: [],
  },
}

test('mounted journey starts at a pending challenge and keeps completed trophies out of the foreground', async () => {
  const { container } = renderApp(<Journey game={game} plan={null} />, { path: '/game' })
  await screen.findByRole('link', { name: 'Roteiro' })
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Troféu oculto')
  expect(container.querySelector('.roadmap-past')?.hasAttribute('open')).toBe(false)
  expect(container.querySelectorAll('.roadmap-route li').length).toBe(2)
  expect(container.querySelector('.journey-trophies')).toBeTruthy()
  expect(container.querySelector('.journey-guide')).toBeTruthy()
  expect(screen.getByText('1 de 3 conquistados no jogo base')).toBeTruthy()
})

test('hidden advice is opt in, guide markup is sanitized and links retain exact trophy context', () => {
  const { container } = renderApp(<TrophyRoadmap game={game} />, { path: '/game' })
  expect(screen.queryByText('Secret plot')).toBeNull()
  expect(screen.queryByText('Secret advice')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Revelar este troféu' }))
  expect(screen.getByText('Secret advice')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Secret scene' })).toBeTruthy()
  const link = [...container.querySelectorAll<HTMLAnchorElement>('.roadmap-ask')].find((a) =>
    a.href.includes('Secret'),
  )
  expect(new URL(link?.href ?? 'http://localhost/').searchParams.get('trophy')).toBe('Secret scene')
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar detalhes' }))
  expect(screen.queryByText('Secret advice')).toBeNull()
  const past = container.querySelector<HTMLDetailsElement>('.roadmap-past')
  if (!past) throw new Error('earned history missing')
  past.open = true
  fireEvent.click(screen.getByRole('button', { name: 'First step' }))
  expect(container.querySelector('.roadmap-advice strong')?.textContent).toBe('the path')
  expect(container.querySelector('script')).toBeNull()
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('First step')
  fireEvent.click(screen.getByRole('button', { name: 'Voltar à sugestão' }))
  expect(screen.queryByText('Secret advice')).toBeNull()
})

test('zero counter remains visible, unavailable counters are not invented and empty data is explicit', () => {
  const { container, unmount } = renderApp(
    <TrophyRoadmap
      game={{
        ...game,
        guide: null,
        trophies: [{ ...game.trophies[1], earned: false, progressValue: 0, progressTarget: 10 }],
      }}
    />,
  )
  expect(screen.getByText('Progresso informado pela PSN: 0 / 10')).toBeTruthy()
  expect(container.textContent).toContain('Ainda sem posição')
  unmount()
  renderApp(<TrophyRoadmap game={{ ...game, trophies: [] }} />)
  expect(screen.getByText(/Os troféus ainda não estão disponíveis/)).toBeTruthy()
})

test('all guide stages remain reachable without changing earned state', () => {
  const { container } = renderApp(<TrophyRoadmap game={game} />)
  const chapters = container.querySelector<HTMLDetailsElement>('.roadmap-chapters')
  if (!chapters) throw new Error('chapter selector missing')
  chapters.open = true
  fireEvent.click(screen.getByRole('button', { name: /A conquista final/ }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Complete')
  expect(screen.getByText(/A platina só aparece concluída/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Voltar à sugestão' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Troféu oculto')
  expect(game.trophies[0].earned).toBe(false)
})

test('next and previous select pending milestones while completion opens the earned final milestone', () => {
  const items = game.trophies.map((x) => ({ ...x, earned: false, hidden: false }))
  const { container, unmount } = renderApp(<TrophyRoadmap game={{ ...game, trophies: items }} />)
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('First step')
  fireEvent.click(screen.getByRole('button', { name: 'Próximo marco' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Secret scene')
  fireEvent.click(screen.getByRole('button', { name: 'Marco anterior' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('First step')
  expect(items.every((x) => !x.earned)).toBe(true)
  unmount()
  renderApp(
    <TrophyRoadmap game={{ ...game, trophies: items.map((x) => ({ ...x, earned: true })) }} />,
  )
  expect(screen.getByRole('heading', { name: 'Complete' })).toBeTruthy()
  expect(screen.getByText('Etapa concluída')).toBeTruthy()
  expect(document.querySelectorAll('.roadmap-route li')).toHaveLength(0)
})

test('an unavailable landscape falls back without broken artwork or losing the objective', () => {
  const { container } = renderApp(
    <TrophyRoadmap
      game={{ ...game, game: { ...game.game, art_url: '/synthetic-landscape.jpg' } }}
    />,
  )
  const art = container.querySelector('.roadmap-scene')
  if (!art) throw new Error('landscape missing')
  fireEvent.error(art)
  expect(container.querySelector('.roadmap-scene')).toBeNull()
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Troféu oculto')
})

test('the pending path crosses stages without traversing earned history', () => {
  const { container } = renderApp(<TrophyRoadmap game={game} />)
  fireEvent.click(screen.getByRole('button', { name: 'Próximo marco' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Complete')
  expect(container.querySelector('.roadmap-chapter-caption')?.textContent).toContain(
    'A conquista final',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Marco anterior' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Troféu oculto')
  expect(container.querySelector('.roadmap-past')?.hasAttribute('open')).toBe(false)
})
