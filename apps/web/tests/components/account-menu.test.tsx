import { expect, test } from 'bun:test'
import { act, fireEvent, screen } from '@testing-library/react'
import { AccountMenu } from '../../src/components/account-menu'
import { renderApp } from '../support/web'

const openMenu = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Abrir o menu da conta' }))

test('the photo opens a menu with the player, the profile and signing out', () => {
  renderApp(<AccountMenu onLogout={() => new Promise(() => {})} />)
  expect(screen.queryByRole('menu')).toBeNull()
  openMenu()
  expect(screen.getByRole('menu')).toBeTruthy()
  expect(screen.getByRole('menuitem', { name: 'Meu perfil' })).toBeTruthy()
  expect(screen.getByRole('menuitem', { name: 'Sair' })).toBeTruthy()
})

test('signing out stays busy while it waits', async () => {
  renderApp(<AccountMenu onLogout={() => new Promise(() => {})} />)
  openMenu()
  fireEvent.click(screen.getByRole('menuitem', { name: 'Sair' }))
  const busy = await screen.findByRole('menuitem', { name: 'Saindo…' })
  expect(busy.hasAttribute('disabled')).toBe(true)
})

test('a failed sign out says so and lets the player try again', async () => {
  renderApp(<AccountMenu onLogout={() => Promise.reject(new Error('offline'))} />)
  openMenu()
  await act(async () => {
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sair' }))
  })
  expect(screen.getByRole('alert').textContent).toBe('Não deu para sair. Tente de novo.')
  expect(screen.getByRole('menuitem', { name: 'Sair' }).hasAttribute('disabled')).toBe(false)
})

test('Escape closes the menu', async () => {
  renderApp(<AccountMenu />)
  openMenu()
  fireEvent.keyDown(document, { key: 'Escape' })
  // It fades out first, then leaves the page.
  await act(() => new Promise((done) => setTimeout(done, 300)))
  expect(screen.queryByRole('menu')).toBeNull()
})
