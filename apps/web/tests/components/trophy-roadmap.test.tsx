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

test('mounted journey renders every trophy once in its roadmap and keeps full trophy tools', async () => {
  const { container } = renderApp(<Journey game={game} plan={null} />, { path: '/game' })
  await screen.findByRole('link', { name: 'Roteiro' })
  expect(container.querySelectorAll('.roadmap-step').length).toBe(3)
  expect(container.querySelectorAll('.roadmap-step.is-earned').length).toBe(1)
  expect(container.querySelector('.journey-trophies')).toBeTruthy()
  expect(container.querySelector('.journey-guide')).toBeTruthy()
  expect(screen.getByText('1 de 3 conquistados no jogo base')).toBeTruthy()
})

test('hidden advice is opt in, guide markup is sanitized and links retain exact trophy context', () => {
  const { container } = renderApp(<TrophyRoadmap game={game} />, { path: '/game' })
  expect(screen.queryByText('Secret plot')).toBeNull()
  expect(screen.queryByText('Secret advice')).toBeNull()
  expect(container.querySelector('.roadmap-advice strong')?.textContent).toBe('the path')
  expect(container.querySelector('script')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Revelar este troféu' }))
  expect(screen.getByText('Secret advice')).toBeTruthy()
  const link = [...container.querySelectorAll<HTMLAnchorElement>('.roadmap-ask')].find((a) =>
    a.href.includes('Secret'),
  )
  expect(link).toBeTruthy()
  expect(new URL(link?.href ?? 'http://localhost/').searchParams.get('trophy')).toBe('Secret scene')
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar detalhes' }))
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

test('the map keeps advice collapsed until explored and jumping opens the pending milestone', () => {
  const { container } = renderApp(<TrophyRoadmap game={game} />)
  const milestones = [...container.querySelectorAll<HTMLDetailsElement>('.roadmap-milestone')]
  expect(milestones.every((x) => !x.open)).toBe(true)
  expect(container.querySelectorAll('svg.roadmap-path').length).toBe(3)
  fireEvent.click(screen.getByRole('button', { name: 'Ir ao primeiro pendente' }))
  expect(milestones[1].open).toBe(true)
  expect(milestones[0].open).toBe(false)
  expect(game.trophies[2].earned).toBe(false)
})
