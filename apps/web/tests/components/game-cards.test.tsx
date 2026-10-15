import { expect, test } from 'bun:test'
import { screen, within } from '@testing-library/react'
import { LibraryCard } from '../../src/components/game-cards'
import { rankingData } from '../../src/components/game-cards.stories'
import { renderApp } from '../support/web'

const [daysGone, tsushima] = rankingData
const cardLink = () => screen.getByRole('link', { name: /DAYS GONE|Ghost/ })
const card = (x: HTMLElement) => x.closest('article') as HTMLElement

test('a library card: rank, progress, hours played and the DLC apart', () => {
  renderApp(<LibraryCard item={daysGone} index={0} />)
  const link = cardLink()
  expect(link.getAttribute('href')).toBe('/title/game/game%3A19561')
  expect(document.querySelector('.band-tag')?.textContent).toBe('1')
  expect(link.textContent).toContain('12/46 · faltam 33')
  expect(link.textContent).toContain('26%')
  expect(within(link).getByRole('progressbar', { name: 'Progresso da platina: 26%' })).toBeTruthy()
  expect(link.textContent).toContain('18h jogadas')
  expect(link.textContent).toContain('DLC 0/15')
  // No guide numbers in the ranking: no difficulty.
  expect(within(card(link)).queryByRole('img', { name: /Dificuldade/ })).toBeNull()
  // The progress and the difficulty sit together at the bottom of the card.
  expect(link.querySelector('.band-foot .library-progress')).toBeTruthy()
  expect(link.lastElementChild?.className).toBe('band-foot')
})

test('with the guide’s estimate and difficulty; no DLC line without DLC', () => {
  renderApp(<LibraryCard item={{ ...tsushima, guideHours: 80, difficulty: 4 }} index={1} />)
  const link = cardLink()
  expect(document.querySelector('.band-tag')?.textContent).toBe('2')
  expect(link.textContent).toMatch(/h de ~80h/)
  expect(link.textContent).not.toContain('DLC')
  // On the cover, like the Guides tiles.
  expect(within(card(link)).getByRole('img', { name: 'Dificuldade 4 de 10: Média' })).toBeTruthy()
})

test('time played at or past the estimate: just the hours played', () => {
  renderApp(<LibraryCard item={{ ...daysGone, hours: 51, guideHours: 20 }} index={0} />)
  expect(cardLink().textContent).toContain('51h jogadas')
  expect(cardLink().textContent).not.toContain('de ~20h')
})
