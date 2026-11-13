import './env.ts'
import { expect, test } from 'bun:test'
import { todaysFocus } from '../src/focus.ts'
import type { GameContext } from '../src/nexo.ts'
import {
  focusNotice,
  markNotice,
  ongoingTrophies,
  openMissables,
  sessionNotice,
  startLists,
  startNotice,
  unlockNotice,
} from '../src/notices.ts'
import { makeContext, makeGame, makeTrophy, makeUser } from './fixtures.ts'

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
  expect(openMissables(ctx).map((m) => m.trophy.name)).toEqual(['Voo', 'Segredo', 'A', 'B', 'C'])
  expect(openMissables(ctx, '• **Voo** na fábrica').map((m) => m.trophy.name)).not.toContain('Voo')
  // The hidden one is only counted, with the ones past the first three; Voo is not listed twice.
  expect(startLists(user, ctx, [ctx.trophies[2], ctx.trophies[1]])).toBe(
    '⚠️ **Perdíveis: fique de olho**\n• **Voo**: na missão 10\n• **A**: antes de A\n• **B**: antes de B\nE mais 2 no guia.\n\n🔁 **Pra ir fazendo ao longo da jornada**\n• **Pá, Pum**: ' +
      ctx.trophies[1].detail,
  )
})

// A game whose guide is written in pt-BR, as every guide is, for a player of either language.
const bilingual = () =>
  makeContext({
    trophies: [
      makeTrophy({
        id: 1,
        name: 'Marcando o gol',
        nameEn: 'Scoring',
        detail: 'Vença uma corrida',
        detailEn: 'Win a race',
      }),
      makeTrophy({
        id: 2,
        name: 'Coisa de gangue',
        nameEn: 'Gang Business',
        detail: 'Domine os territórios',
        detailEn: 'Take over the territories',
      }),
      makeTrophy({
        id: 3,
        name: 'Cego',
        nameEn: 'Blind',
        detail: 'Não seja visto',
        detailEn: 'Stay unseen',
      }),
    ],
    guide: {
      roadmap: [
        { phase: 'Fase 1', goal: '', trophies: ['Marcando o gol', 'Coisa de gangue', 'Cego'] },
      ],
      missables: [{ trophy: 'Cego', when: 'antes da missão 3', how: '' }],
      tricks: [{ trophy: 'Cego', trick: 'Use o atalho do parque.' }],
      milestones: [
        {
          after: null,
          tips: [
            { kind: 'trophy', text: 'Corra na pista do porto.', trophy: 'Marcando o gol' },
            { kind: 'item', text: 'Pegue o colete na garagem.', trophy: null },
          ],
        },
      ],
    } as unknown as GameContext['guide'],
  })

test('a notice in English names trophies in English and pastes none of the pt-BR guide', () => {
  // GTA San Andreas: an English frame around Portuguese trophy names and guide text.
  const en = makeUser({ locale: 'en' })
  const text = sessionNotice(en, 'GTA', bilingual())
  expect(text).toContain('**Blind**.\nStay unseen')
  expect(text).toContain('**Scoring**')
  expect(text).toContain('Win a race')
  expect(text).toContain('⚠️ **Blind** is missable.')
  expect(text).toContain('📍 **Where you are in the game**')
  for (const pt of ['Marcando', 'Vença', 'Corra', 'atalho', 'colete', 'antes da missão'])
    expect(text).not.toContain(pt)
  const start = startNotice(en, bilingual())
  expect(start).toContain('• **Blind**: Stay unseen')
  expect(start).not.toContain('Cego')
  expect(unlockNotice(en, bilingual(), [bilingual().trophies[1]])).toContain('**Gang Business**')
  // In Portuguese the same notice keeps the guide's words.
  const pt = sessionNotice(user, 'GTA', bilingual())
  expect(pt).toContain('**Marcando o gol**')
  expect(pt).toContain('**Dica**: Use o atalho do parque.')
  expect(pt).toContain('⚠️ **Cego** é perdível: antes da missão 3')
  expect(pt).toContain('Corra na pista do porto.')
})

