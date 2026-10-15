import { afterEach, describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { MockAppState, SAMPLE_DATA, SAMPLE_ME } from '../../src/app/app-state'
import { Shell } from '../../src/app/shell'
import { AccountCards } from '../../src/components/account'
import { NexoChat } from '../../src/components/chat/chat'
import { connectAccount, DemoBanner, DemoNote } from '../../src/components/demo'
import { sampleGoals } from '../../src/components/goals/fixtures'
import { Plan } from '../../src/components/plan'
import { samplePlan } from '../../src/components/plan.stories'
import { recsData } from '../../src/components/recommendations.stories'
import { similarData } from '../../src/components/similar-picks.stories'
import { TrophyList } from '../../src/components/trophy-list'
import { current } from '../../src/fixtures'
import { setLocale } from '../../src/i18n/locale'
import { ApiError, api } from '../../src/lib/api'
import type { Me, Trophy } from '../../src/lib/types'
import { Discover } from '../../src/pages/discover'
import { GoalsView } from '../../src/pages/goals'
import { Login } from '../../src/pages/login'
import { Nexo } from '../../src/pages/nexo'
import { Title } from '../../src/pages/title'
import { recommendedData } from '../../src/pages/title.stories'
import { ToastHost } from '../../src/ui/toast'
import { mockApi, renderApp, reply } from '../support/web'

afterEach(() => mock.restore())

const demo: Me = { ...SAMPLE_ME, onlineId: 'PlatJourneyDemo', demo: true }
const unavailable = 'Indisponível na demonstração. Conecte sua conta da PSN para usar.'
const readOnly = {
  error: 'demo_read_only',
  message: 'Isto é uma demonstração: dá para ver tudo, mas nada é salvo.',
}

describe('the sign-in screen', () => {
  test('opens the demo from the PSN id step', async () => {
    const onSignedIn = mock()
    const calls = mockApi({ 'POST /api/auth/demo': { user: demo } })
    render(<Login onSignedIn={onSignedIn} />)
    expect(screen.getByText('Sem conta na PSN, ou só quer conhecer?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver demonstração' }))
    expect(screen.getByRole('button', { name: 'Abrindo a demonstração…' })).toBeTruthy()
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(demo))
    expect(calls).toEqual([{ path: '/api/auth/demo', method: 'POST', body: {} }])
  })

  test('says so when the server has no demo', async () => {
    mockApi({
      'POST /api/auth/demo': reply(404, {
        error: 'demo_unavailable',
        message: 'A demonstração não está disponível neste servidor.',
      }),
    })
    render(<Login onSignedIn={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver demonstração' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'A demonstração não está disponível neste servidor.',
    )
    expect(screen.getByRole('button', { name: 'Ver demonstração' })).toBeTruthy()
  })
})

