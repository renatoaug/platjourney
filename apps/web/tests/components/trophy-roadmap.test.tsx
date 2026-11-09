import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { fireEvent, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { SAMPLE_ME } from '../../src/app/app-state'
import { Journey } from '../../src/components/journey'
import { TrophyRoadmap } from '../../src/components/trophy-roadmap'
import { current } from '../../src/fixtures'
import { routeFocus, routeGame } from '../../src/fixtures/route'
import { roadPoint, roadStop } from '../../src/lib/roadmap-motion'
import * as roadmapData from '../../src/lib/trophy-roadmap'
import type { CurrentGame, GuideDetail } from '../../src/lib/types'
import { mockApi, renderApp, reply } from '../support/web'

afterEach(() => mock.restore())

test('one continuous route includes confirmed past and opens on the next suggestion without changing progress', () => {
  const data = routeGame(['Primeiro Passo', 'Mira Certeira'])
  const before = structuredClone(data.trophies)
  const { container } = renderApp(<TrophyRoadmap game={data} />)
  const route = screen.getByRole('list', { name: 'Rota completa' })
  expect(within(route).getByRole('button', { name: /Primeiro Passo Conquistado/ })).toBeTruthy()
  expect(container.querySelectorAll('.roadmap-route [data-earned="true"]')).toHaveLength(2)
  expect(container.querySelector('.roadmap-route .is-current')?.getAttribute('data-earned')).toBe(
    'false',
  )
  expect(screen.queryByRole('combobox', { name: 'Explorar objetivo' })).toBeNull()
  expect(container.querySelector('.roadmap-map-tools')).toBeNull()
  expect(data.trophies).toEqual(before)
})

test('origin and arrows navigate past milestones on the same route and resume the suggestion', () => {
  const data = routeGame(['Primeiro Passo', 'Mira Certeira'])
  data.trophies = data.trophies.map((t) => ({
    ...t,
    earnedAt: t.earned
      ? t.name === 'Mira Certeira'
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
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Mira Certeira')
  expect(screen.getByRole('button', { name: 'Marco anterior' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Próximo marco' }))
  fireEvent.click(screen.getByRole('button', { name: 'Marco anterior' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Mira Certeira')
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
  expect(screen.queryByRole('button', { name: 'Voltar à sugestão' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Próximo marco' }))
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
  expect(screen.getByText('Progresso do troféu na PSN: 0 / 10')).toBeTruthy()
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
  expect(screen.queryByRole('button', { name: 'Voltar à sugestão' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Próximo marco' }))
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
  expect(container.querySelectorAll('.roadmap-route .roadmap-route-alert')).toHaveLength(1)
  expect(container.querySelector('.roadmap-destination .roadmap-route-risk')).toBeTruthy()
  expect(stops[0]?.getAttribute('data-missable')).toBe('true')
  expect(stops[0]?.querySelector('img')?.getAttribute('src')).toBe('/synthetic-trophy-1.png')
  expect(stops[1]?.querySelector('img')).toBeNull()
  expect(stops[1]?.getAttribute('data-missable')).toBe('false')
  expect(stops[1]?.textContent).toContain('Troféu oculto')
  expect(stops[2]?.getAttribute('data-final')).toBe('true')
  expect(screen.queryByText('Secret warning')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /First step.*Perdível/ }))
  expect(screen.getByText('Before moving on')).toBeTruthy()
  // The trophy's own trick already says how.
  expect(screen.queryByText('Check the objective')).toBeNull()
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
  expect(container.querySelector('.roadmap-objective use')?.getAttribute('href')).toBe(
    '/icons.svg#target',
  )
  expect(screen.getByText('Como fazer')).toBeTruthy()
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
  expect(screen.queryByText('Como fazer')).toBeNull()
  expect(screen.queryByRole('group', { name: 'Essa dica ajudou?' })).toBeNull()
  expect(screen.queryByText('Sem dica específica no guia.')).toBeNull()
  // A trophy still to get with no advice: how and when, sent to Nexo from here; no "can I miss
  // it" without a warning in the guide.
  const asks = screen.getByRole('navigation', { name: 'Perguntar ao Nexo' })
  const how = within(asks).getByRole('link', { name: 'Como pegar?' })
  expect(how.getAttribute('href')).toContain('ask=how')
  expect(within(asks).getByRole('link', { name: 'Quando fazer?' })).toBeTruthy()
  expect(how.classList.contains('roadmap-ask')).toBe(true)
  expect(within(asks).queryByRole('link', { name: 'Dá pra perder?' })).toBeNull()
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

test('catalog start preview preserves account data without an owned-game comparison toggle', () => {
  const items = [{ ...game.trophies[1], progressValue: 8, progressTarget: 10 }, game.trophies[0]]
  const owned = renderApp(<TrophyRoadmap game={{ ...game, trophies: items }} />)
  expect(owned.container.querySelectorAll('.roadmap-route li')).toHaveLength(2)
  expect(owned.container.querySelector('.roadmap-past')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Ver desde o início' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Marco anterior' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Próximo marco' })).toBeTruthy()
  owned.unmount()
  const { container } = renderApp(<TrophyRoadmap game={{ ...game, trophies: items }} preview />)
  expect(container.querySelectorAll('.roadmap-route li')).toHaveLength(2)
  expect(screen.queryByText('Progresso não informado pela PSN')).toBeNull()
  expect(screen.queryByText('PSN: 8 / 10')).toBeNull()
  expect(container.querySelector('.roadmap-past')).toBeNull()
  expect(items[0].earned).toBe(true)
  expect(items[0].progressValue).toBe(8)
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

test('a trophy shows its own tips, and its phase plan stays apart from them', () => {
  const { container } = renderApp(<TrophyRoadmap game={routeGame(['Primeiro Passo'])} />)
  expect(screen.getByRole('heading', { name: 'Mira Certeira', level: 3 })).toBeTruthy()
  const advice = container.querySelector('.roadmap-advice')
  expect(advice?.textContent).toContain('Carregue cada disparo')
  expect(advice?.textContent).not.toContain('Avance pela história')
  const phase = container.querySelector('.roadmap-phase')
  expect(phase?.querySelector('summary')?.textContent).toContain('Fase 1 — História')
  expect(phase?.textContent).toContain('Avance pela história')
  expect(phase?.hasAttribute('open')).toBe(false)
})

test('a phase plan leaves out the step that names a trophy still hidden', () => {
  const data = routeGame()
  const trophies = data.trophies.map((t) => ({ ...t, hidden: t.name === 'Sem Atalho' }))
  const { container } = renderApp(<TrophyRoadmap game={{ ...data, trophies }} />)
  fireEvent.click(screen.getByRole('button', { name: /Fim da Jornada/ }))
  expect(container.querySelector('.roadmap-phase')?.textContent).toContain('Termine a história')
  expect(container.querySelector('.roadmap-phase')?.textContent).not.toContain('modo arena')
})

test('two trophies of a phase do not show the same text', () => {
  const { container } = renderApp(<TrophyRoadmap game={routeGame()} />)
  const advice = (name: RegExp) => {
    fireEvent.click(screen.getByRole('button', { name }))
    return container.querySelector('.roadmap-advice')?.textContent
  }
  expect(advice(/Sem Atalho/)).toContain('Treine o bloqueio no modo arena')
  expect(advice(/Só a Descrição/)).not.toContain('Treine o bloqueio')
})

test('a tip that repeats the warning or the trick is not shown twice', () => {
  const { container } = renderApp(<TrophyRoadmap game={routeGame()} />)
  fireEvent.click(screen.getByRole('button', { name: /Piedade/ }))
  expect(container.querySelector('.roadmap-caution')?.textContent).toContain('guarda ferido')
  expect(container.querySelector('.roadmap-tips')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Perito/ }))
  expect(container.querySelector('.roadmap-advice')?.textContent).toContain('Use o bloqueio')
})

test('a trick stands alone: no guide mentions beside it, and no warning once earned', () => {
  const game = routeGame()
  const first = game.trophies[0]
  const guide = {
    ...(game.guide as GuideDetail),
    tricks: [{ trophy: first.name, trick: 'O macete completo' }],
    earlyTips: [`Antes de tudo, pegue **${first.name}** no primeiro capítulo.`],
    missables: [{ trophy: first.name, when: 'Antes do portão', how: 'Faça assim' }],
  }
  const pending = { ...first, earned: false, earnedAt: undefined }
  const { container, unmount } = renderApp(
    <TrophyRoadmap game={{ ...game, guide, trophies: [pending, ...game.trophies.slice(1)] }} />,
  )
  fireEvent.click(screen.getAllByRole('button', { name: new RegExp(first.name) })[0])
  const advice = () => container.querySelector('.roadmap-advice')?.textContent ?? ''
  expect(advice()).toContain('O macete completo')
  expect(advice()).toContain('Antes do portão')
  expect(advice()).not.toContain('Faça assim')
  expect(advice()).not.toContain('primeiro capítulo')
  unmount()
  const earned = { ...first, earned: true, earnedAt: '2026-01-01T10:00:00Z' }
  const again = renderApp(
    <TrophyRoadmap game={{ ...game, guide, trophies: [earned, ...game.trophies.slice(1)] }} />,
  )
  fireEvent.click(screen.getAllByRole('button', { name: new RegExp(first.name) })[0])
  expect(again.container.querySelector('.roadmap-caution')).toBeNull()
})

test('trophy kinds count what is left, mark the route and tag the focus trophy', () => {
  const game = routeGame()
  const open = game.trophies.filter((x) => !x.earned && x.groupId === 'default' && !x.hidden)
  const guide = {
    ...(game.guide as GuideDetail),
    trophyKinds: [
      { trophy: open[0].name, kind: 'natural' as const },
      { trophy: open[1].name, kind: 'hunt' as const },
    ],
  }
  const { container } = renderApp(<TrophyRoadmap game={{ ...game, guide }} />)
  expect(container.querySelector('.roadmap-kinds')?.textContent).toContain('1 caçada · 1 natural')
  expect(container.querySelector('[data-kind="natural"]')).toBeTruthy()
  fireEvent.click(screen.getAllByRole('button', { name: new RegExp(open[1].name) })[0])
  expect(container.querySelector('.roadmap-destination .roadmap-kind')?.textContent).toBe('Caçada')
})

test('a guide without kinds counts the list by tier instead, and marks no stop', () => {
  const { container } = renderApp(<TrophyRoadmap game={routeGame()} />)
  expect(container.querySelector('.roadmap-kinds')?.textContent).toMatch(/^1 platina · /)
  expect(container.querySelector('[data-kind]')).toBeNull()
})

test('a collection folds its checklist, keeps each step and stays visible along the way', () => {
  const { container } = renderApp(<TrophyRoadmap game={routeGame()} />)
  const along = screen.getByRole('complementary', { name: 'Ao longo da jornada' })
  fireEvent.click(within(along).getByRole('button', { name: /Colecionador/ }))
  const list = container.querySelector('.roadmap-advice-details')
  expect(list?.querySelector('summary')?.textContent).toBe('Ver os 3 pontos do roteiro')
  expect(list?.textContent).toContain('Praça do mercado')
  expect(list?.textContent).toContain('Contorne pela esquerda')
  expect(list?.textContent).toContain('Volte pela seleção de capítulo')
})

test('a trophy the guide does not explain gets its description and Nexo, with no invented advice', () => {
  const { container } = renderApp(<TrophyRoadmap game={routeGame()} />)
  fireEvent.click(screen.getByRole('button', { name: /Só a Descrição/ }))
  expect(container.querySelector('.roadmap-objective')?.textContent).toContain('não explica')
  expect(container.querySelector('.roadmap-tips')).toBeNull()
  expect(container.querySelector('.roadmap-advice-label')).toBeNull()
  expect(container.querySelector('.roadmap-advice .roadmap-ask')?.getAttribute('href')).toContain(
    'trophy=',
  )
})

test('live progress moves the suggestion on an unselected route', () => {
  function Live() {
    const [data, setData] = useState(routeGame())
    return (
      <>
        <button type="button" onClick={() => setData(routeGame(['Primeiro Passo']))}>
          New milestone
        </button>
        <TrophyRoadmap game={data} />
      </>
    )
  }
  renderApp(<Live />)
  expect(screen.getByRole('heading', { name: 'Primeiro Passo', level: 3 })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'New milestone' }))
  expect(screen.getByRole('heading', { name: 'Mira Certeira', level: 3 })).toBeTruthy()
})

test('hidden trophies keep guide tips and goals behind the account reveal preference', () => {
  const data = routeGame()
  const { container } = renderApp(
    <TrophyRoadmap
      game={{ ...data, trophies: data.trophies.map((x) => ({ ...x, hidden: true })) }}
    />,
  )
  expect(screen.getByRole('heading', { name: 'Troféu oculto', level: 3 })).toBeTruthy()
  expect(container.querySelector('.roadmap-tips')).toBeNull()
  expect(screen.queryByRole('button', { name: /Colecionador/ })).toBeNull()
})

test('a catalog preview keeps the chat on the catalog game', () => {
  const data = routeGame()
  const { container } = renderApp(<TrophyRoadmap preview game={{ ...data, np: data.game.id }} />)
  expect(container.querySelector('.roadmap-ask')?.getAttribute('href')).toContain(
    'game=game%3A900001',
  )
})

test('campaign is visible first, with origin and destination, while guidance follows selection without writing progress', () => {
  const data = routeGame(['Primeiro Passo', 'Mira Certeira'])
  const before = structuredClone(data.trophies)
  const { container } = renderApp(<TrophyRoadmap game={data} />)
  const expedition = container.querySelector('.roadmap-expedition')
  if (!expedition) throw new Error('campaign container missing')
  expect(expedition.firstElementChild?.className).toBe('roadmap-campaign')
  expect(container.querySelector('.roadmap-explore')).toBeNull()
  const focus = container.querySelector('.roadmap-focus')
  if (!focus) throw new Error('guidance missing')
  expect(focus.querySelector('.roadmap-objective')?.textContent?.length).toBeGreaterThan(10)
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
  const data = routeGame(['Primeiro Passo', 'Mira Certeira'])
  const { container } = renderApp(<TrophyRoadmap game={data} />)
  // One list of what to keep along the way, open, not inside a disclosure.
  expect(container.querySelectorAll('.roadmap-parallel')).toHaveLength(0)
  const parallel = container.querySelector('.roadmap-ongoing')
  if (!parallel) throw new Error('parallel route missing')
  expect(parallel.closest('details')).toBeNull()
  const button = within(parallel as HTMLElement).getAllByRole('button')[0]
  const name = button.getAttribute('aria-label') ?? ''
  fireEvent.click(button)
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe(name)
  expect(container.querySelector('.roadmap-route .is-current')?.textContent).toContain(name)
  const history = container.querySelector('.roadmap-past')
  if (!history) throw new Error('history missing')
  fireEvent.click(within(history as HTMLElement).getByText(/Conquistas anteriores/))
  fireEvent.click(within(history as HTMLElement).getByRole('button', { name: 'Mira Certeira' }))
  expect(container.querySelector('.roadmap-route .is-current')?.getAttribute('data-earned')).toBe(
    'true',
  )
  expect(container.querySelector('.roadmap-route .is-current')?.textContent).toContain(
    'Mira Certeira',
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
  const original = routeGame(['Primeiro Passo'])
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
          onClick={() => {
            const trophies = data.trophies.map((t) =>
              t.name === 'Mira Certeira'
                ? { ...t, earned: true, earnedAt: '2024-01-02T12:00:00Z' }
                : t,
            )
            setData({ ...data, trophies, focus: routeFocus(trophies) })
          }}
        >
          Receive sync
        </button>
        <TrophyRoadmap game={data} />
      </>
    )
  }
  const { container } = renderApp(<LiveSync />)
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Mira Certeira')
  fireEvent.click(screen.getByRole('button', { name: 'Receive sync' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Segundo Ato')
  const names = [...container.querySelectorAll('.roadmap-route-name')].map((e) => e.textContent)
  expect(names.slice(0, 3)).toEqual(['Mira Certeira', 'Primeiro Passo', 'Segundo Ato'])
  expect(
    [...container.querySelectorAll('.roadmap-past time')].map((e) => e.getAttribute('datetime')),
  ).toEqual(['2024-01-02T12:00:00.000Z', '2024-01-03T12:00:00.000Z'])
  fireEvent.click(screen.getByRole('button', { name: 'Marco anterior' }))
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toBe('Primeiro Passo')
  expect([...container.querySelectorAll('.roadmap-route-name')].map((e) => e.textContent)).toEqual(
    names,
  )
  expect(original.trophies.filter((t) => t.earned)).toHaveLength(1)
})

test('undated achievements remain explicit and start preview discards personal chronology', () => {
  const data = routeGame(['Terceiro Ato'])
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
  expect(document.querySelectorAll('.roadmap-route [data-earned="true"]')).toHaveLength(0)
  expect(document.querySelector('.roadmap-past')).toBeNull()
})

test('fallback inspection never becomes advice when focus is missing or platinum is unobtainable', () => {
  for (const unavailable of [false, true]) {
    const data = {
      ...game,
      focus: unavailable ? game.focus : null,
      guide: unavailable ? { ...(game.guide as GuideDetail), unobtainable: 'Unavailable' } : null,
    }
    const view = renderApp(<TrophyRoadmap game={data} />)
    expect(view.container.querySelector('.roadmap-route .is-current')).toBeTruthy()
    expect(view.container.querySelector('[data-suggested="true"]')).toBeNull()
    expect(view.container.querySelector('.roadmap-step.is-suggested')).toBeNull()
    expect(screen.queryByText('Sugestão para agora')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Próximo marco' }))
    expect(screen.queryByRole('button', { name: 'Voltar à sugestão' })).toBeNull()
    view.unmount()
  }
})

test('a valid recommendation stays marked while inspecting another milestone', () => {
  const view = renderApp(<TrophyRoadmap game={routeGame()} />)
  const marker = view.container.querySelector('[data-suggested="true"]')
  expect(marker).toBeTruthy()
  expect(view.container.querySelector('.roadmap-step.is-suggested')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Próximo marco' }))
  expect(view.container.querySelector('[data-suggested="true"]')).toBe(marker)
  expect(view.container.querySelector('.roadmap-step.is-suggested')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Voltar à sugestão' }))
  expect(view.container.querySelector('.roadmap-step.is-suggested')).toBeTruthy()
})

test('with every trophy earned, the kinds still count the whole game', () => {
  const game = routeGame()
  const trophies = game.trophies.map((x) => ({
    ...x,
    earned: true,
    earnedAt: '2026-01-01T10:00:00Z',
  }))
  const guide = {
    ...(game.guide as GuideDetail),
    trophyKinds: [{ trophy: trophies[0].name, kind: 'hunt' as const }],
  }
  const { container } = renderApp(<TrophyRoadmap game={{ ...game, trophies, guide }} />)
  expect(container.querySelector('.roadmap-kinds')?.textContent).toContain('1 caçada')
})

test('a trick of several lines reads as numbered steps, and the player can say whether it helped', () => {
  const game = routeGame()
  const first = game.trophies[0]
  const guide = {
    ...(game.guide as GuideDetail),
    tricks: [
      { trophy: first.name, trick: 'Vá até a ponte.\nSegure o botão.\n\nO troféu sai na hora.' },
    ],
  }
  const pending = { ...first, earned: false, earnedAt: undefined }
  const { container } = renderApp(
    <TrophyRoadmap game={{ ...game, guide, trophies: [pending, ...game.trophies.slice(1)] }} />,
  )
  fireEvent.click(screen.getAllByRole('button', { name: new RegExp(first.name) })[0])
  const steps = [...container.querySelectorAll('.roadmap-steps > li')].map((li) => li.textContent)
  expect(steps).toEqual(['Vá até a ponte.', 'Segure o botão.', 'O troféu sai na hora.'])
  const rating = screen.getByRole('group', { name: 'Essa dica ajudou?' })
  expect(container.querySelector('.roadmap-rate')?.getAttribute('data-trophy')).toBe(
    `${first.groupId}:${first.id}`,
  )
  const yes = within(rating).getByRole('button', { name: 'Sim' })
  expect(yes.dataset.rate).toBe('yes')
  fireEvent.click(yes)
  expect(container.querySelector('.roadmap-rate [role="status"]')?.textContent).toBe(
    'Valeu! Isso ajuda a melhorar as dicas.',
  )
  expect(screen.queryByRole('group', { name: 'Essa dica ajudou?' })).toBeNull()
})

test('a dislike counts at once, then asks why, and Other opens a short note', () => {
  const game = routeGame()
  const first = game.trophies[0]
  const guide = {
    ...(game.guide as GuideDetail),
    tricks: [{ trophy: first.name, trick: 'Vá até a ponte.\nSegure o botão.' }],
  }
  const pending = { ...first, earned: false, earnedAt: undefined }
  const { container } = renderApp(
    <TrophyRoadmap game={{ ...game, guide, trophies: [pending, ...game.trophies.slice(1)] }} />,
  )
  fireEvent.click(screen.getAllByRole('button', { name: new RegExp(first.name) })[0])
  const rate = () => container.querySelector('.roadmap-rate') as HTMLElement
  fireEvent.click(within(rate()).getByRole('button', { name: 'Não' }))
  const why = within(rate()).getByRole('group', { name: 'Valeu! O que faltou?' })
  expect(
    within(why)
      .getAllByRole('button')
      .map((b) => b.dataset.reason),
  ).toEqual(['detail', 'wrong', 'unclear', 'other'])
  fireEvent.click(within(why).getByRole('button', { name: 'Outro' }))
  const field = within(rate()).getByRole('textbox', { name: 'Conte o que faltou' })
  const send = within(rate()).getByRole('button', { name: 'Enviar' }) as HTMLButtonElement
  expect(send.disabled).toBe(true)
  fireEvent.change(field, { target: { value: 'Não diz em qual capítulo' } })
  expect(send.disabled).toBe(false)
  fireEvent.click(send)
  expect(rate().querySelector('[role="status"]')?.textContent).toBe(
    'Valeu! Isso ajuda a melhorar as dicas.',
  )
})

test('a reason other than Other closes the rating with thanks', () => {
  const game = routeGame()
  const first = game.trophies[0]
  const guide = {
    ...(game.guide as GuideDetail),
    tricks: [{ trophy: first.name, trick: 'Vá até a ponte.\nSegure o botão.' }],
  }
  const pending = { ...first, earned: false, earnedAt: undefined }
  const { container } = renderApp(
    <TrophyRoadmap game={{ ...game, guide, trophies: [pending, ...game.trophies.slice(1)] }} />,
  )
  fireEvent.click(screen.getAllByRole('button', { name: new RegExp(first.name) })[0])
  const rate = () => container.querySelector('.roadmap-rate') as HTMLElement
  fireEvent.click(within(rate()).getByRole('button', { name: 'Não' }))
  fireEvent.click(within(rate()).getByRole('button', { name: 'Está errada' }))
  expect(rate().querySelector('[role="status"]')?.textContent).toBe(
    'Valeu! Isso ajuda a melhorar as dicas.',
  )
  expect(within(rate()).queryByRole('textbox')).toBeNull()
})

test('the roadmap names its game, so a tip rating can say which game it is about', () => {
  const data = routeGame(['Primeiro Passo'])
  const { container } = renderApp(<TrophyRoadmap game={data} />)
  expect(container.querySelector('.trophy-roadmap')?.getAttribute('data-game')).toBe(data.game.id)
})

test('with places in the guide, a trophy says when it falls instead of leaving a gap', () => {
  const base = routeGame(['Primeiro Passo', 'Segundo Ato'])
  const data: CurrentGame = {
    ...base,
    guide: {
      ...(base.guide as GuideDetail),
      storyline: { unit: 'chapter', total: 3 },
      trophyPlaces: [
        { trophy: 'Primeiro Passo', from: 1 },
        { trophy: 'Mira Certeira', from: 1 },
        { trophy: 'Segundo Ato', from: 2 },
        { trophy: 'Terceiro Ato', from: 3 },
        { trophy: 'Colecionador', from: 1, to: 3 },
      ],
      trophyKinds: [
        { trophy: 'Terceiro Ato', kind: 'natural' },
        { trophy: 'Colecionador', kind: 'grind' },
      ],
    },
  }
  const { container } = renderApp(<TrophyRoadmap game={data} />)
  const when = () => container.querySelector('.roadmap-when')?.textContent
  const route = screen.getByRole('list', { name: 'Rota completa' })
  const pick = (name: RegExp) => fireEvent.click(within(route).getByRole('button', { name }))
  pick(/^Terceiro Ato/)
  expect(when()).toBe(
    'Acontece no capítulo 3, naturalmente pela história. 1 capítulo à frente de você.',
  )
  // A story trophy with no tip has nothing to ask the Nexo about.
  expect(container.querySelector('#roadmap-advice .roadmap-ask')).toBeNull()
  pick(/^Mira Certeira/)
  expect(when()).toBe(
    'Acontecia no capítulo 1, que ficou para trás. Dá para voltar pela seleção de capítulos.',
  )
  pick(/^Colecionador/)
  expect(when()).toBe('Dá para fazer do capítulo 1 ao 3.')
  // A trophy the guide does not place, and that does not come by itself, has no line.
  pick(/^Perito/)
  expect(when()).toBeUndefined()
  expect(container.querySelector('#roadmap-advice .roadmap-ask')).toBeTruthy()
})

test('with a graph in the guide, a trophy says what it still depends on and until when', () => {
  const base = routeGame(['Primeiro Passo'])
  const data: CurrentGame = {
    ...base,
    guide: {
      ...(base.guide as GuideDetail),
      trophyGraph: {
        nodes: [
          { id: 'ponte', label: 'Missão da ponte' },
          { id: 'norte', label: 'linha do norte' },
          { id: 'sul', label: 'linha do sul' },
          { id: 'final', label: 'Último capítulo' },
          { id: 'terceiro', label: 'Terceiro Ato', trophy: 'Terceiro Ato' },
          { id: 'colecionador', label: 'Colecionador', trophy: 'Colecionador' },
        ],
        edges: [
          { from: 'ponte', to: 'terceiro', kind: 'unlocks' },
          { from: 'norte', to: 'colecionador', kind: 'anyOf' },
          { from: 'sul', to: 'colecionador', kind: 'anyOf' },
          { from: 'final', to: 'terceiro', kind: 'closes' },
        ],
      },
    },
  }
  const { container } = renderApp(<TrophyRoadmap game={data} />)
  const needs = () => container.querySelector('.roadmap-needs')?.textContent
  const route = screen.getByRole('list', { name: 'Rota completa' })
  const pick = (name: RegExp) => fireEvent.click(within(route).getByRole('button', { name }))
  pick(/^Terceiro Ato/)
  expect(needs()).toBe('Antes, passe por Missão da ponte. Só dá até Último capítulo.')
  pick(/^Colecionador/)
  expect(needs()).toBe('Antes, passe por linha do norte ou linha do sul.')
  pick(/^Perito/)
  expect(needs()).toBeUndefined()
})
