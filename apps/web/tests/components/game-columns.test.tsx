import { expect, test } from 'bun:test'
import { act, fireEvent, screen } from '@testing-library/react'
import { GameColumns } from '../../src/components/game-columns'
import { renderApp } from '../support/web'

const panels = {
  trophies: (
    <section id="example-trophies">
      <input aria-label="Filtrar troféus" defaultValue="" />
    </section>
  ),
  guide: (
    <section id="example-guide">
      <button type="button">Roteiro</button>
    </section>
  ),
}

test('journey tabs start at trophies and preserve panel state when switching', () => {
  renderApp(<GameColumns tabs {...panels} />)
  const trophies = screen.getByRole('tab', { name: 'Troféus' })
  const guide = screen.getByRole('tab', { name: 'Guia' })
  expect(trophies.getAttribute('aria-selected')).toBe('true')
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'coletável' } })
  fireEvent.click(guide)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByRole('button', { name: 'Roteiro' })).toBeTruthy()
  fireEvent.click(trophies)
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('coletável')
  expect(screen.getByRole('tabpanel').id).toBe(trophies.getAttribute('aria-controls') ?? '')
})

test('keyboard changes tab and focus, while section navigation reveals the correct panel', () => {
  renderApp(<GameColumns tabs {...panels} />)
  const trophies = screen.getByRole('tab', { name: 'Troféus' })
  const guide = screen.getByRole('tab', { name: 'Guia' })
  fireEvent.keyDown(trophies, { key: 'ArrowRight' })
  expect(document.activeElement === guide).toBe(true)
  fireEvent.keyDown(guide, { key: 'Home' })
  expect(document.activeElement === trophies).toBe(true)
  fireEvent.keyDown(trophies, { key: 'End' })
  expect(guide.getAttribute('aria-selected')).toBe('true')
  act(() => window.dispatchEvent(new CustomEvent('game-section', { detail: 'example-trophies' })))
  expect(trophies.getAttribute('aria-selected')).toBe('true')
  act(() => window.dispatchEvent(new CustomEvent('game-section', { detail: 'example-guide' })))
  expect(guide.getAttribute('aria-selected')).toBe('true')
})

test('the original discovery layout keeps both columns and its remembered switch', () => {
  const { unmount } = renderApp(<GameColumns {...panels} />)
  expect(screen.queryByRole('tablist')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Troféus' }))
  unmount()
  renderApp(<GameColumns {...panels} />)
  expect(screen.getByRole('button', { name: 'Troféus' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('textbox')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Roteiro' })).toBeTruthy()
})
