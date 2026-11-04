import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { fireEvent, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { SAMPLE_ME } from '../../src/app/app-state'
import { Journey } from '../../src/components/journey'
import { TrophyRoadmap } from '../../src/components/trophy-roadmap'
import { current } from '../../src/fixtures'
import { requiemGame } from '../../src/fixtures/requiem'
import { roadPoint, roadStop } from '../../src/lib/roadmap-motion'
import * as roadmapData from '../../src/lib/trophy-roadmap'
import type { CurrentGame, GuideDetail } from '../../src/lib/types'
import { mockApi, renderApp, reply } from '../support/web'

afterEach(() => mock.restore())

test('one continuous route includes confirmed past and opens on the next suggestion without changing progress', () => {
  const data = requiemGame(['chapter-1', 'perfect-shot'])
  const before = structuredClone(data.trophies)
  const { container } = renderApp(<TrophyRoadmap game={data} />)
  const route = screen.getByRole('list', { name: 'Rota completa' })
  expect(within(route).getByRole('button', { name: /Sob um Novo Sol Conquistado/ })).toBeTruthy()
  expect(within(route).getAllByText('Conquistado')).toHaveLength(2)
  expect(container.querySelector('.roadmap-route .is-current')?.getAttribute('data-earned')).toBe(
    'false',
  )
  expect(screen.queryByRole('combobox', { name: 'Explorar objetivo' })).toBeNull()
  expect(container.querySelector('.roadmap-map-tools')).toBeNull()
  expect(data.trophies).toEqual(before)
})

test('origin and arrows navigate past milestones on the same route and resume the suggestion', () => {
  const data = requiemGame(['chapter-1', 'perfect-shot'])
  data.trophies = data.trophies.map((t) => ({
    ...t,
    earnedAt: t.earned
      ? t.id === 32
        ? '2024-01-01T10:00:00Z'
        : '2024-01-01T11:00:00Z'
      : undefined,
  }))
  const before = structuredClone(data.trophies)
  const { container } = renderApp(<TrophyRoadmap game={data} />)
  const current = container.querySelector('.roadmap-destination h3')?.textContent
  const order = [...container.querySelectorAll('.roadmap-route li')].map((x) =>
    x.getAttribute('data-trophy'),
  )
  fireEvent.click(screen.getByRole('button', { name: /Início da rota/ }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Mira perfeita')
  expect(screen.getByRole('button', { name: 'Marco anterior' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Próximo marco' }))
  fireEvent.click(screen.getByRole('button', { name: 'Marco anterior' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Mira perfeita')
  fireEvent.click(screen.getByRole('button', { name: 'Voltar à sugestão' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe(current)
  expect(
    [...container.querySelectorAll('.roadmap-route li')].map((x) => x.getAttribute('data-trophy')),
  ).toEqual(order)
  expect(data.trophies).toEqual(before)
})

test('selection reuses guide analysis while changed progress invalidates it', () => {
  const ongoing = spyOn(roadmapData, 'ongoingObjectives')
  const stages = spyOn(roadmapData, 'trophyRoadmap')
  function LiveProgress() {
    const [data, setData] = useState({
      ...game,
      trophies: [
        { ...game.trophies[1], earned: false, progressValue: 0, progressTarget: 10 },
        game.trophies[0],
      ],
    })
    return (
      <>
        <button
          type="button"
          onClick={() =>
            setData({
              ...data,
              trophies: data.trophies.map((trophy) => ({ ...trophy, earned: true })),
            })
          }
        >
          Receive confirmed progress
        </button>
        <TrophyRoadmap game={data} />
      </>
    )
  }
  renderApp(<LiveProgress />)
  const ongoingCalls = ongoing.mock.calls.length
  const stageCalls = stages.mock.calls.length
  expect(ongoingCalls).toBeGreaterThan(0)
  expect(screen.getByRole('complementary', { name: 'Ao longo da jornada' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Próximo marco' }))
  fireEvent.click(screen.getByRole('button', { name: 'Marco anterior' }))
  expect(ongoing.mock.calls.length).toBe(ongoingCalls)
  expect(stages.mock.calls.length).toBe(stageCalls)
  fireEvent.click(screen.getByRole('button', { name: 'Receive confirmed progress' }))
  expect(ongoing.mock.calls.length).toBeGreaterThan(ongoingCalls)
  expect(stages.mock.calls.length).toBeGreaterThan(stageCalls)
  expect(screen.queryByRole('complementary', { name: 'Ao longo da jornada' })).toBeNull()
})

const savedVisibility = new Map<string, string[]>()
beforeEach(() => {
  savedVisibility.clear()
  mockApi({
    '/api/account/trophy-visibility': ({ body }) => {
      const { owner, game, revealed } = body as { owner: string; game: string; revealed: boolean }
      const saved = new Set(savedVisibility.get(owner) ?? [])
      if (revealed) saved.add(game)
      else saved.delete(game)
      const values = [...saved]
      savedVisibility.set(owner, values)
      return { revealedTrophyGames: values }
    },
  })
})

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
  expect(container.querySelectorAll('.roadmap-route li').length).toBe(3)
  expect(container.querySelector('.journey-trophies')).toBeTruthy()
  expect(container.querySelector('.journey-guide')).toBeTruthy()
  expect(screen.getByText('1 de 3 conquistados')).toBeTruthy()
})

test('hidden advice is opt in, guide markup is sanitized and links retain exact trophy context', async () => {
  const { container } = renderApp(<TrophyRoadmap game={game} />, { path: '/game' })
  expect(screen.queryByText('Secret plot')).toBeNull()
  expect(screen.queryByText('Secret advice')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Revelar ocultos' }))
  await screen.findByRole('button', { name: 'Ocultar segredos' })
  expect(
    screen
      .getByRole('button', { name: 'Ocultar segredos' })
      .querySelector('use')
      ?.getAttribute('href'),
  ).toBe('/icons.svg#eye-off')
  expect(screen.getByText('Secret advice')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Secret scene' })).toBeTruthy()
  const link = [...container.querySelectorAll<HTMLAnchorElement>('.roadmap-ask')].find((a) =>
    a.href.includes('Secret'),
  )
  expect(new URL(link?.href ?? 'http://localhost/').searchParams.get('trophy')).toBe('Secret scene')
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar segredos' }))
  await screen.findByRole('button', { name: 'Revelar ocultos' })
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
  expect(screen.getByRole('list', { name: 'Rota completa' })).toBeTruthy()
  expect(document.querySelectorAll('.roadmap-route li[data-earned="true"]')).toHaveLength(3)
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

test('the route crosses guide stages while the history disclosure stays closed', () => {
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
  expect(container.querySelectorAll('.roadmap-route .roadmap-route-risk')).toHaveLength(1)
  expect(container.querySelector('.roadmap-destination .roadmap-route-risk')).toBeTruthy()
  expect(stops[0]?.getAttribute('data-missable')).toBe('true')
  expect(stops[0]?.querySelector('img')?.getAttribute('src')).toBe('/synthetic-trophy-1.png')
  expect(stops[1]?.querySelector('img')).toBeNull()
  expect(stops[1]?.getAttribute('data-missable')).toBe('false')
  expect(stops[1]?.textContent).toContain('Troféu oculto')
  expect(stops[2]?.getAttribute('data-final')).toBe('true')
  expect(screen.queryByText('Secret warning')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /First step.*Perdível/ }))
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
    const { container, unmount } = renderApp(
      <TrophyRoadmap
        game={{ ...game, trophies: game.trophies.map((x) => ({ ...x, earned: false })) }}
      />,
    )
    const track = container.querySelector<HTMLOListElement>('.roadmap-route')
    if (!track) throw new Error('route missing')
    const stops = track.querySelectorAll<HTMLLIElement>('li')
    const scroll = mock(() => {})
    track.scrollTo = scroll
    Object.defineProperties(track, {
      clientWidth: { value: 320, configurable: true },
      scrollWidth: { value: 640 },
    })
    Object.defineProperty(stops[0], 'offsetWidth', { value: 320 })
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

test('selection stays on the visible page, crosses its boundary symmetrically and keeps order', () => {
  spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(performance.now() + 1000)
    return 1
  })
  const previous = globalThis.ResizeObserver
  let resize = () => {}
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      resize = callback
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  try {
    const trophies = Array.from({ length: 7 }, (_, id) => ({
      ...game.trophies[1],
      id,
      name: `Stop ${id}`,
      earned: false,
    }))
    const { container } = renderApp(
      <TrophyRoadmap game={{ ...game, focus: null, guide: null, trophies }} />,
    )
    const track = container.querySelector<HTMLOListElement>('.roadmap-route')
    if (!track) throw new Error('route missing')
    const stops = [...track.querySelectorAll<HTMLLIElement>('li')]
    const scroll = mock(() => {})
    track.scrollTo = scroll
    Object.defineProperty(track, 'clientWidth', { value: 300, configurable: true })
    stops.forEach((node, index) => {
      Object.defineProperties(node, {
        offsetWidth: { value: 100 },
        offsetLeft: { value: index * 100 },
      })
    })
    resize()
    expect(track.style.getPropertyValue('--roadmap-tail')).toBe('200px')
    const next = () => fireEvent.click(screen.getByRole('button', { name: 'Próximo marco' }))
    next()
    next()
    expect(scroll).toHaveBeenLastCalledWith({ left: 0, behavior: 'auto' })
    expect(stops[2].querySelector('button')?.getAttribute('aria-pressed')).toBe('true')
    next()
    expect(scroll).toHaveBeenLastCalledWith({ left: 300, behavior: 'auto' })
    fireEvent.click(screen.getByRole('button', { name: 'Marco anterior' }))
    expect(scroll).toHaveBeenLastCalledWith({ left: 0, behavior: 'auto' })
    next()
    next()
    next()
    next()
    expect(scroll).toHaveBeenLastCalledWith({ left: 600, behavior: 'auto' })
    expect(
      (screen.getByRole('button', { name: 'Próximo marco' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect([...track.querySelectorAll('li')]).toEqual(stops)
    Object.defineProperty(track, 'clientWidth', { value: 700 })
    resize()
    expect(scroll).toHaveBeenLastCalledWith({ left: 0, behavior: 'auto' })
  } finally {
    globalThis.ResizeObserver = previous
  }
})

test('reveal applies to the whole game, reloads from the account and isolates other games and accounts', async () => {
  const hiddenGame = {
    ...game,
    trophies: game.trophies.map((trophy) => ({ ...trophy, hidden: true, earned: false })),
  }
  let view = renderApp(<TrophyRoadmap game={hiddenGame} />)
  expect(
    screen
      .getByRole('button', { name: 'Revelar ocultos' })
      .querySelector('use')
      ?.getAttribute('href'),
  ).toBe('/icons.svg#eye')
  fireEvent.click(screen.getByRole('button', { name: 'Revelar ocultos' }))
  await screen.findByRole('button', { name: 'Ocultar segredos' })
  expect(view.container.querySelector('.roadmap-route')?.textContent).not.toContain('Troféu oculto')
  expect(screen.queryByRole('button', { name: 'Revelar este troféu' })).toBeNull()
  expect(localStorage.length).toBe(0)
  expect(
    screen
      .getByRole('button', { name: 'Ocultar segredos' })
      .querySelector('use')
      ?.getAttribute('href'),
  ).toBe('/icons.svg#eye-off')
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar segredos' }))
  const revealAgain = await screen.findByRole('button', { name: 'Revelar ocultos' })
  expect(revealAgain.querySelector('use')?.getAttribute('href')).toBe('/icons.svg#eye')
  fireEvent.click(revealAgain)
  await screen.findByRole('button', { name: 'Ocultar segredos' })
  view.unmount()
  const account = { ...SAMPLE_ME, revealedTrophyGames: savedVisibility.get(SAMPLE_ME.id) }
  view = renderApp(<TrophyRoadmap game={hiddenGame} />, { value: { me: account } })
  expect(
    screen.getByRole('button', { name: 'Ocultar segredos' }).getAttribute('aria-pressed'),
  ).toBe('true')
  view.unmount()
  view = renderApp(
    <TrophyRoadmap game={{ ...hiddenGame, game: { ...hiddenGame.game, id: 'game:another' } }} />,
    { value: { me: account } },
  )
  expect(screen.getByRole('button', { name: 'Revelar ocultos' }).getAttribute('aria-pressed')).toBe(
    'false',
  )
  view.unmount()
  view = renderApp(<TrophyRoadmap game={hiddenGame} />, {
    value: { me: { ...SAMPLE_ME, id: 'user:another' } },
  })
  expect(screen.getByRole('button', { name: 'Revelar ocultos' }).getAttribute('aria-pressed')).toBe(
    'false',
  )
  expect(hiddenGame.trophies.every((trophy) => trophy.hidden)).toBe(true)
})

test('failed save keeps trophies hidden and reports the failure', async () => {
  mockApi({ '/api/account/trophy-visibility': reply(500, { message: 'Unavailable' }) })
  const { container } = renderApp(<TrophyRoadmap game={game} />)
  fireEvent.click(screen.getByRole('button', { name: 'Revelar ocultos' }))
  expect(
    await screen.findByText('Não foi possível salvar a preferência. Tente novamente.'),
  ).toBeTruthy()
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Troféu oculto')
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

test('ongoing objectives stay present while browsing and never complete from a full counter alone', () => {
  const items = [
    { ...game.trophies[1], earned: false, hidden: false, progressValue: 10, progressTarget: 10 },
    game.trophies[0],
  ]
  const { container, unmount } = renderApp(<TrophyRoadmap game={{ ...game, trophies: items }} />)
  const ongoing = screen.getByRole('complementary', { name: 'Ao longo da jornada' })
  expect(ongoing.textContent).toContain('PSN: 10 / 10')
  fireEvent.click(screen.getByRole('button', { name: 'Próximo marco' }))
  expect(ongoing.textContent).toContain('First step')
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Complete')
  unmount()
  renderApp(
    <TrophyRoadmap game={{ ...game, trophies: items.map((t) => ({ ...t, earned: true })) }} />,
  )
  expect(screen.queryByRole('complementary', { name: 'Ao longo da jornada' })).toBeNull()
})

test('start comparison uses the real list but never mutates account progress or counters', () => {
  const items = [{ ...game.trophies[1], progressValue: 8, progressTarget: 10 }, game.trophies[0]]
  const { container } = renderApp(<TrophyRoadmap game={{ ...game, trophies: items }} />)
  expect(container.querySelectorAll('.roadmap-route li')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Ver desde o início' }))
  expect(container.querySelector('.roadmap-preview-notice[role=status]')?.textContent).toContain(
    'PRÉVIA DO INÍCIO',
  )
  expect(container.querySelectorAll('.roadmap-route li')).toHaveLength(2)
  expect(screen.queryByText('Progresso não informado pela PSN')).toBeNull()
  expect(screen.queryByText('PSN: 8 / 10')).toBeNull()
  expect(container.querySelector('.roadmap-past')).toBeNull()
  expect(items[0].earned).toBe(true)
  expect(items[0].progressValue).toBe(8)
  fireEvent.click(screen.getByRole('button', { name: 'Voltar ao meu progresso' }))
  expect(container.querySelectorAll('.roadmap-route li')).toHaveLength(2)
  expect(container.querySelector('.roadmap-past')).toBeTruthy()
})

test('movement starts on the next frame, follows the cubic road both ways and cancels on unmount', () => {
  const original = globalThis.ResizeObserver
  let resize = () => {}
  globalThis.ResizeObserver = class {
    constructor(cb: () => void) {
      resize = cb
    }
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  let frame: FrameRequestCallback = () => {}
  const raf = spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    frame = cb
    return 41
  })
  const cancel = spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
  spyOn(performance, 'now').mockReturnValue(0)
  try {
    const trophies = Array.from({ length: 4 }, (_, id) => ({
      ...game.trophies[1],
      id,
      name: `Stop ${id}`,
      earned: false,
    }))
    const view = renderApp(<TrophyRoadmap game={{ ...game, guide: null, focus: null, trophies }} />)
    const track = view.container.querySelector<HTMLOListElement>('.roadmap-route')
    if (!track) throw new Error('roadmap track missing')
    Object.defineProperty(track, 'clientWidth', { value: 300 })
    Object.defineProperty(track.querySelector('li'), 'offsetWidth', { value: 100 })
    track.scrollTo = mock(() => {})
    resize()
    const start = roadStop(0, 3)
    const end = roadStop(1, 3)
    const cursor = () => ({
      x: Number.parseFloat(track.style.getPropertyValue('--roadmap-cursor-x')) + 6,
      y: Number.parseFloat(track.style.getPropertyValue('--roadmap-cursor-y')) + 6,
    })
    expect(cursor()).toEqual(roadPoint(start, 100))
    fireEvent.click(screen.getByRole('button', { name: 'Próximo marco' }))
    expect(raf).toHaveBeenCalled()
    frame(16)
    expect(cursor().x).toBeGreaterThan(roadPoint(start, 100).x)
    frame(120)
    expect(cursor()).toEqual(roadPoint((start + end) / 2, 100))
    frame(240)
    expect(cursor()).toEqual(roadPoint(end, 100))
    expect(track.querySelector('path')?.getAttribute('d')).toContain('102 56')
    fireEvent.click(screen.getByRole('button', { name: 'Marco anterior' }))
    frame(120)
    expect(cursor()).toEqual(roadPoint((start + end) / 2, 100))
    frame(240)
    expect(cursor()).toEqual(roadPoint(start, 100))
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    spyOn(window, 'matchMedia').mockReturnValue({
      ...media,
      matches: true,
      addEventListener: mock(() => {}),
      removeEventListener: mock(() => {}),
    })
    raf.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Próximo marco' }))
    expect(raf).not.toHaveBeenCalled()
    expect(cursor()).toEqual(roadPoint(end, 100))
    view.unmount()
    expect(cancel).toHaveBeenCalledWith(41)
  } finally {
    globalThis.ResizeObserver = original
  }
})

test('mounted Requiem roadmap shows reviewed chronology, preparation and no inferred position', () => {
  renderApp(<TrophyRoadmap game={requiemGame(['chapter-3'])} />)
  expect(screen.getByRole('heading', { name: 'Piedade', level: 3 })).toBeTruthy()
  expect(screen.getByText(/Capítulo 3 concluído na PSN/)).toBeTruthy()
  expect(screen.getAllByText(/preserve a vida do guarda/).length).toBeGreaterThan(0)
  expect(screen.getByText(/A oportunidade ocorre dentro do capítulo 4/)).toBeTruthy()
  expect(screen.queryByText('Seu progresso e objetivos paralelos')).toBeNull()
  expect(
    within(screen.getByRole('region', { name: 'Enquanto avança' })).getByRole('button', {
      name: 'Exploradora',
    }),
  ).toBeTruthy()
  expect(screen.queryByText(/Feche o jogo imediatamente/)).toBeNull()
})

test('live out-of-order progress re-evaluates an unselected route', () => {
  function Live() {
    const [data, setData] = useState(requiemGame())
    return (
      <>
        <button type="button" onClick={() => setData(requiemGame(['chapter-8']))}>
          New milestone
        </button>
        <TrophyRoadmap game={data} />
      </>
    )
  }
  renderApp(<Live />)
  expect(screen.getByRole('heading', { name: 'Mira perfeita', level: 3 })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'New milestone' }))
  expect(screen.getByRole('heading', { name: 'Antiga protetora', level: 3 })).toBeTruthy()
  expect(screen.getByText(/Capítulo 8 concluído na PSN/)).toBeTruthy()
})

test('partial reviewed lists do not claim a personalized recommendation', () => {
  const data = requiemGame()
  renderApp(<TrophyRoadmap game={{ ...data, trophies: data.trophies.slice(0, 3) }} />)
  expect(screen.getByText(/não corresponde a todos os objetivos revisados/)).toBeTruthy()
  expect(screen.queryByText('Sugestão atual do guia')).toBeNull()
})

test('reviewed hidden trophy advice never bypasses the account reveal preference', () => {
  const data = requiemGame()
  renderApp(
    <TrophyRoadmap
      game={{ ...data, trophies: data.trophies.map((x) => ({ ...x, hidden: true })) }}
    />,
  )
  expect(screen.getByRole('heading', { name: 'Troféu oculto', level: 3 })).toBeTruthy()
  expect(screen.queryByText(/desafio das pinhas/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Exploradora' })).toBeNull()
})

test('the mounted Odyssey catalog preview uses reviewed base goals without changing chat identity', async () => {
  const { odysseyGame } = await import('../../src/fixtures/odyssey')
  const data = odysseyGame()
  const { container } = renderApp(
    <TrophyRoadmap preview game={{ ...data, np: data.game.id, edition: 'NPWR13822_00' }} />,
  )
  const panel = screen.getByRole('region', { name: 'Enquanto avança' })
  expect(screen.getByText(/região, nível, inventário/)).toBeTruthy()
  expect(within(panel).getAllByRole('button')).toHaveLength(11)
  fireEvent.click(within(panel).getByRole('button', { name: 'Cria de Poseidon' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Cria de Poseidon')
  expect(container.querySelector('.roadmap-advice')?.textContent).toContain(
    'use Ikaros para localizar',
  )
  expect(container.querySelector('.roadmap-ask')?.getAttribute('href')).toContain(
    'game=game%3A103054',
  )
  expect(container.textContent).not.toContain('Capítulo 0')
})

test('Odyssey preparation removes only earned base objectives, protecting hidden goals and DLC', async () => {
  const { odysseyGame } = await import('../../src/fixtures/odyssey')
  const data = odysseyGame(['contracts', 'poseidon', 'episode-9'])
  data.trophies = data.trophies.map((t) => ({ ...t, hidden: t.name === 'Nos Braços de Afrodite' }))
  data.trophies.push({
    ...data.trophies[0],
    groupId: '001',
    name: 'DLC illustration',
    earned: false,
  })
  const { container } = renderApp(<TrophyRoadmap game={data} />)
  const panel = screen.getByRole('region', { name: 'Enquanto avança' })
  expect(within(panel).queryByRole('button', { name: 'Cria de Poseidon' })).toBeNull()
  expect(within(panel).queryByRole('button', { name: 'Nos Braços de Afrodite' })).toBeNull()
  expect(within(panel).queryByRole('button', { name: 'DLC illustration' })).toBeNull()
  expect(within(panel).getByRole('button', { name: 'Senhor dos Mares' })).toBeTruthy()
  expect(container.textContent).not.toContain('Capítulo 17')
})

test('campaign is visible first, with origin and destination, while guidance follows selection without writing progress', () => {
  const data = requiemGame(['chapter-1', 'perfect-shot'])
  const before = structuredClone(data.trophies)
  const { container } = renderApp(<TrophyRoadmap game={data} />)
  const expedition = container.querySelector('.roadmap-expedition')
  if (!expedition) throw new Error('campaign container missing')
  expect(expedition.firstElementChild?.className).toBe('roadmap-campaign')
  expect(container.querySelector('.roadmap-explore')).toBeNull()
  const focus = container.querySelector('.roadmap-focus')
  if (!focus) throw new Error('guidance missing')
  expect(focus.querySelector('.roadmap-advice > p')?.textContent?.length).toBeGreaterThan(20)
  expect(container.querySelector('.roadmap-map-tools')).toBeNull()
  const initial = focus.querySelector('h3')?.textContent
  const order = [...container.querySelectorAll('.roadmap-route li')].map((x) =>
    x.getAttribute('data-trophy'),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Próximo marco' }))
  expect(focus.querySelector('h3')?.textContent).not.toBe(initial)
  expect(
    [...container.querySelectorAll('.roadmap-route li')].map((x) => x.getAttribute('data-trophy')),
  ).toEqual(order)
  fireEvent.click(screen.getByRole('button', { name: 'Voltar à sugestão' }))
  expect(focus.querySelector('h3')?.textContent).toBe(initial)
  fireEvent.click(screen.getByRole('button', { name: 'Destino Platina' }))
  expect(focus.querySelector('h3')?.textContent).toBe(
    data.trophies.find((x) => x.type === 'platinum')?.name,
  )
  fireEvent.click(screen.getByRole('button', { name: /Início da rota/ }))
  expect(screen.getByRole('list', { name: 'Rota completa' })).toBeTruthy()
  expect(data.trophies).toEqual(before)
})

test('parallel objectives select existing milestones and history selection keeps its map marker', () => {
  const data = requiemGame(['chapter-1', 'perfect-shot'])
  const { container } = renderApp(<TrophyRoadmap game={data} />)
  const parallel = container.querySelector('.roadmap-parallel')
  if (!parallel) throw new Error('parallel route missing')
  expect(parallel.tagName).toBe('SECTION')
  expect(within(parallel as HTMLElement).queryByRole('group')).toBeNull()
  const button = within(parallel as HTMLElement).getAllByRole('button')[0]
  fireEvent.click(button)
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe(button.textContent)
  expect(container.querySelector('.roadmap-route .is-current')?.textContent).toContain(
    button.textContent,
  )
  const history = container.querySelector('.roadmap-past')
  if (!history) throw new Error('history missing')
  fireEvent.click(within(history as HTMLElement).getByText(/Conquistas anteriores/))
  fireEvent.click(within(history as HTMLElement).getByRole('button', { name: 'Mira perfeita' }))
  expect(container.querySelector('.roadmap-route .is-current')?.getAttribute('data-earned')).toBe(
    'true',
  )
  expect(container.querySelector('.roadmap-route .is-current')?.textContent).toContain(
    'Mira perfeita',
  )
  expect(screen.getByRole('link', { name: 'Ler dica deste objetivo' }).getAttribute('href')).toBe(
    '#roadmap-focus',
  )
})

test('campaign ends at the base platinum while additional trophies remain available through exploration', () => {
  const dlc = { ...game.trophies[1], id: 99, groupId: '1', name: 'Extra objective', earned: false }
  const data = { ...game, trophies: [...game.trophies, dlc] }
  const { container } = renderApp(<TrophyRoadmap game={data} />)
  expect(container.querySelectorAll('.roadmap-route li')).toHaveLength(3)
  expect(container.querySelector('.roadmap-route li:last-child')?.getAttribute('data-final')).toBe(
    'true',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Conteúdo adicional · 1' }))
  expect(container.querySelector('.roadmap-route')?.textContent).toContain('Extra objective')
  expect(container.querySelector('.roadmap-route')?.textContent).not.toContain('Complete')
  expect(screen.getByRole('heading', { name: 'Além do jogo base' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Destino Platina' }))
  expect(container.querySelector('.roadmap-route li:last-child')?.getAttribute('data-final')).toBe(
    'true',
  )
  expect(data.trophies[3].earned).toBe(false)
})

test('mounted sync moves out-of-order achievements into timestamp history and rebases the next action', () => {
  const original = requiemGame(['chapter-1'])
  original.trophies = original.trophies.map((t) => ({
    ...t,
    earnedAt: t.earned ? '2024-01-03T12:00:00Z' : undefined,
  }))
  function LiveSync() {
    const [data, setData] = useState(original)
    return (
      <>
        <button
          type="button"
          onClick={() =>
            setData({
              ...data,
              trophies: data.trophies.map((t) =>
                t.id === 8 ? { ...t, earned: true, earnedAt: '2024-01-02T12:00:00Z' } : t,
              ),
            })
          }
        >
          Receive sync
        </button>
        <TrophyRoadmap game={data} />
      </>
    )
  }
  const { container } = renderApp(<LiveSync />)
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Recém-chegados')
  fireEvent.click(screen.getByRole('button', { name: 'Receive sync' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Antiga protetora')
  const names = [...container.querySelectorAll('.roadmap-route-name')].map((e) => e.textContent)
  expect(names.slice(0, 3)).toEqual(['Mar de Promessas', 'Sob um Novo Sol', 'Antiga protetora'])
  expect(
    [...container.querySelectorAll('.roadmap-past time')].map((e) => e.getAttribute('datetime')),
  ).toEqual(['2024-01-02T12:00:00.000Z', '2024-01-03T12:00:00.000Z'])
  fireEvent.click(screen.getByRole('button', { name: 'Marco anterior' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Sob um Novo Sol')
  expect([...container.querySelectorAll('.roadmap-route-name')].map((e) => e.textContent)).toEqual(
    names,
  )
  expect(original.trophies.filter((t) => t.earned)).toHaveLength(1)
})

test('undated achievements remain explicit and start preview discards personal chronology', () => {
  const data = requiemGame(['chapter-8'])
  const { container, unmount } = renderApp(<TrophyRoadmap game={data} />)
  expect(container.querySelector('.roadmap-route > li:first-child')?.textContent).toContain(
    'Data indisponível',
  )
  expect(container.querySelector('.roadmap-past')?.textContent).toContain(
    'sem ordem cronológica conhecida',
  )
  expect(container.querySelector('.roadmap-past time')).toBeNull()
  unmount()
  renderApp(<TrophyRoadmap preview game={data} />)
  expect(screen.getByRole('heading', { name: 'Mira perfeita', level: 3 })).toBeTruthy()
  expect(document.querySelectorAll('.roadmap-route [data-earned="true"]')).toHaveLength(0)
  expect(document.querySelector('.roadmap-past')).toBeNull()
  expect(screen.getByText(/Comparação sem progresso pessoal/)).toBeTruthy()
})
