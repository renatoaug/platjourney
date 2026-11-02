import { expect, test } from 'bun:test'
import { fireEvent, screen, waitFor } from '@testing-library/react'
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
  document.body.append(similar)
  expect(await screen.findByRole('link', { name: 'Parecidos' })).toBeTruthy()
  similar.remove()
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Parecidos' })).toBeNull())
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
