import { expect, test } from 'bun:test'
import { screen } from '@testing-library/react'
import {
  askMessages,
  askText,
  ExplainAsk,
  FirstAsks,
  nexoHref,
  TrophyAsks,
  trophyAsks,
} from '../../src/components/nexo-asks'
import { Language, translator } from '../../src/i18n/i18n'
import { renderApp } from '../support/web'

const params = (href: string | null) => new URL(href ?? '', 'http://x').searchParams

test('the chat link carries the game, the trophy and the question', () => {
  expect(nexoHref(null)).toBe('/nexo')
  const p = params(nexoHref('NPWR1_00', 'Jogo', 'Mestre', 'how'))
  expect([p.get('game'), p.get('name'), p.get('trophy'), p.get('ask')]).toEqual([
    'NPWR1_00',
    'Jogo',
    'Mestre',
    'how',
  ])
  expect(params(nexoHref('game:1', null, null, 'explain', 'O porão')).get('part')).toBe('O porão')
})

test('each question key reads as what the player would have typed', () => {
  const t = translator(askMessages, Language.En)
  expect(askText(t, 'missable')).toBe('Can I miss it?')
  expect(askText(t, 'notice')).toContain('next step')
  expect(askText(t, 'farm')).toBe('Where do I farm it fastest?')
  expect(askText(t, 'explain', 'Chapter 2')).toContain('Chapter 2')
  expect(askText(t, 'explain')).toBeNull()
  expect(askText(t, 'left')).toContain('platinum')
  expect(askText(t, 'nope')).toBeNull()
  expect(askText(t, null)).toBeNull()
})

test('the questions add to what the screen already says', () => {
  expect(trophyAsks({})).toEqual(['how', 'when'])
  expect(trophyAsks({ advice: true })).toEqual(['faster', 'together'])
  expect(trophyAsks({ advice: true, counter: true, missable: true })).toEqual([
    'farm',
    'together',
    'missable',
  ])
  const { unmount } = renderApp(<TrophyAsks np="NP" trophy="Mestre" advice missable />)
  expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual([
    'Tem jeito mais rápido?',
    'Dá pra fazer junto com outros?',
    'Dá pra perder?',
  ])
  unmount()
})

test('first questions: where to start on a game not begun, what is next on one in progress', () => {
  const { unmount } = renderApp(<FirstAsks np="NP" progress={0} />)
  expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Por onde eu começo?'])
  unmount()
  renderApp(<FirstAsks np="NP" progress={40} />)
  expect(screen.getAllByRole('link')).toHaveLength(3)
})

test('a finished game has no first questions', () => {
  const { container } = renderApp(<FirstAsks np="NP" progress={100} />)
  expect(container.querySelector('.nexo-asks')).toBeNull()
})

test('the guide offer asks about its part', () => {
  renderApp(<ExplainAsk np="NP" part="O porão" />)
  const link = screen.getByRole('link', { name: /Me explica essa parte/ })
  expect(params(link.getAttribute('href')).get('part')).toBe('O porão')
})
