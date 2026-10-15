/** @jsxImportSource @platjourney/web/plugins */
import { expect, spyOn, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { Language } from '../../src/i18n/locale'
import { guardedPage } from '../../src/plugins'

const label = { [Language.PtBR]: 'Olá', [Language.En]: 'Hello' }

test('a plugin page that throws shows an error state, not a blank app', () => {
  const logged = spyOn(console, 'error').mockImplementation(() => {})
  const page = guardedPage({
    path: '/hello',
    label,
    icon: 'star',
    component: (): never => {
      throw new Error('plugin bug')
    },
  })
  render(
    <main data-testid="frame">
      <page.component />
    </main>,
  )
  expect(screen.getByRole('alert').textContent).toContain('Esta página não abriu')
  expect(logged.mock.calls.some(([m]) => String(m).includes('page /hello'))).toBe(true)
  logged.mockRestore()
})

test('a plugin page that works renders as it is', () => {
  const page = guardedPage({ path: '/hello', label, icon: 'star', component: () => <p>oi</p> })
  render(<page.component />)
  expect(screen.getByText('oi')).toBeTruthy()
})
