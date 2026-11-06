import { expect, test } from 'bun:test'
import { screen } from '@testing-library/react'
import {
  askMessages,
  askText,
  ExplainAsk,
  nexoHref,
  TrophyAsks,
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
  expect(askText(t, 'notice')).toContain('last notice')
  expect(askText(t, 'explain', 'Chapter 2')).toContain('Chapter 2')
  expect(askText(t, 'explain')).toBeNull()
  expect(askText(t, 'left')).toContain('platinum')
  expect(askText(t, 'nope')).toBeNull()
  expect(askText(t, null)).toBeNull()
})

test('"can I miss it" shows only for a trophy the guide says can be missed', () => {
  const { unmount } = renderApp(<TrophyAsks np="NP" trophy="Mestre" />)
  expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual([
    'Como pegar?',
    'Quando fazer?',
  ])
  unmount()
  renderApp(<TrophyAsks np="NP" trophy="Mestre" missable />)
  expect(screen.getByRole('link', { name: 'Dá pra perder?' })).toBeTruthy()
})

test('the guide offer asks about its part', () => {
  renderApp(<ExplainAsk np="NP" part="O porão" />)
  const link = screen.getByRole('link', { name: /Me explica essa parte/ })
  expect(params(link.getAttribute('href')).get('part')).toBe('O porão')
})
