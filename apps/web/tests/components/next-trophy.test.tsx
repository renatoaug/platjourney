import { afterEach, expect, mock, test } from 'bun:test'
import { screen } from '@testing-library/react'
import { NextTrophy } from '../../src/components/next-trophy'
import type { GuideDetail, Trophy } from '../../src/lib/types'
import { mockApi, renderApp } from '../support/web'

afterEach(() => mock.restore())

const trophy = (id: number, name: string, earned: boolean, earnedRate = 50) =>
  ({
    id,
    name,
    type: 'bronze',
    earned,
    earnedRate,
    groupId: 'default',
    detail: `${name} detail`,
  }) as Trophy
const trophies = [
  trophy(1, 'Primeiro', true),
  trophy(2, 'Segundo', false, 10),
  trophy(3, 'Terceiro', false, 80),
  trophy(4, 'Lenda', false),
]
trophies[3].type = 'platinum'
const guide = {
  roadmap: [
    { phase: 'Campanha', goal: '', trophies: ['Primeiro', 'Segundo'] },
    { phase: 'Limpeza', goal: '', trophies: ['Terceiro'] },
  ],
} as unknown as GuideDetail
const card = () => screen.getByRole('complementary', { name: 'Próximo troféu' })

test('today’s route comes first, with its time', async () => {
  mockApi({
    '/api/plan': {
      plan: {
        game: 'game:1',
        status: 'active',
        steps: [{ trophy: 'Terceiro', minutes: 45, done: false }],
      },
    },
  })
  renderApp(<NextTrophy trophies={trophies} guide={guide} game="game:1" />)
  expect(await screen.findByText('Terceiro')).toBeTruthy()
  expect(card().textContent).toContain('no roteiro de hoje')
  expect(card().textContent).toContain('45 min')
})

test('without a plan, the phase of the guide the player is in', () => {
  mockApi({ '/api/plan': { plan: null } })
  renderApp(<NextTrophy trophies={trophies} guide={guide} game="game:1" />)
  expect(card().textContent).toContain('Segundo')
  expect(card().textContent).toContain('10% dos jogadores têm')
})

test('without a guide, the most common trophy still missing; never the platinum', () => {
  mockApi({ '/api/plan': { plan: null } })
  renderApp(<NextTrophy trophies={trophies} game="game:1" />)
  expect(card().textContent).toContain('Terceiro')
})

test('DLC trophies are never pushed, and with the platinum earned nothing is', () => {
  mockApi({ '/api/plan': { plan: null } })
  const dlc = { ...trophy(5, 'Extra', false, 99), groupId: '001' }
  const first = renderApp(<NextTrophy trophies={[...trophies, dlc]} game="game:1" />)
  expect(card().textContent).toContain('Terceiro')
  first.unmount()
  const platinum = trophies.map((t) => (t.type === 'platinum' ? { ...t, earned: true } : t))
  const { container } = renderApp(<NextTrophy trophies={platinum} game="game:1" />)
  expect(container.querySelector('.next-trophy')).toBeNull()
})

test('with every trophy earned there is nothing to go for', () => {
  mockApi({ '/api/plan': { plan: null } })
  const { container } = renderApp(
    <NextTrophy trophies={trophies.map((t) => ({ ...t, earned: true }))} game="game:1" />,
  )
  expect(container.querySelector('.next-trophy')).toBeNull()
})

test('with nothing left to push, what the page gives stands in its place', () => {
  mockApi({ '/api/plan': { plan: null } })
  const platinum = trophies.map((t) => (t.type === 'platinum' ? { ...t, earned: true } : t))
  renderApp(<NextTrophy trophies={platinum} game="game:1" fallback={<p>ficha do jogo</p>} />)
  expect(screen.getByText('ficha do jogo')).toBeTruthy()
})
