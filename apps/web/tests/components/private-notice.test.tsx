import { expect, mock, spyOn, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { PrivateNotice } from '../../src/components/private-notice'

test('says the trophies are private and how to open them', () => {
  render(<PrivateNotice />)
  const notice = screen.getByRole('alert')
  expect(screen.getByRole('heading', { name: 'Não conseguimos ver seus troféus' })).toBeTruthy()
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
  expect(notice.textContent).toContain('Configurações → Usuários e contas → Privacidade')
})

test('"Já deixei público" reloads the app', () => {
  const reload = spyOn(window.location, 'reload').mockImplementation(() => {})
  try {
    render(<PrivateNotice />)
    fireEvent.click(screen.getByRole('button', { name: 'Já deixei público' }))
    expect(reload).toHaveBeenCalledTimes(1)
  } finally {
    mock.restore()
  }
})
