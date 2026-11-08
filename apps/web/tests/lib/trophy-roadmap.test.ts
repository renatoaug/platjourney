import { describe, expect, test } from 'bun:test'
import { current } from '../../src/fixtures'
import {
  ongoingObjectives,
  personalRoadmap,
  trophyAdvice,
  trophyMentions,
  trophyRoadmap,
} from '../../src/lib/trophy-roadmap'
import type { GuideDetail, Trophy } from '../../src/lib/types'

const trophy = (id: number, name: string, extra: Partial<Trophy> = {}): Trophy => ({
  id,
  name,
  detail: 'Objective',
  groupId: 'default',
  type: 'bronze',
  earned: false,
  ...extra,
})
const guide = (roadmap: GuideDetail['roadmap']): GuideDetail => ({
  ...(current.guide as GuideDetail),
  roadmap,
})

test('each trophy appears once, matches translated names, and earned state never changes order', () => {
  const items = [
    trophy(0, 'Platina', { type: 'platinum' }),
    trophy(1, 'Início', { nameEn: 'Start', earned: true }),
    trophy(2, 'Final'),
    trophy(3, 'Extra', { groupId: '001' }),
  ]
  const result = trophyRoadmap(
    items,
    guide([
      { phase: 'First', goal: '', trophies: ['Start', 'Final'] },
      { phase: 'Cleanup', goal: '', trophies: ['inicio', 'Missing title'] },
    ]),
  )
  expect(result.map((s) => s.kind)).toEqual(['phase', 'platinum', 'dlc'])
  expect(result.flatMap((s) => s.trophies.map((x) => x.id))).toEqual([1, 2, 0, 3])
  expect(items[1].earned).toBe(true)
})

test('missing guide and ambiguous names stay unplaced without dropping trophies or inventing platinum', () => {
  const items = [trophy(1, 'Same'), trophy(2, 'Same'), trophy(3, 'Unknown')]
  expect(trophyRoadmap(items).map((s) => s.kind)).toEqual(['unplaced'])
  const result = trophyRoadmap(items, guide([{ phase: 'A', goal: '', trophies: ['Same'] }]))
  expect(result).toEqual([{ kind: 'unplaced', trophies: items }])
  expect(trophyRoadmap([], null)).toEqual([])
})

test('advice only uses an exact localized match and keeps absent advice absent', () => {
  const g = guide([])
  g.tricks = [{ trophy: 'Start', trick: 'Actual guide tip' }]
  g.missables = [{ trophy: 'Início', how: 'Do this', when: 'Before leaving' }]
  expect(trophyAdvice(trophy(1, 'Início', { nameEn: 'Start' }), g).trick).toBe('Actual guide tip')
  expect(trophyAdvice(trophy(1, 'Início'), g).warning?.how).toBe('Do this')
  expect(trophyAdvice(trophy(1, 'Start again'), g).trick).toBeUndefined()
})

test('ongoing objectives require explicit evidence and preserve unknown progress', () => {
  const items = [
    trophy(1, 'Stealth'),
    trophy(2, 'Collect'),
    trophy(3, 'Count', { progressTarget: 10, progressValue: 0 }),
    trophy(4, 'Ordinary'),
  ]
  const g = guide([
    { phase: 'A', goal: '', trophies: ['Collect'] },
    { phase: 'B', goal: '', trophies: ['Collect'] },
  ])
  g.missables = [
    { trophy: 'Stealth', when: 'Durante a campanha e New Game+.', how: 'Keep the habit.' },
    { trophy: 'Ordinary', when: 'Before chapter 2.', how: 'One event.' },
  ]
  expect(ongoingObjectives(items, g).map((x) => [x.trophy.id, x.basis])).toEqual([
    [1, 'duration'],
    [2, 'repeated'],
    [3, 'counter'],
  ])
  expect(ongoingObjectives(items, g)[0]?.trophy.progressValue).toBeUndefined()
  expect(
    ongoingObjectives(
      items.map((t) => ({ ...t, earned: true })),
      g,
    ),
  ).toEqual([])
  expect(
    ongoingObjectives(
      items.map((t) => ({ ...t, hidden: true })),
      g,
    ),
  ).toEqual([])
  expect(
    ongoingObjectives(
      items.map((t) => ({ ...t, groupId: '001' })),
      g,
    ),
  ).toEqual([])
  expect(ongoingObjectives(items, null).map((x) => x.trophy.id)).toEqual([3])
  expect(items.every((t) => !t.earned)).toBe(true)
})

