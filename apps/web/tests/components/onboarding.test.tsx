import { afterEach, expect, mock, test } from 'bun:test'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { SAMPLE_DATA, SAMPLE_ME } from '../../src/app/app-state'
import { Onboarding, OPEN_ONBOARDING } from '../../src/components/onboarding'
import type { Me } from '../../src/lib/types'
import { mockApi, renderApp } from '../support/web'

afterEach(() => {
  mock.restore()
  sessionStorage.clear()
})

const player: Me = { ...SAMPLE_ME, onboarded: false }
// A player with a game in progress: every stop applies.
const playing = {
  game: { id: 'game:1', name: 'Astro Bot', cover_url: null },
  name: 'Astro Bot',
  platform: 'PS5',
  progress: 40,
  earned: 20,
  total: 50,
} as unknown as NonNullable<typeof SAMPLE_DATA.current>
const full = { ...SAMPLE_DATA, current: playing }
const welcome = () => screen.queryByRole('dialog', { name: 'Introdução ao PlatJourney' })
const card = () => screen.queryByRole('region', { name: 'Introdução ao PlatJourney' })
const startTour = () => fireEvent.click(screen.getByRole('button', { name: /Começar o tour/ }))
const next = () => fireEvent.click(screen.getByRole('button', { name: /Avançar/ }))
const path = () => screen.getByTestId('location').textContent
// The closing sparks play for 650 ms before the introduction goes.
const closed = () => Bun.sleep(800)

test('the welcome is full screen and shows the player’s own numbers', () => {
  mockApi({})
  renderApp(<Onboarding />, { value: { me: player, data: full } })
  const d = welcome() as HTMLElement
  expect(within(d).getByText('Boas-vindas, jogador.')).toBeTruthy()
  expect(within(d).getByText('FASE 1/11')).toBeTruthy()
  expect(within(d).getByText('Nível')).toBeTruthy()
  expect(card()).toBeNull()
})

test('the tour opens each screen and teaches what to do there', () => {
  mockApi({})
  renderApp(<Onboarding />, { value: { me: player, data: full } })
  startTour()
  expect(welcome()).toBeNull()
  expect(document.body.classList.contains('touring')).toBe(true)
  const stops: [string, string][] = [
    ['/', 'Comece sempre por aqui.'],
    ['/game', 'Ele sabe o que você está jogando.'],
    ['/game', 'Dicas enquanto você joga.'],
    ['/game', 'O que falta, e como fazer.'],
    ['/game', 'Quanto tempo você tem hoje?'],
    ['/nexo', 'Pergunte ao Nexo.'],
    ['/guides', 'Antes de comprar, consulte.'],
    ['/discover', 'Qual vai ser a próxima platina?'],
    ['/goals', 'Sua missão do ano.'],
    ['/profile', 'Ajuste do seu jeito.'],
  ]
  stops.forEach(([route, title], i) => {
    if (i > 0) next()
    expect(path()).toBe(route)
    expect(within(card() as HTMLElement).getByText(title)).toBeTruthy()
  })
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
  expect(path()).toBe('/goals')
})

test('the stops show what each feature looks like', () => {
  mockApi({})
  renderApp(<Onboarding />, { value: { me: player, data: full } })
  startTour()
  next()
  next()
  expect(screen.getByText(/Começou Days Gone/)).toBeTruthy()
  next()
  expect(screen.getByText('Pedir dica')).toBeTruthy()
  next()
  expect(screen.getByText('Missão do acampamento')).toBeTruthy()
})

test('dots and arrow keys move between the stops', () => {
  mockApi({})
  renderApp(<Onboarding />, { value: { me: player, data: full } })
  startTour()
  fireEvent.click(screen.getByRole('button', { name: 'Ir para a fase 4' }))
  expect(screen.getByText('FASE 4/11')).toBeTruthy()
  fireEvent.keyDown(document, { key: 'ArrowRight' })
  expect(screen.getByText('FASE 5/11')).toBeTruthy()
  for (let i = 0; i < 5; i++) fireEvent.keyDown(document, { key: 'ArrowLeft' })
  expect(screen.getByText('FASE 2/11')).toBeTruthy()
})