test('the next trophy is never an ending a graph calls ready before the roadmap gets there', () => {
  // Elden Ring: the graph puts nothing before the last boss, so its step to two endings looked
  // ready to a player who had just started, and the start notice suggested Lorde Prístino.
  const ctx = makeContext({
    trophies: [
      makeTrophy({ id: 1, name: 'Mesa-Redonda', detail: 'Chegue à Mesa-Redonda' }),
      makeTrophy({ id: 2, name: 'Margit' }),
      makeTrophy({ id: 3, name: 'Lorde Prístino', detail: 'Derrote a Fera Prístina' }),
      makeTrophy({ id: 4, name: 'Era das Estrelas' }),
    ],
    guide: {
      roadmap: [
        { phase: 'Fase 1', goal: '', trophies: ['Mesa-Redonda', 'Margit'] },
        { phase: 'Fase 6', goal: '', trophies: ['Lorde Prístino', 'Era das Estrelas'] },
      ],
      trophyGraph: {
        nodes: [
          { id: 'radagon', label: 'Radagon e Elden Beast' },
          { id: 'lord', label: 'Lorde Prístino', trophy: 'Lorde Prístino' },
          { id: 'stars', label: 'Era das Estrelas', trophy: 'Era das Estrelas' },
        ],
        edges: [
          { from: 'radagon', to: 'lord', kind: 'unlocks' },
          { from: 'radagon', to: 'stars', kind: 'unlocks' },
        ],
      },
    } as unknown as GameContext['guide'],
  })
  // The journey's suggestion and the start notice's are the same: the roadmap's first.
  expect(todaysFocus(ctx).trophy?.name).toBe('Mesa-Redonda')
  expect(startNotice(user, ctx)).toContain('**Mesa-Redonda**.\nChegue à Mesa-Redonda')
  expect(startNotice(user, ctx)).not.toContain('Lorde Prístino')
})

test('an unlock that closes two phases names both', () => {
  // Amnesia: "Fechou a Fase 1" and minutes later "Fechou a Fase 3", Fase 2 never named.
  const trophies = [
    makeTrophy({ id: 1, name: 'A', earned: true }),
    makeTrophy({ id: 2, name: 'B', earned: true }),
    makeTrophy({ id: 3, name: 'C' }),
  ]
  const ctx = makeContext({
    trophies,
    guide: {
      roadmap: [
        { phase: 'Fase 1 — Início', goal: '', trophies: ['A'] },
        { phase: 'Fase 2 — Meio', goal: '', trophies: ['A', 'B'] },
        { phase: 'Fase 3 — Fim', goal: '', trophies: ['C'] },
      ],
    } as unknown as GameContext['guide'],
  })
  expect(focusNotice(user, ctx, [trophies[0], trophies[1]])).toStartWith(
    '🎉 Fechou Fase 1 e Fase 2 do roteiro!',
  )
  expect(focusNotice(user, ctx, [trophies[1]])).toStartWith('🎉 Fechou a Fase 2 do roteiro!')
})

test('the halfway line does not repeat what the cheer before it says', () => {
  // Amnesia: "Metade do jogo base fechada. Que ritmo! Metade do jogo base: 11 de 21 troféus."
  const trophies = [
    makeTrophy({ id: 1, name: 'A', earned: true }),
    makeTrophy({ id: 2, name: 'B', earned: true }),
    makeTrophy({ id: 3, name: 'C' }),
    makeTrophy({ id: 4, name: 'D' }),
  ]
  const text = markNotice(user, makeContext({ trophies }), [trophies[1]]) ?? ''
  expect(text).toEndWith(' 2 de 4 troféus do jogo base.')
  expect(text.match(/metade do jogo base/gi)?.length ?? 0).toBeLessThan(2)
})

test('several trophies at once name their game once', () => {
  // Goals: eight lines, each ending in "em **Goals**".
  const ctx = makeContext({ game: makeGame({ name: 'Goals' }) })
  const got = Array.from({ length: 8 }, (_, i) => makeTrophy({ id: i + 1, name: `T${i}` }))
  const text = unlockNotice(user, ctx, got)
  expect(text.split('\n')[0]).toBe('8 troféus em **Goals**:')
  expect(text.match(/Goals/g)).toHaveLength(1)
  expect(unlockNotice(user, ctx, [got[0]])).toEndWith('em **Goals**')
})