describe('the banner', () => {
  test('says it is a demo on every screen and leaves it to connect an account', async () => {
    const calls = mockApi({ 'POST /api/auth/logout': { ok: true } })
    const out = mock()
    document.addEventListener('api:unauthorized', out)
    renderApp(<Shell />, { path: '/history', value: { me: demo } })
    const banner = screen.getByRole('complementary', { name: 'DEMONSTRAÇÃO' })
    expect(banner.textContent).toContain('Você está vendo o PlatJourney com um perfil de exemplo.')
    fireEvent.click(within(banner).getByRole('button', { name: 'Conectar minha conta' }))
    await waitFor(() => expect(out).toHaveBeenCalled())
    expect(calls.some((c) => c.path === '/api/auth/logout')).toBe(true)
    document.removeEventListener('api:unauthorized', out)
  })

  test('is not there for a real account', () => {
    mockApi({})
    renderApp(<Shell />, { path: '/history' })
    expect(document.getElementById('demo-banner')).toBeNull()
  })

  test('takes another way out and speaks English', () => {
    setLocale('en', { persist: false })
    const onConnect = mock()
    render(<DemoBanner onConnect={onConnect} />)
    expect(screen.getByText(/You are looking at PlatJourney with a sample player/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Connect my account' }))
    expect(onConnect).toHaveBeenCalled()
    render(<DemoNote />)
    expect(screen.getByText(/Not available in the demo/)).toBeTruthy()
  })

  test('leaving still signs out when the server does not answer', async () => {
    mockApi({ 'POST /api/auth/logout': reply(500) })
    const out = mock()
    document.addEventListener('api:unauthorized', out)
    await connectAccount()
    expect(out).toHaveBeenCalled()
    document.removeEventListener('api:unauthorized', out)
  })
})

describe('the chat', () => {
  test('is closed in the demo and shows four example exchanges about the demo game', () => {
    const calls = mockApi({})
    renderApp(<Nexo />, { path: '/nexo', value: { me: demo } })
    expect(screen.getByText('Exemplos de conversa sobre Red Dead Redemption 2.')).toBeTruthy()
    const log = screen.getByRole('log', { name: 'Conversa com o Nexo' })
    const examples = log.querySelectorAll('.demo-exchange')
    expect([...examples].map((e) => (e as HTMLElement).dataset.example)).toEqual([
      'missable',
      'hard',
      'next',
      'bug',
    ])
    for (const e of examples) {
      expect(e.querySelector('.msg.user')).toBeTruthy()
      expect(e.querySelector('.msg.assistant')).toBeTruthy()
    }
    expect(within(log).getByText('Como eu pego o Corrida do Ouro?')).toBeTruthy()
    expect(within(log).getByText(/Compendium/)).toBeTruthy()
    expect(within(log).getAllByRole('link', { name: /Red Dead Redemption 2/ })[0]).toBeTruthy()
    expect(screen.queryByLabelText('Mensagem para Nexo')).toBeNull()
    expect(document.getElementById('chat-chips')).toBeNull()
    expect(screen.getByText(/Conecte sua conta da PSN para conversar com o Nexo/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Conectar minha conta' })).toBeTruthy()
    expect(calls).toEqual([])
  })

  test('the examples are in English too', () => {
    setLocale('en', { persist: false })
    const onConnect = mock()
    render(
      <MemoryRouter>
        <NexoChat
          chat={[]}
          sending={false}
          subtitle=""
          onSend={() => {}}
          demo
          onConnect={onConnect}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('How do I get Gold Rush?')).toBeTruthy()
    expect(screen.getByText('Zoologist is stuck at 99%. Is it bugged?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Connect my account' }))
    expect(onConnect).toHaveBeenCalled()
  })
})

describe('what the demo cannot do', () => {
  test('a refused write shows the server notice once, as already handled', async () => {
    mockApi({ 'POST /api/goals': reply(403, readOnly) })
    render(<ToastHost />)
    const error = (await api('/api/goals', { command: 'set 3' }).catch((e) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.handled).toBe(true)
    expect(await screen.findByText(readOnly.message)).toBeTruthy()
  })

  test('a refused write without a message still says it is a demo', async () => {
    mockApi({ 'POST /api/goals': reply(403, { error: 'demo_read_only' }) })
    render(<ToastHost />)
    await api('/api/goals', {}).catch(() => {})
    expect(await screen.findByText('Isto é uma demonstração: nada é salvo.')).toBeTruthy()
  })

  test('account settings are disabled with a note', () => {
    render(
      <MockAppState value={{ me: demo }}>
        <AccountCards user={demo} onChanged={() => {}} />
      </MockAppState>,
    )
    const button = (id: string) => document.getElementById(id) as HTMLButtonElement
    expect(button('telegram-link').disabled).toBe(true)
    expect((document.getElementById('pref-dlc') as HTMLInputElement).disabled).toBe(true)
    expect(button('password-open').disabled).toBe(true)
    expect(button('delete-open').disabled).toBe(true)
    expect(button('logout').disabled).toBe(false)
    expect(screen.getAllByText(unavailable)).toHaveLength(3)
  })

  test('goals show but cannot be edited, added, removed or moved', () => {
    renderApp(<GoalsView goals={sampleGoals} command={mock()} readOnly />)
    expect((document.getElementById('goal-add-toggle') as HTMLButtonElement).disabled).toBe(true)
    expect(document.querySelectorAll('.goal-list li').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-remove]')).toBeNull()
    expect(document.querySelector('[data-draggable]')).toBeNull()
    expect(document.querySelector('[data-grip]')).toBeNull()
    expect(screen.getByText(unavailable)).toBeTruthy()
  })

  test('the stored plan shows without building, redoing or ending one', () => {
    const noop = () => {}
    const props = {
      minutes: 60,
      onMinutes: noop,
      onGo: noop,
      onCancel: noop,
      onNew: noop,
      onDiscard: noop,
      readOnly: true,
    }
    const { unmount } = render(<Plan plan={samplePlan} {...props} />)
    expect(document.querySelector('.road')).toBeTruthy()
    expect(document.querySelector('.plan-actions')).toBeNull()
    unmount()
    render(<Plan plan={null} {...props} />)
    expect((document.getElementById('plan-go') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(unavailable)).toBeTruthy()
  })

  test('recommendations cannot be refreshed, saved or dismissed', async () => {
    mockApi({ '/api/recommendations/similar': similarData, '/api/recommendations': recsData })
    renderApp(<Discover />, { value: { me: demo, data: SAMPLE_DATA, cache: {} } })
    expect(await screen.findByRole('link', { name: /Sekiro/ })).toBeTruthy()
    expect(document.querySelector('.rec-actions')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Pedir ao Nexo/ }))
    const recs = document.getElementById('recs') as HTMLElement
    expect(await within(recs).findByText(/Sekiro/)).toBeTruthy()
    const refresh = screen.getByRole('button', { name: /Gerar de novo/ }) as HTMLButtonElement
    expect(refresh.disabled).toBe(true)
    expect(document.querySelector('.rec-actions')).toBeNull()
    expect(screen.getByText(unavailable)).toBeTruthy()
  })

  test('a game cannot be saved to the interests from its page', async () => {
    mockApi({ '/api/title': recommendedData, '/api/games/similar': { items: [] } })
    renderApp(<Title />, {
      path: '/title/game/game%3A1',
      route: '/title/*',
      value: { me: demo },
    })
    const save = (await screen.findByRole('button', { name: /Salvar/ })) as HTMLButtonElement
    expect(save.disabled).toBe(true)
  })

  test('nobody can ask Nexo about a trophy', () => {
    render(
      <MemoryRouter>
        <MockAppState value={{ me: demo }}>
          <TrophyList trophies={current.trophies as unknown as Trophy[]} np="NPWR1" />
        </MockAppState>
      </MemoryRouter>,
    )
    expect(document.querySelector('.trophy-help-btn')).toBeNull()
  })
})
