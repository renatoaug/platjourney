import { expect, mock, test } from 'bun:test'
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
  expect(container.textContent).toContain('não têm uma correspondência única')
  unmount()
  renderApp(<TrophyRoadmap game={{ ...game, trophies: [] }} />)
  expect(screen.getByText(/Os troféus ainda não estão disponíveis/)).toBeTruthy()
})

test('the journey is continuous and every previous achievement stays accessible', () => {
  const completed = { ...game.trophies[2], hidden: false, earned: true }
  const { container } = renderApp(
    <TrophyRoadmap game={{ ...game, trophies: [game.trophies[0], game.trophies[1], completed] }} />,
  )
  expect(container.querySelector('.roadmap-chapters')).toBeNull()
  expect(container.querySelector('.roadmap-chapter-caption')).toBeNull()
  expect(screen.queryByText(/ETAPA/)).toBeNull()
  const history = container.querySelector<HTMLDetailsElement>('.roadmap-past')
  if (!history) throw new Error('earned history missing')
  expect(history.textContent).toContain('Conquistas anteriores (2)')
  history.open = true
  fireEvent.click(screen.getByRole('button', { name: 'First step' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('First step')
  fireEvent.click(screen.getByRole('button', { name: 'Secret scene' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Secret scene')
  fireEvent.click(screen.getByRole('button', { name: 'Voltar à sugestão' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Complete')
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
  expect(screen.getByText('Caminho concluído')).toBeTruthy()
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
  expect(container.querySelector('.roadmap-chapter-caption')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Marco anterior' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Troféu oculto')
  expect(container.querySelector('.roadmap-past')?.hasAttribute('open')).toBe(false)
})

test('route artwork and missable signals use exact guide facts, with no hidden trophy spoilers', () => {
  const items = game.trophies.map((t, i) => ({
    ...t,
    earned: false,
    iconUrl: `/synthetic-trophy-${i}.png`,
  }))
  const guide = {
    ...(game.guide as GuideDetail),
    hasMissables: true,
    missables: [
      { trophy: 'First step', when: 'Before moving on', how: 'Check the objective' },
      { trophy: 'Secret scene', when: 'Secret warning', how: 'Hidden guidance' },
      { trophy: 'Unmatched trophy', when: 'Unmatched', how: '' },
    ],
  }
  const { container, unmount } = renderApp(
    <TrophyRoadmap game={{ ...game, trophies: items, guide }} />,
  )
  const stops = container.querySelectorAll('.roadmap-route li')
  expect(stops).toHaveLength(3)
  expect(container.querySelectorAll('.roadmap-route-risk')).toHaveLength(1)
  expect(stops[0]?.getAttribute('data-missable')).toBe('true')
  expect(stops[0]?.querySelector('img')?.getAttribute('src')).toBe('/synthetic-trophy-1.png')
  expect(stops[1]?.querySelector('img')).toBeNull()
  expect(stops[1]?.getAttribute('data-missable')).toBe('false')
  expect(stops[1]?.textContent).toContain('Troféu oculto')
  expect(stops[2]?.getAttribute('data-final')).toBe('true')
  expect(screen.queryByText('Secret warning')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /First step Perdível/ }))
  expect(screen.getByText('Check the objective')).toBeTruthy()
  const art = stops[0]?.querySelector('img')
  if (!art) throw new Error('missing trophy artwork')
  fireEvent.error(art)
  expect(stops[0]?.querySelector('img')).toBeNull()
  expect(stops[0]?.textContent).toContain('First step')
  unmount()
  renderApp(
    <TrophyRoadmap game={{ ...game, trophies: items, guide: { ...guide, missables: [] } }} />,
  )
  expect(document.querySelectorAll('.roadmap-route-risk')).toHaveLength(0)
})

test('arrow navigation keeps only the selected milestone tabbable and clamps the rail after resize', () => {
  const previous = globalThis.ResizeObserver
  const callbacks: Array<() => void> = []
  const disconnect = mock(() => {})
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      callbacks.push(callback)
    }
    observe() {}
    unobserve() {}
    disconnect = disconnect
  } as unknown as typeof ResizeObserver
  try {
    const { container, unmount } = renderApp(<TrophyRoadmap game={game} />)
    const track = container.querySelector<HTMLOListElement>('.roadmap-route')
    if (!track) throw new Error('route missing')
    const stops = track.querySelectorAll<HTMLElement>('li')
    const scroll = mock(() => {})
    track.scrollTo = scroll
    Object.defineProperties(track, {
      clientWidth: { value: 320, configurable: true },
      scrollWidth: { value: 640 },
    })
    Object.defineProperty(stops[1], 'offsetLeft', { value: 320 })
    fireEvent.click(screen.getByRole('button', { name: 'Próximo marco' }))
    expect(scroll).toHaveBeenLastCalledWith({ left: 320, behavior: 'auto' })
    expect(stops[0]?.querySelector('button')?.tabIndex).toBe(-1)
    expect(stops[1]?.querySelector('button')?.tabIndex).toBe(0)
    Object.defineProperty(track, 'clientWidth', { value: 640 })
    callbacks.at(-1)?.()
    expect(scroll).toHaveBeenLastCalledWith({ left: 0, behavior: 'auto' })
    unmount()
    expect(disconnect).toHaveBeenCalledTimes(2)
  } finally {
    globalThis.ResizeObserver = previous
  }
})

test('objective and stored guidance have distinct icons, while missing advice adds no filler', () => {
  const { container, unmount } = renderApp(
    <TrophyRoadmap game={{ ...game, trophies: [{ ...game.trophies[1], earned: false }] }} />,
  )
  expect(container.querySelector('.roadmap-trophy-heading use')?.getAttribute('href')).toBe(
    '/icons.svg#target',
  )
  expect(screen.getByText('Orientação do Nexo')).toBeTruthy()
  expect(container.querySelector('.roadmap-advice-label use')?.getAttribute('href')).toBe(
    '/icons.svg#nexo',
  )
  expect(container.querySelector('.roadmap-advice strong')?.textContent).toBe('the path')
  unmount()
  renderApp(
    <TrophyRoadmap
      game={{ ...game, guide: null, trophies: [{ ...game.trophies[1], earned: false }] }}
    />,
  )
  expect(screen.queryByText('Orientação do Nexo')).toBeNull()
  expect(screen.queryByText('Sem dica específica no guia.')).toBeNull()
  expect(screen.getByRole('link', { name: 'Perguntar ao Nexo' })).toBeTruthy()
})

test('earned history shows trophy art and full descriptions without changing progress', () => {
  const earned = {
    ...game.trophies[1],
    iconUrl: '/synthetic-earned.png',
    detail: 'Complete objective description',
  }
  const { container } = renderApp(
    <TrophyRoadmap game={{ ...game, trophies: [game.trophies[0], earned] }} />,
  )
  const history = container.querySelector<HTMLDetailsElement>('.roadmap-past')
  if (!history) throw new Error('earned history missing')
  expect(history.open).toBe(false)
  history.open = true
  const button = screen.getByRole('button', { name: earned.name })
  expect(button.getAttribute('aria-describedby')).toBe('roadmap-default-1-earned-detail')
  expect(button.querySelector('.roadmap-earned-copy > span')?.textContent).toBe(earned.detail)
  const art = button.querySelector('img')
  if (!art) throw new Error('earned artwork missing')
  expect(art.getAttribute('src')).toBe(earned.iconUrl)
  fireEvent.error(art)
  expect(button.querySelector('img')).toBeNull()
  expect(button.querySelector('.roadmap-earned-art > svg use')?.getAttribute('href')).toBe(
    '/icons.svg#trophy',
  )
  fireEvent.click(button)
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe(earned.name)
  expect(earned.earned).toBe(true)
})
