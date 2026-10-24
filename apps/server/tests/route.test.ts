import { expect, test } from 'bun:test'
import {
  collectibleSummary,
  currentMilestone,
  type Milestone,
  reachedMilestone,
  routeNotice,
  stillOpen,
  tipLine,
} from '../src/route.ts'

const milestones: Milestone[] = [
  {
    after: null,
    tips: [{ kind: 'warning', text: 'Jogue no Difícil desde o início.', trophy: null }],
  },
  {
    after: 'Fim do Capítulo 1',
    tips: [{ kind: 'missable', text: 'Leia a carta antes de sair da vila.', trophy: 'Leitor' }],
  },
  { after: 'Fim do Capítulo 2', tips: [{ kind: 'item', text: 'Compre o arco.', trophy: null }] },
]
const guide = { milestones }

test('the opening milestone goes out only when the game starts', () => {
  expect(reachedMilestone(guide, [], true)).toBe(milestones[0])
  expect(reachedMilestone(guide, [], false)).toBeUndefined()
})

test('a story trophy reaches its milestone, whatever the case or spacing', () => {
  expect(reachedMilestone(guide, ['  fim do capítulo 1 '], false)).toBe(milestones[1])
  expect(reachedMilestone(guide, ['Outro troféu'], false)).toBeUndefined()
})

test('several story trophies at once send only the furthest one', () => {
  const unlocked = ['Fim do Capítulo 2', 'Fim do Capítulo 1']
  expect(reachedMilestone(guide, unlocked, false)).toBe(milestones[2])
})

test('guides without milestones send nothing', () => {
  expect(reachedMilestone({}, ['Fim do Capítulo 1'], true)).toBeUndefined()
  expect(reachedMilestone(undefined, [], true)).toBeUndefined()
})

test('the notice names the trophy and marks each tip by kind', () => {
  expect(routeNotice(milestones[1])).toBe(
    'Agora vale saber:\n• ⚠️ **Leitor** é perdível: Leia a carta antes de sair da vila.',
  )
  expect(routeNotice(milestones[0])).toBe('Antes de começar:\n• Jogue no Difícil desde o início.')
})

test('a stretch counts its collectibles by type, in the order they appear', () => {
  const tips = [
    { kind: 'collectible' as const, text: 'Flor 3/5, Genciana: Na praia.', trophy: 'Herbalista' },
    { kind: 'collectible' as const, text: 'Souvenir 5/21, Seda: Na varanda.', trophy: 'Memórias' },
    { kind: 'collectible' as const, text: 'Baú secreto 2/10: Ao fim da escada.', trophy: null },
    { kind: 'collectible' as const, text: 'Souvenir 6/21, Areia: No píer.', trophy: 'Memórias' },
    { kind: 'missable' as const, text: 'Não mate o guarda.', trophy: 'Piedade' },
  ]
  expect(collectibleSummary(tips)).toBe('4 colecionáveis aqui: 1 Flor, 2 Souvenir, 1 Baú secreto.')
  expect(collectibleSummary(tips.slice(0, 1), 'en')).toBe('1 collectible here: 1 Flor.')
  expect(collectibleSummary([tips[4]])).toBe('')
  expect(tipLine({ kind: 'trophy', text: 'Atordoe o guarda.', trophy: 'Piedade' })).toBe(
    '• 🏆 **Piedade**: Atordoe o guarda.',
  )
})

test('a milestone drops the tips about trophies already earned, and is gone when none are left', () => {
  const milestone: Milestone = {
    after: 'Fim do Capítulo 1',
    tips: [
      { kind: 'trophy', text: 'Compre o arco.', trophy: 'Primeira Compra ' },
      { kind: 'item', text: 'Leia a carta.', trophy: null },
    ],
  }
  expect(stillOpen(milestone, ['primeira compra'])?.tips.map((t) => t.text)).toEqual([
    'Leia a carta.',
  ])
  expect(
    stillOpen({ ...milestone, tips: [milestone.tips[0]] }, ['Primeira Compra']),
  ).toBeUndefined()
})

test('the stretch the player is in is the furthest milestone reached, or the opening one', () => {
  expect(currentMilestone(guide, [])).toBe(milestones[0])
  expect(currentMilestone(guide, [' fim do capítulo 1'])).toBe(milestones[1])
  expect(currentMilestone(guide, ['Fim do Capítulo 1', 'Fim do Capítulo 2'])).toBe(milestones[2])
  expect(currentMilestone(undefined, ['Fim do Capítulo 1'])).toBeUndefined()
})