test('with kinds, only what keeps going stays: grinds, and hunts that are counted or last the campaign', () => {
  const items = [
    trophy(1, 'Flight'),
    trophy(2, 'Weapons', { progressTarget: 11, progressValue: 3 }),
    trophy(3, 'Headshots'),
    trophy(4, 'Soldier', { progressTarget: 100, progressValue: 10 }),
    trophy(5, 'Stealth'),
  ]
  const g = guide([
    { phase: 'A', goal: '', trophies: ['Flight', 'Weapons', 'Soldier'] },
    { phase: 'B', goal: '', trophies: ['Flight', 'Weapons', 'Soldier'] },
  ])
  g.missables = [{ trophy: 'Stealth', when: 'Durante a campanha.', how: 'Keep the habit.' }]
  g.trophyKinds = [
    { trophy: 'Flight', kind: 'hunt' },
    { trophy: 'Weapons', kind: 'hunt' },
    { trophy: 'Headshots', kind: 'grind' },
    { trophy: 'Soldier', kind: 'natural' },
    { trophy: 'Stealth', kind: 'hunt' },
  ]
  expect(ongoingObjectives(items, g).map((x) => [x.trophy.name, x.basis])).toEqual([
    ['Weapons', 'repeated'],
    ['Headshots', 'long'],
    ['Stealth', 'duration'],
  ])
})

test('ambiguous matches and incidental campaign text do not create ongoing objectives', () => {
  const g = guide([{ phase: 'A', goal: '', trophies: ['Same', 'Same'] }])
  g.missables = [
    { trophy: 'Same', when: 'Durante a campanha.', how: 'Tip' },
    { trophy: 'Other', when: 'Não é necessário durante a campanha.', how: 'Tip' },
  ]
  expect(ongoingObjectives([trophy(1, 'Same'), trophy(2, 'Same'), trophy(3, 'Other')], g)).toEqual(
    [],
  )
})

test('start guidance links explicit unique trophy names without matching parts of other names', () => {
  const g = {
    ...guide([]),
    earlyTips: [
      'Aceite contratos enquanto explora para adiantar **Contratos em dia**.',
      'Explore every island for Island Explorer.',
      'A generic exploration tip without a trophy name.',
    ],
    missables: [],
  }
  const items = [
    trophy(1, 'Contratos em dia'),
    trophy(2, 'Ilhas', { nameEn: 'Island Explorer' }),
    trophy(3, 'Dia'),
    trophy(4, 'Contratos em dias extras'),
  ]
  const result = ongoingObjectives(items, g)
  expect(result.map((entry) => [entry.trophy.id, entry.basis])).toEqual([
    [1, 'early'],
    [2, 'early'],
  ])
  expect(result[0].early).toBe(g.earlyTips[0])
  expect(ongoingObjectives([items[0], { ...items[0], id: 9 }], g)).toEqual([])
})

test('personal route separates confirmed dates, undated history, pending work in guide order and DLC', () => {
  const a = trophy(1, 'Later achievement', { earned: true, earnedAt: '2024-01-03T12:00:00Z' })
  const b = trophy(9, 'Earlier achievement', { earned: true, earnedAt: '2024-01-02T12:00:00Z' })
  const unknown = trophy(2, 'Undated', { earned: true })
  const next = trophy(5, 'Next')
  const future = trophy(4, 'Future')
  const extra = trophy(1, 'Extra', {
    earned: true,
    groupId: '001',
    earnedAt: '2024-01-01T12:00:00Z',
  })
  const source = [a, future, unknown, b, next, extra]
  const before = structuredClone(source)
  expect(personalRoadmap(source)).toEqual([b, a, unknown, future, next, extra])
  expect(source).toEqual(before)
  const preview = source.map((t) => ({ ...t, earned: false, earnedAt: undefined }))
  expect(personalRoadmap(preview)).toEqual(preview)
})

