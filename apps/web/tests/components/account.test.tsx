import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MockAppState, SAMPLE_ME } from '../../src/app/app-state'
import { AccountCards, AccountSkeleton } from '../../src/components/account'
import { OPEN_ONBOARDING } from '../../src/components/onboarding'
import type { Me } from '../../src/lib/types'
import { ToastHost } from '../../src/ui/toast'

const linked: Me = { ...SAMPLE_ME, includeDlcProgress: true }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const show = (user: Me = SAMPLE_ME, props: { onEditing?: () => void } = {}) =>
  render(
    <MockAppState>
      <AccountCards user={user} onEditing={props.onEditing} />
      <ToastHost />
    </MockAppState>,
  )

const type = (label: string, value: string) => {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

let restart: ReturnType<typeof spyOn>
beforeEach(() => {
  restart = spyOn(location, 'assign').mockImplementation(() => {})
})
afterEach(() => mock.restore())

describe('Preferences', () => {
  test('Nexo’s notices show only where the instance allows them, and turn off for free', async () => {
    const { unmount } = show()
    expect(screen.queryByRole('switch', { name: /Avisos escritos pelo Nexo/ })).toBeNull()
    unmount()
    const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ user: { ...SAMPLE_ME, aiNotices: false, aiNoticesAvailable: true } }),
    )
    show({ ...SAMPLE_ME, aiNoticesAvailable: true })
    const toggle = screen.getByRole('switch', { name: /Avisos escritos pelo Nexo/ })
    expect((toggle as HTMLInputElement).checked).toBe(true)
    fireEvent.click(toggle)
    expect(await screen.findByText('Seus avisos agora são simples.')).toBeTruthy()
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ aiNotices: false })
  })

  test('a failed notices change goes back', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(json({}, 500))
    show({ ...SAMPLE_ME, aiNoticesAvailable: true })
    const toggle = screen.getByRole('switch', { name: /Avisos escritos pelo Nexo/ })
    fireEvent.click(toggle)
    await waitFor(() => expect((toggle as HTMLInputElement).checked).toBe(true))
  })

  test('turning DLC on saves it and tells the app', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ user: { ...SAMPLE_ME, includeDlcProgress: true } }),
    )
    const changed = mock()
    document.addEventListener('preferences:changed', changed)
    show()
    const toggle = screen.getByRole('switch', { name: /Contar DLCs no progresso/ })
    fireEvent.click(toggle)
    expect(await screen.findByText('O progresso agora conta as DLCs.')).toBeTruthy()
    expect((toggle as HTMLInputElement).checked).toBe(true)
    expect(changed).toHaveBeenCalled()
    document.removeEventListener('preferences:changed', changed)
  })

  test('turning DLC off says the progress is base game only', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(json({ user: SAMPLE_ME }))
    show(linked)
    fireEvent.click(screen.getByRole('switch', { name: /Contar DLCs/ }))
    expect(await screen.findByText('O progresso agora mostra só o jogo base.')).toBeTruthy()
  })

  test('a failed save flips the switch back', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(json({}, 500))
    show()
    const toggle = screen.getByRole('switch', { name: /Contar DLCs/ }) as HTMLInputElement
    fireEvent.click(toggle)
    expect(await screen.findByText(/Não conseguimos salvar a preferência/)).toBeTruthy()
    expect(toggle.checked).toBe(false)
  })
})

describe('Account', () => {
  test('shows the PSN id, or a placeholder without an avatar', () => {
    show({ ...SAMPLE_ME, avatarUrl: undefined })
    const id = screen.getByText('ID da PlayStation Network')
    expect(id.previousElementSibling?.textContent).toBe('jogador')
  })

  test('changing the password needs the current one and a matching new pair', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: true }))
    const onEditing = mock()
    show(SAMPLE_ME, { onEditing })
    fireEvent.click(screen.getByRole('button', { name: 'Trocar senha' }))
    expect(onEditing).toHaveBeenLastCalledWith(true)
    const save = screen.getByRole('button', { name: 'Salvar nova senha' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    type('Senha atual', 'velha123')
    type('Nova senha', 'nova-senha')
    type('Repita a senha', 'nova-senha')
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    expect(
      await screen.findByText('Senha trocada. As outras sessões foram encerradas.'),
    ).toBeTruthy()
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
      current: 'velha123',
      next: 'nova-senha',
    })
    await waitFor(() => expect(onEditing).toHaveBeenLastCalledWith(false))
  })

  test('a wrong current password shows the server message; cancel clears it', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(json({ message: 'Senha atual incorreta.' }, 400))
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Trocar senha' }))
    type('Senha atual', 'errada')
    type('Nova senha', 'nova-senha')
    type('Repita a senha', 'nova-senha')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Senha atual incorreta.')
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancelar' })[0])
    expect((screen.getByLabelText('Senha atual') as HTMLInputElement).value).toBe('')
  })

  test('an error without a message falls back to a generic one', async () => {
    spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Trocar senha' }))
    type('Senha atual', 'velha123')
    type('Nova senha', 'nova-senha')
    type('Repita a senha', 'nova-senha')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Não conseguimos salvar. Tente de novo.',
    )
  })

  test('deleting the account asks for the PSN id, then starts over', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: true }))
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }))
    const confirm = screen.getByRole('button', { name: 'Excluir conta' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    type('Digite jogador para confirmar', 'JOGADOR ')
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    await waitFor(() => expect(restart).toHaveBeenCalledWith('/'))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/account')
    expect(init?.method).toBe('DELETE')
    expect(JSON.parse(String(init?.body))).toEqual({ onlineId: 'JOGADOR' })
  })

  test('signing out starts over from the login screen once the server confirms', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: true }))
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(screen.getByRole('button', { name: 'Saindo…' })).toBeTruthy()
    await waitFor(() => expect(restart).toHaveBeenCalledWith('/'))
  })

  test('a sign out the server did not confirm keeps the player in and says so', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(json({}, 500))
      .mockResolvedValueOnce(json({ ok: true }))
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(await screen.findByText('Não conseguimos sair agora. Tente de novo.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(restart).not.toHaveBeenCalled()
    // The same button tries again.
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(restart).toHaveBeenCalledWith('/'))
  })

  test('the introduction can be watched again from the preferences', () => {
    const open = mock()
    document.addEventListener(OPEN_ONBOARDING, open)
    show()
    fireEvent.click(screen.getByRole('button', { name: /Rever/ }))
    expect(open).toHaveBeenCalledTimes(1)
    document.removeEventListener(OPEN_ONBOARDING, open)
  })

  test('the skeleton keeps the card titles', () => {
    render(<AccountSkeleton />)
    expect(screen.getByText('Preferências')).toBeTruthy()
    expect(screen.getByText('Conta')).toBeTruthy()
  })
})
