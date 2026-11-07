import './env.ts'
import { expect, test } from 'bun:test'
import type { GameContext } from '../src/nexo.ts'
import { ongoingTrophies, openMissables, startLists, startNotice } from '../src/notices.ts'
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

test('a start notice lists what to keep at the whole game, without the next trophy it names', () => {
  const ctx = makeContext({
    trophies: [
      makeTrophy({ id: 1, name: 'Paus e Pedras', earned: true }),
      // A PSN counter: the next trophy, already named above, so not in the list.
      makeTrophy({ id: 2, name: 'Pá, Pum', detail: '50 tiros na cabeça', progressTarget: 50 }),
      makeTrophy({ id: 3, name: 'Colecionador', detail: 'Ache 30 discos', progressTarget: 30 }),
      makeTrophy({ id: 4, name: 'Final', detail: 'Termine o jogo' }),
    ],
    guide,
  })
  expect(ongoingTrophies(ctx).map((t) => t.name)).toEqual(['Colecionador'])
  const text = startNotice(user, ctx, [ctx.trophies[0]])
  expect(text).toEndWith(
    '🔁 **Pra ir fazendo ao longo da jornada**\n• **Colecionador**: Ache 30 discos',
  )
  expect(startLists(user, ctx, [])).toBeUndefined()
})

test('a start notice lists the open missables, without hidden ones or those the checklist names', () => {
  const ctx = makeContext({
    trophies: [
      makeTrophy({ id: 1, name: 'Paus e Pedras', earned: true }),
      makeTrophy({ id: 2, name: 'Pá, Pum' }),
      makeTrophy({ id: 3, name: 'Voo' }),
      makeTrophy({ id: 4, name: 'Segredo', hidden: true }),
      makeTrophy({ id: 5, name: 'Já Foi', earned: true }),
      ...['A', 'B', 'C'].map((n, i) => makeTrophy({ id: 10 + i, name: n })),
    ],
    guide: {
      ...guide,
      missables: [
        { trophy: 'Voo', when: 'na missão 10', how: '' },
        { trophy: 'Segredo', when: 'no fim', how: '' },
        { trophy: 'Já Foi', when: 'no começo', how: '' },
        ...['A', 'B', 'C'].map((n) => ({ trophy: n, when: `antes de ${n}`, how: '' })),
      ],
    } as unknown as GameContext['guide'],
  })
  expect(openMissables(ctx).map((m) => m.trophy)).toEqual(['Voo', 'Segredo', 'A', 'B', 'C'])
  expect(openMissables(ctx, '• **Voo** na fábrica').map((m) => m.trophy)).not.toContain('Voo')
  // The hidden one is only counted, with the ones past the first three; Voo is not listed twice.
  expect(startLists(user, ctx, [ctx.trophies[2], ctx.trophies[1]])).toBe(
    '⚠️ **Perdíveis: fique de olho**\n• **Voo**: na missão 10\n• **A**: antes de A\n• **B**: antes de B\nE mais 2 no guia.\n\n🔁 **Pra ir fazendo ao longo da jornada**\n• **Pá, Pum**: ' +
      ctx.trophies[1].detail,
  )
})