test('finishing saves it for the player and lands on the overview', async () => {
  const calls = mockApi({ 'POST /api/account/onboarded': { ok: true } })
  const setMe = mock()
  renderApp(<Onboarding />, { value: { me: player, setMe, data: full } })
  startTour()
  for (let i = 0; i < 9; i++) next()
  fireEvent.click(screen.getByRole('button', { name: /Começar a caçada/ }))
  await closed()
  expect(card()).toBeNull()
  expect(document.body.classList.contains('touring')).toBe(false)
  expect(path()).toBe('/')
  expect(setMe).toHaveBeenCalledWith({ ...player, onboarded: true })
  expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /api/account/onboarded'])
})

test('skipping the welcome or the tour counts as seen; Escape skips too', async () => {
  const calls = mockApi({ 'POST /api/account/onboarded': { ok: true } })
  const first = renderApp(<Onboarding />, { value: { me: player, data: full } })
  fireEvent.click(screen.getByRole('button', { name: 'Pular' }))
  await closed()
  expect(welcome()).toBeNull()
  first.unmount()
  renderApp(<Onboarding />, { value: { me: player, data: full } })
  startTour()
  fireEvent.keyDown(document, { key: 'Escape' })
  await closed()
  expect(card()).toBeNull()
  expect(path()).toBe('/')
  expect(calls).toHaveLength(2)
})

test('an onboarded player never gets it', () => {
  mockApi({})
  renderApp(<Onboarding />)
  expect(welcome()).toBeNull()
})

