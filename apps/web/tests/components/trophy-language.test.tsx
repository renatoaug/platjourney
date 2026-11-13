import { afterEach, expect, mock, test } from 'bun:test'
import { screen } from '@testing-library/react'
import { AnswerTrophy } from '../../src/components/chat/answer-cards'
import { NextTrophy } from '../../src/components/next-trophy'
import { TrophyRoadmap } from '../../src/components/trophy-roadmap'
import { routeGame } from '../../src/fixtures/route'
import { setLocale } from '../../src/i18n/i18n'
import type { Trophy } from '../../src/lib/types'
import { mockApi, renderApp } from '../support/web'

// Every trophy of the route, with an English name and description as PSN sends them.
const english = (t: Trophy): Trophy => ({
  ...t,
  nameEn: `${t.name} (EN)`,
  detailEn: `${t.detail} (EN)`,
})

afterEach(() => {
  mock.restore()
  setLocale('pt-BR', { persist: false })
})

test('the journey names its trophies in English for a player reading English', () => {
  setLocale('en', { persist: false })
  const game = routeGame(['Primeiro Passo'])
  const trophies = game.trophies.map(english)
  const { container } = renderApp(
    <TrophyRoadmap game={{ ...game, trophies, focus: game.focus && { ...game.focus } }} />,
  )
  const names = [...container.querySelectorAll('.roadmap-route-name')].map((x) => x.textContent)
  expect(names.length).toBeGreaterThan(0)
  for (const name of names) expect(name).toMatch(/\(EN\)$|^Secret|^Segredo/)
  expect(container.querySelector('.roadmap-destination h3')?.textContent).toEndWith('(EN)')
  // Not even the chapter headings, which the guide writes with the pt-BR name.
  expect(container.textContent).not.toMatch(/(Primeiro Passo|Segundo Ato)(?! \(EN\))/)
})

test('the next trophy card and a chat answer’s trophy card read English too', () => {
  setLocale('en', { persist: false })
  mockApi({ '/api/plan': { plan: null } })
  const trophy = {
    id: 2,
    name: 'Marcando o gol',
    nameEn: 'Scoring',
    detail: 'Vença uma corrida',
    detailEn: 'Win a race',
    type: 'bronze',
    earned: false,
    earnedRate: 40,
    groupId: 'default',
  } as Trophy
  renderApp(
    <>
      <NextTrophy trophies={[trophy]} game="game:1" />
      <AnswerTrophy trophy={{ ...trophy, rarity: 40 }} />
    </>,
  )
  expect(screen.getAllByText('Scoring')).toHaveLength(2)
  expect(screen.getAllByText('Win a race')).toHaveLength(2)
  expect(screen.queryByText('Marcando o gol')).toBeNull()
})