describe('trophyMentions', () => {
  const trophy = (name: string, extra: Partial<Trophy> = {}) =>
    ({
      id: name.length,
      groupId: 'default',
      name,
      earned: false,
      type: 'bronze',
      ...extra,
    }) as Trophy
  const guideWith = (goal: string, more: Partial<GuideDetail> = {}) =>
    ({ roadmap: [{ phase: 'Fase 1', goal, trophies: [] }], earlyTips: [], ...more }) as GuideDetail

  test('takes the numbered step that names the trophy, without its number', () => {
    const a = trophy('Vantagens do trabalho')
    const goal = '1. Termine a história.\n2. Alterne armas. Isso adianta **Vantagens do trabalho**.'
    expect(trophyMentions(a, [a], guideWith(goal))).toEqual([
      'Alterne armas. Isso adianta **Vantagens do trabalho**.',
    ])
  })

  test('keeps the sentence a pointing sentence leans on', () => {
    const a = trophy('Rato de biblioteca')
    const goal = 'Leia todos os diários. Isso libera **Rato de biblioteca**. Depois volte ao hotel.'
    expect(trophyMentions(a, [a], guideWith(goal))).toEqual([
      'Leia todos os diários. Isso libera **Rato de biblioteca**.',
    ])
  })

  test('a one-word name counts only in bold, a longer one also in plain text', () => {
    const one = trophy('Piedade')
    const two = trophy('Rato de biblioteca')
    const goal = 'Tenha piedade dos guardas.\nProcure o rato de biblioteca no porão.'
    expect(trophyMentions(one, [one, two], guideWith(goal))).toEqual([])
    expect(trophyMentions(two, [one, two], guideWith(goal))).toEqual([
      'Procure o rato de biblioteca no porão.',
    ])
  })

  test('a step that names another trophy stays in the phase plan, hidden or not', () => {
    const a = trophy('Aberto')
    const goal = 'Isso libera **Aberto** e **Segredo**.'
    expect(trophyMentions(a, [a, trophy('Segredo', { hidden: true })], guideWith(goal))).toEqual([])
    expect(trophyMentions(a, [a, trophy('Segredo')], guideWith(goal))).toEqual([])
    expect(trophyMentions(a, [a], guideWith(goal))).toEqual([goal])
  })

  test('reads early tips, collectibles and general route tips, at most three, once each', () => {
    const a = trophy('Aberto')
    const step = (n: number) => `Passo ${n} de **Aberto**.`
    const guide = guideWith(step(1), {
      earlyTips: [step(2), step(1)],
      collectibles: step(3),
      milestones: [{ after: null, tips: [{ kind: 'item', trophy: null, text: step(4) }] }],
    })
    expect(trophyMentions(a, [a], guide)).toEqual([step(1), step(2), step(3)])
  })

  test('a name two trophies share is not attributed to either', () => {
    const a = trophy('Igual')
    const b = { ...trophy('Igual'), id: 99 }
    expect(trophyMentions(a, [a, b], guideWith('Isso libera **Igual**.'))).toEqual([])
  })
})

test('the platinum closes the route, even earned at the same moment as the last trophy', () => {
  const at = '2026-01-01T10:00:00Z'
  const route = personalRoadmap([
    trophy(0, 'Platina', { type: 'platinum', earned: true, earnedAt: at }),
    trophy(1, 'Primeiro', { earned: true, earnedAt: '2025-12-01T10:00:00Z' }),
    trophy(2, 'Último', { earned: true, earnedAt: at }),
  ])
  expect(route.map((t) => t.name)).toEqual(['Primeiro', 'Último', 'Platina'])
  const pending = personalRoadmap([trophy(0, 'Platina', { type: 'platinum' }), trophy(1, 'Falta')])
  expect(pending.map((t) => t.name)).toEqual(['Falta', 'Platina'])
})

test('with places in the guide, what is left follows where each trophy should fall', () => {
  const memory = trophy(1, 'Memória', { earned: true, earnedAt: '2026-01-01T10:00:00Z' })
  const finisher = trophy(2, 'Golpe Final', { progressValue: 0, progressTarget: 50 })
  const safe = trophy(3, 'Príncipe')
  const coffee = trophy(4, 'Café')
  const placed = {
    storyline: { unit: 'Missão', total: 35 },
    trophyPlaces: [
      { trophy: 'Memória', from: 12 },
      { trophy: 'Golpe Final', from: 12, to: 30 },
      { trophy: 'Príncipe', from: 13 },
      { trophy: 'Café', from: 16 },
    ],
  } as unknown as GuideDetail
  const route = personalRoadmap([memory, finisher, safe, coffee], placed)
  expect(route.map((t) => t.name)).toEqual(['Memória', 'Príncipe', 'Café', 'Golpe Final'])
  // Without places, the roadmap's order.
  expect(personalRoadmap([memory, finisher, safe, coffee]).map((t) => t.name)).toEqual([
    'Memória',
    'Golpe Final',
    'Príncipe',
    'Café',
  ])
})