test('the demo remembers it in the browser session and never asks the server', async () => {
  const calls = mockApi({})
  const demo: Me = { ...SAMPLE_ME, onlineId: 'PlatJourneyDemo', demo: true, onboarded: false }
  const { unmount } = renderApp(<Onboarding />, { value: { me: demo, data: full } })
  startTour()
  for (let i = 0; i < 4; i++) next()
  expect(screen.getByText(/Na demonstração, um roteiro pronto mostra como fica/)).toBeTruthy()
  next()
  expect(screen.getByText(/Na demonstração, o chat mostra conversas de exemplo/)).toBeTruthy()
  next()
  next()
  expect(screen.getByText(/Na demonstração, as recomendações já vêm prontas/)).toBeTruthy()
  next()
  next()
  expect(screen.getByText(/Na demonstração, as configurações ficam travadas/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Pular' }))
  await closed()
  expect(sessionStorage.getItem('platjourney:onboarding-demo')).toBe('1')
  expect(calls).toHaveLength(0)
  unmount()
  renderApp(<Onboarding />, { value: { me: demo, data: full } })
  expect(welcome()).toBeNull()
})

test('it can be opened again from anywhere, from the welcome', () => {
  mockApi({})
  renderApp(<Onboarding />)
  act(() => {
    document.dispatchEvent(new Event(OPEN_ONBOARDING))
  })
  expect(welcome()).toBeTruthy()
})

test('without data yet the welcome has no numbers and waits to start', () => {
  mockApi({})
  renderApp(<Onboarding />, { value: { me: player, data: null } })
  expect(screen.queryByText('Nível')).toBeNull()
  expect(screen.getByRole('button', { name: /Sincronizando…/ }).hasAttribute('disabled')).toBe(true)
})

test('the radar shows the game being played with its progress', () => {
  mockApi({})
  const current = {
    game: { id: 'game:1', name: 'Astro Bot', cover_url: null },
    name: 'Astro Bot',
    platform: 'PS5',
    progress: 40,
    earned: 20,
    total: 50,
  } as unknown as NonNullable<typeof SAMPLE_DATA.current>
  renderApp(<Onboarding />, { value: { me: player, data: { ...SAMPLE_DATA, current } } })
  startTour()
  next()
  expect(screen.getByText('Astro Bot')).toBeTruthy()
  expect(screen.getByText('20 de 50 troféus')).toBeTruthy()
})

test('a stop lights the parts of its page it talks about, then lets them go', async () => {
  mockApi({})
  const { container } = renderApp(
    <>
      <main id="main-content">
        <section className="page" data-page="/profile">
          <div className="card" id="telegram-card" />
          <div className="card" id="preferences-card" />
        </section>
      </main>
      <Onboarding />
    </>,
    { value: { me: player, data: full } },
  )
  startTour()
  for (let i = 0; i < 9; i++) next()
  await Bun.sleep(50)
  expect(container.querySelector('#telegram-card')?.hasAttribute('data-tour-spot')).toBe(true)
  expect(container.querySelector('#preferences-card')?.hasAttribute('data-tour-spot')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
  expect(container.querySelector('#telegram-card')?.hasAttribute('data-tour-spot')).toBe(false)
})

test('a first visit without a game skips the stops about it, and the radar says it is an example', () => {
  mockApi({})
  renderApp(<Onboarding />, {
    value: { me: player, data: { ...SAMPLE_DATA, current: null, ranking: [] } },
  })
  expect(screen.getByText('FASE 1/9')).toBeTruthy()
  startTour()
  expect(screen.getByText('Exemplo · no radar')).toBeTruthy()
  next()
  expect(screen.getByText('Jogue algo e ele aparece aqui.')).toBeTruthy()
  next()
  next()
  expect(path()).toBe('/nexo')
})

test('the welcome waits for the first PSN sync before the tour starts', () => {
  mockApi({})
  const first = renderApp(<Onboarding />, {
    value: { me: player, data: { ...full, current: null }, warming: true },
  })
  expect(screen.getByText('Sincronizando seus troféus com a PSN…')).toBeTruthy()
  expect(screen.getByRole('button', { name: /Sincronizando…/ }).hasAttribute('disabled')).toBe(true)
  first.unmount()
  renderApp(<Onboarding />, { value: { me: player, data: full } })
  expect(screen.getByText('Tudo pronto: Astro Bot é o seu jogo atual.')).toBeTruthy()
  expect(screen.getByRole('button', { name: /Começar o tour/ }).hasAttribute('disabled')).toBe(
    false,
  )
})

test('after the sync without a game, the welcome says it will show up once played', () => {
  mockApi({})
  renderApp(<Onboarding />, { value: { me: player, data: { ...full, current: null } } })
  expect(
    screen.getByText('Sincronizado. Assim que você jogar algo, ele aparece aqui.'),
  ).toBeTruthy()
})

test('a stop about a whole page keeps the page clear and lights its tab', async () => {
  mockApi({})
  const { container } = renderApp(
    <>
      <nav className="nav">
        <a href="/nexo">Nexo</a>
      </nav>
      <main id="main-content">
        <section className="page" data-page="/nexo" />
      </main>
      <Onboarding />
    </>,
    { value: { me: player, data: full } },
  )
  startTour()
  for (let i = 0; i < 5; i++) next()
  await Bun.sleep(50)
  expect(container.querySelector('.page')?.hasAttribute('data-tour-page')).toBe(true)
  expect(container.querySelector('.nav a')?.hasAttribute('data-tour-spot')).toBe(true)
  expect(document.body.classList.contains('touring-focus')).toBe(true)
})

test('while touring the app behind takes no clicks; it is back once the tour ends', async () => {
  mockApi({ 'POST /api/account/onboarded': { ok: true } })
  const { container } = renderApp(
    <>
      <div id="app" />
      <Onboarding />
    </>,
    { value: { me: player, data: full } },
  )
  const app = container.querySelector('#app') as HTMLElement
  expect(app.hasAttribute('inert')).toBe(false)
  startTour()
  expect(app.hasAttribute('inert')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Pular' }))
  await closed()
  expect(app.hasAttribute('inert')).toBe(false)
})

test('while the first sync runs there is no skipping', () => {
  mockApi({})
  renderApp(<Onboarding />, {
    value: { me: player, data: { ...full, current: null }, warming: true },
  })
  expect(screen.queryByRole('button', { name: 'Pular' })).toBeNull()
  fireEvent(welcome() as HTMLElement, new Event('cancel', { cancelable: true }))
  expect(welcome()).toBeTruthy()
})
