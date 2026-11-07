import './env.ts'
import { expect, test } from 'bun:test'
import type { GameContext } from '../src/nexo.ts'
import { startNotice } from '../src/notices.ts'
import { makeContext, makeTrophy, makeUser } from './fixtures.ts'

const user = makeUser()
const guide = {
  roadmap: [{ phase: 'Campanha', goal: '', trophies: ['Paus e Pedras', 'Pá, Pum'] }],
} as unknown as GameContext['guide']

test('a plain start notice names the next trophy, even with no trophy earned yet', () => {
  const ctx = makeContext({
    trophies: [
      makeTrophy({ id: 1, name: 'Paus e Pedras', detail: 'Pegue uma arma' }),
      makeTrophy({ id: 2, name: 'Pá, Pum' }),
    ],
    guide,
  })
  const text = startNotice(user, ctx)
  expect(text).toContain('O guia da platina está no PlatJourney.')
  expect(text).toContain('**Sugestão de próximo troféu**')
  expect(text).toContain('**Paus e Pedras**.\nPegue uma arma')
})

test('a plain start notice opens with the trophies the game came with', () => {
  const ctx = makeContext({
    trophies: [
      makeTrophy({ id: 1, name: 'Paus e Pedras', earned: true }),
      makeTrophy({ id: 2, name: 'Pá, Pum', detail: 'Faça 50 tiros na cabeça' }),
      ...Array.from({ length: 10 }, (_, i) => makeTrophy({ id: 10 + i, name: `Extra ${i}` })),
    ],
    guide,
  })
  const text = startNotice(user, ctx, [ctx.trophies[0]])
  expect(text).toStartWith('🏆 **Paus e Pedras**')
  expect(text).toContain('Primeiro troféu de')
  expect(text).not.toContain('Você começou')
  expect(text).toContain('**Pá, Pum**.\nFaça 50 tiros na cabeça')
})
