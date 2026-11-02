import { expect, spyOn, test } from 'bun:test'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { GameColumns } from '../../src/components/game-columns'
import { GameNav } from '../../src/components/game-nav'
import { renderApp } from '../support/web'

test('section navigation opens collapsed guide and lists similar only when present', async () => {
  renderApp(
    <div>
      <div id="nav-hero">Hero</div>
      <GameNav
        hero="nav-hero"
        name="Example"
        sections={[
          ['guide', 'nav-guide'],
          ['trophies', 'nav-trophies'],
          ['similar', 'nav-similar'],
        ]}
      />
      <details id="nav-guide">
        <summary>Open guide</summary>
        <p>Guide text</p>
      </details>
      <section id="nav-trophies">Trophy list</section>
    </div>,
  )
  fireEvent.click(await screen.findByRole('link', { name: 'Guia' }))
  expect(document.getElementById('nav-guide')?.hasAttribute('open')).toBe(true)
  expect(screen.queryByRole('link', { name: 'Parecidos' })).toBeNull()
  const similar = document.createElement('section')
  similar.id = 'nav-similar'
  await act(async () => {
    document.body.append(similar)
  })
  expect(await screen.findByRole('link', { name: 'Parecidos' })).toBeTruthy()
  await act(async () => {
    similar.remove()
  })
  await waitFor(() => {
    if (screen.queryByRole('link', { name: 'Parecidos' }))
      throw new Error('similar link still present')
  })
})

test('section navigation reveals the matching mobile column before scrolling', async () => {
  renderApp(
    <div>
      <div id="pair-hero">Hero</div>
      <GameNav
        hero="pair-hero"
        name="Example"
        sections={[
          ['guide', 'pair-guide'],
          ['trophies', 'pair-trophies'],
        ]}
      />
      <GameColumns
        guide={<section id="pair-guide">Guide text</section>}
        trophies={<section id="pair-trophies">Trophy list</section>}
      />
    </div>,
  )
  fireEvent.click(await screen.findByRole('link', { name: 'Troféus' }))
  expect(document.querySelector('.game-columns-wrap')?.getAttribute('data-side')).toBe('trophies')
  fireEvent.click(screen.getByRole('link', { name: 'Guia' }))
  expect(document.querySelector('.game-columns-wrap')?.getAttribute('data-side')).toBe('guide')
})

test('journey tabs keep the floating navigation on the visible panel', async () => {
  renderApp(
    <div>
      <div id="tabs-hero">Hero</div>
      <GameNav
        hero="tabs-hero"
        name="Example"
        sections={[
          ['trophies', 'tabs-trophies'],
          ['guide', 'tabs-guide'],
        ]}
      />
      <GameColumns
        tabs
        guide={<section id="tabs-guide">Guide</section>}
        trophies={<section id="tabs-trophies">Trophies</section>}
      />
    </div>,
  )
  const trophies = await screen.findByRole('link', { name: 'Troféus' })
  const guide = screen.getByRole('link', { name: 'Guia' })
  fireEvent.click(screen.getByRole('tab', { name: 'Guia' }))
  expect(guide.getAttribute('aria-current')).toBe('location')
  fireEvent.click(screen.getByRole('tab', { name: 'Troféus' }))
  expect(trophies.getAttribute('aria-current')).toBe('location')
  expect(guide.getAttribute('aria-current')).toBeNull()
})

test('scroll tracking uses the native anchor clearance instead of a fixed desktop line', async () => {
  renderApp(
    <div>
      <div id="safe-hero">Hero</div>
      <GameNav
        hero="safe-hero"
        name="Example"
        sections={[
          ['plan', 'safe-session'],
          ['trophies', 'safe-trophies'],
        ]}
      />
      <section id="safe-session">Session</section>
      <section id="safe-trophies" style={{ scrollMarginTop: 138 }}>
        Trophies
      </section>
    </div>,
  )
  const trophies = await screen.findByRole('link', { name: 'Troféus' })
  const target = document.getElementById('safe-trophies')!
  const box = spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 138, 300, 800))
  const height = Object.getOwnPropertyDescriptor(document.documentElement, 'scrollHeight')
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: 3000,
  })
  try {
    fireEvent.scroll(window)
    expect(trophies.getAttribute('aria-current')).toBe('location')
  } finally {
    box.mockRestore()
    if (height) Object.defineProperty(document.documentElement, 'scrollHeight', height)
    else Reflect.deleteProperty(document.documentElement, 'scrollHeight')
  }
})
