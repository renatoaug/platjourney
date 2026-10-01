import { expect, test } from 'bun:test'
import { type Milestone, reachedMilestone, routeNotice, stillOpen } from '../src/route.ts'

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
    'Agora vale saber:\n• Leia a carta antes de sair da vila.',
  )
  expect(routeNotice(milestones[0])).toBe('Antes de começar:\n• Jogue no Difícil desde o início.')
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
