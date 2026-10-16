import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MockAppState, SAMPLE_ME } from '../../src/app/app-state'
import {
  NotificationSettings,
  NotificationSettingsView,
} from '../../src/components/notification-settings'
import * as push from '../../src/lib/push'
import type { Me } from '../../src/lib/types'
import { ToastHost } from '../../src/ui/toast'
import { mockApi } from '../support/web'

const me: Me = { ...SAMPLE_ME, telegramLinked: true, notifyTelegram: true, pushKey: 'AQID' }

const show = (user: Me = me) =>
  render(
    <MockAppState>
      <NotificationSettings user={user} />
      <ToastHost />
    </MockAppState>,
  )

afterEach(() => mock.restore())

test('without push on the instance only Telegram shows, and it waits for the link', () => {
  spyOn(push, 'pushState').mockResolvedValue('off')
  show({ ...me, pushKey: null, telegramLinked: false })
  expect(screen.queryByText('Neste aparelho')).toBeNull()
  expect(screen.getByText('Conecte o Telegram acima para receber por lá.')).toBeTruthy()
  expect((screen.getByRole('switch', { name: /No Telegram/ }) as HTMLInputElement).disabled).toBe(
    true,
  )
})

test('turning push on subscribes the device and offers a test', async () => {
  spyOn(push, 'pushState').mockResolvedValue('off')
  const enable = spyOn(push, 'enablePush').mockResolvedValue('on')
  mockApi({ 'POST /api/push/test': { sent: 1 } })
  show()
  const device = await screen.findByRole('switch', { name: /Neste aparelho/ })
  await waitFor(() => expect((device as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(device)
  expect(await screen.findByText('Notificações ligadas neste aparelho.')).toBeTruthy()
  expect(enable).toHaveBeenCalledWith('AQID')
  fireEvent.click(screen.getByRole('button', { name: 'Enviar um teste' }))
  expect(await screen.findByText('Teste enviado. Deve chegar em alguns segundos.')).toBeTruthy()
})

test('turning push off, a test nobody got, and a failure', async () => {
  spyOn(push, 'pushState').mockResolvedValue('on')
  const disable = spyOn(push, 'disablePush').mockRejectedValueOnce(new Error('x'))
  mockApi({ 'POST /api/push/test': { sent: 0 } })
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Enviar um teste' }))
  expect(
    await screen.findByText('Nenhum aparelho recebeu o teste. Desligue e ligue de novo.'),
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('switch', { name: /Neste aparelho/ }))
  expect(await screen.findByText('Não conseguimos mudar agora. Tente de novo.')).toBeTruthy()
  disable.mockResolvedValue('off')
  fireEvent.click(screen.getByRole('switch', { name: /Neste aparelho/ }))
  expect(await screen.findByText('Notificações desligadas neste aparelho.')).toBeTruthy()
})

test('a browser that does not allow it says so instead of a success', async () => {
  spyOn(push, 'pushState').mockResolvedValue('off')
  spyOn(push, 'enablePush').mockResolvedValue('off')
  show()
  const device = await screen.findByRole('switch', { name: /Neste aparelho/ })
  await waitFor(() => expect((device as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(device)
  expect(await screen.findByText(/O navegador não liberou as notificações/)).toBeTruthy()
  expect(screen.queryByText('Notificações ligadas neste aparelho.')).toBeNull()
  expect((device as HTMLInputElement).checked).toBe(false)
})

test('a device that cannot read its state counts as without push', async () => {
  spyOn(push, 'pushState').mockRejectedValue(new Error('x'))
  show()
  expect(await screen.findByText('Este navegador não recebe notificações.')).toBeTruthy()
})

test('Telegram notices turn off and on through the preferences', async () => {
  spyOn(push, 'pushState').mockResolvedValue('off')
  const calls = mockApi({
    'POST /api/account/preferences': ({ body }) => ({
      user: { ...me, notifyTelegram: (body as { notifyTelegram: boolean }).notifyTelegram },
    }),
  })
  show()
  fireEvent.click(screen.getByRole('switch', { name: /No Telegram/ }))
  expect(await screen.findByText('Os avisos não vão mais para o Telegram.')).toBeTruthy()
  expect(calls[0].body).toEqual({ notifyTelegram: false })
})

test('each device state explains itself and only on and off can be switched', () => {
  const props = {
    pushAvailable: true,
    telegramLinked: true,
    notifyTelegram: true,
    busy: false,
    onPush: () => {},
    onTest: () => {},
    onTelegram: () => {},
  }
  const { rerender } = render(<NotificationSettingsView {...props} push="install" />)
  expect(screen.getByText(/adicionar à Tela de Início/i)).toBeTruthy()
  expect(
    (screen.getByRole('switch', { name: /Neste aparelho/ }) as HTMLInputElement).disabled,
  ).toBe(true)
  rerender(<NotificationSettingsView {...props} push="denied" />)
  expect(screen.getByText(/bloqueadas neste navegador/)).toBeTruthy()
  rerender(<NotificationSettingsView {...props} push="native" />)
  expect(screen.getByText(/O app ainda não recebe notificações/)).toBeTruthy()
  rerender(<NotificationSettingsView {...props} push="loading" demo />)
  expect(screen.queryByText(/Os avisos chegam como notificação/)).toBeNull()
})
