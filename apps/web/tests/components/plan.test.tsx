import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MockAppState } from '../../src/app/app-state'
import { Plan, PlanCard, type PlanProps, type SessionPlan } from '../../src/components/plan'
import { samplePlan } from '../../src/components/plan.stories'
import { ToastHost } from '../../src/ui/toast'

const noop = () => {}
const show = (props: Partial<PlanProps>) =>
  render(
    <Plan
      plan={samplePlan}
      minutes={120}
      onMinutes={noop}
      onGo={noop}
      onCancel={noop}
      onNew={noop}
      onDiscard={noop}
      {...props}
    />,
  )

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

afterEach(() => mock.restore())

describe('Plan', () => {
  test('an active plan shows the route, the step to play now and the warnings', () => {
    show({})
    expect(screen.getByText('Siga na ordem · 1 de 4')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25')
    expect(screen.getByText(/1 aviso para esta sessão/)).toBeTruthy()
    expect(screen.getByText('Feito')).toBeTruthy()
    expect(screen.getByText('Agora')).toBeTruthy()
    expect(screen.getByText('Depois do passo 2')).toBeTruthy()
    expect(screen.getByText('Qualquer momento')).toBeTruthy()
    expect(screen.getByText('Macete')).toBeTruthy()
    expect(screen.getByText(/Sobrou tempo\? Cace orelhas/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Refazer roteiro/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Encerrar sessão/ })).toBeTruthy()
  })

  test('a finished plan offers a new route and to dismiss it', () => {
    show({
      plan: {
        ...samplePlan,
        status: 'done',
        doneCount: 4,
        nextIndex: -1,
        ifTimeLeft: null,
        warnings: ['Um.', 'Dois.'],
        steps: samplePlan.steps.map((s) => ({ ...s, done: true })),
      },
    })
    expect(screen.getByText('Roteiro cumprido.')).toBeTruthy()
    expect(screen.getByText(/2 avisos para esta sessão/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Montar novo roteiro/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Dispensar/ })).toBeTruthy()
  })

  test('an expired plan says how far it got', () => {
    show({ plan: { ...samplePlan, status: 'expired', warnings: [] } })
    expect(screen.getByText('Sessão encerrada: 1 de 4 troféus.')).toBeTruthy()
    expect(screen.queryByText(/aviso/)).toBeNull()
  })

  test('a plan without steps is at zero', () => {
    show({ plan: { ...samplePlan, steps: [], doneCount: 0 } })
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  })

  test('without a plan it invites to pick a time', () => {
    const onMinutes = mock()
    const onGo = mock()
    show({ plan: null, onMinutes, onGo })
    expect(screen.getByText('Vai jogar agora? Eu monto o caminho.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '2 horas' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: '30 min' }))
    expect(onMinutes).toHaveBeenCalledWith(30)
    fireEvent.click(screen.getByRole('button', { name: /Montar roteiro/ }))
    expect(onGo).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull()
  })

  test('picking a new route can go back to the current one', () => {
    const onCancel = mock()
    show({ picking: true, onCancel })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalled()
  })

  test('building and loading show the skeleton', () => {
    const { unmount } = show({ plan: null, busy: true, minutes: 60 })
    expect(screen.getByText('Montando o roteiro de 1h…')).toBeTruthy()
    unmount()
    show({ plan: undefined })
    expect(screen.getByRole('region', { name: 'Roteiro da sessão' }).className).toBe('plan')
  })
})

describe('PlanCard', () => {
  const card = () =>
    render(
      <MockAppState>
        <PlanCard />
        <ToastHost />
      </MockAppState>,
    )

  test('loads the current plan', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(json({ plan: samplePlan }))
    card()
    expect(await screen.findByText('Siga na ordem · 1 de 4')).toBeTruthy()
  })

  test('a failed load shows the invite', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(json({}, 500))
    card()
    expect(await screen.findByText('Vai jogar agora? Eu monto o caminho.')).toBeTruthy()
  })

  test('builds a route for the time picked', async () => {
    let finish: (r: Response) => void = () => {}
    const built: SessionPlan = { ...samplePlan, minutes: 60 }
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(((
      _url: string,
      init?: RequestInit,
    ) =>
      init?.method === 'POST'
        ? new Promise<Response>((resolve) => {
            finish = resolve
          })
        : Promise.resolve(json({ plan: null }))) as typeof fetch)
    card()
    await screen.findByText('Vai jogar agora? Eu monto o caminho.')
    fireEvent.click(screen.getByRole('button', { name: '1 hora' }))
    fireEvent.click(screen.getByRole('button', { name: /Montar roteiro/ }))
    expect(screen.getByText('Montando o roteiro de 1h…')).toBeTruthy()
    const post = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ minutes: 60 })
    await act(async () => finish(json({ plan: built })))
    expect(await screen.findByText('Roteiro de 1h pronto')).toBeTruthy()
    expect(screen.getByText('Siga na ordem · 1 de 4')).toBeTruthy()
  })

  test('a failed build says so', async () => {
    spyOn(globalThis, 'fetch').mockImplementation(((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === 'POST' ? json({ message: 'erro' }, 500) : json({ plan: null }),
      )) as typeof fetch)
    card()
    await screen.findByText('Vai jogar agora? Eu monto o caminho.')
    fireEvent.click(screen.getByRole('button', { name: /Montar roteiro/ }))
    expect(await screen.findByText('Não conseguimos montar o roteiro. Tenta de novo.')).toBeTruthy()
  })

  test('redo opens the picker, cancel goes back, end discards the plan', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(((
      _url: string,
      init?: RequestInit,
    ) =>
      Promise.resolve(
        init?.method === 'DELETE' ? json({ ok: true }) : json({ plan: samplePlan }),
      )) as typeof fetch)
    card()
    await screen.findByText('Siga na ordem · 1 de 4')
    fireEvent.click(screen.getByRole('button', { name: /Refazer roteiro/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: /Encerrar sessão/ }))
    await waitFor(() =>
      expect(screen.getByText('Vai jogar agora? Eu monto o caminho.')).toBeTruthy(),
    )
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true)
  })
})
