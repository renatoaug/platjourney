import { describe, expect, test } from 'bun:test'
import {
  type GraphGuide,
  type GraphTrophy,
  keyStep,
  trophyNeeds,
} from '../../../shared/journey/graph.ts'

const trophy = (name: string, earned = false): GraphTrophy => ({
  name,
  earned,
  groupId: 'default',
})

// Cyberpunk 2077's endings, as its guide describes them.
const guide: GraphGuide = {
  trophyGraph: {
    nodes: [
      { id: 'chippin', label: "Chippin' In (amigável)" },
      { id: 'desire', label: 'Amor Ardente' },
      { id: 'rogue', label: 'rota da Rogue' },
      { id: 'storm', label: 'Cavaleiros na Tempestade' },
      { id: 'panam', label: 'linha da Panam' },
      { id: 'nocturne', label: 'Nocturne Op55N1' },
      { id: 'sun', label: 'O Sol', trophy: 'O Sol' },
      { id: 'bushido', label: 'Bushido a dois', trophy: 'Bushido a dois' },
      { id: 'road', label: 'Vida na estrada', trophy: 'Vida na estrada' },
      { id: 'star', label: 'A Estrela', trophy: 'A Estrela' },
      { id: 'temp', label: 'Temperança', trophy: 'Temperança' },
    ],
    edges: [
      { from: 'chippin', to: 'desire', kind: 'unlocks' },
      { from: 'desire', to: 'rogue', kind: 'unlocks' },
      { from: 'rogue', to: 'sun', kind: 'unlocks' },
      { from: 'chippin', to: 'bushido', kind: 'unlocks' },
      { from: 'storm', to: 'road', kind: 'unlocks' },
      { from: 'storm', to: 'panam', kind: 'unlocks' },
      { from: 'panam', to: 'star', kind: 'unlocks' },
      { from: 'panam', to: 'temp', kind: 'anyOf' },
      { from: 'rogue', to: 'temp', kind: 'anyOf' },
      { from: 'nocturne', to: 'sun', kind: 'closes' },
      { from: 'nocturne', to: 'star', kind: 'closes' },
      { from: 'nocturne', to: 'temp', kind: 'closes' },
    ],
  },
}

const NAMES = ['O Sol', 'Bushido a dois', 'Vida na estrada', 'A Estrela', 'Temperança', 'O Diabo']
const game = (...earned: string[]) => NAMES.map((n) => trophy(n, earned.includes(n)))
const find = (list: GraphTrophy[], name: string) => list.find((t) => t.name === name) as GraphTrophy

describe('trophy dependencies from the guide', () => {
  test('a trophy lists the steps before it, nearest the start first, and where it closes', () => {
    const list = game()
    expect(trophyNeeds(find(list, 'O Sol'), list, guide)).toEqual({
      steps: [["Chippin' In (amigável)"], ['Amor Ardente'], ['rota da Rogue']],
      closesAt: 'Nocturne Op55N1',
    })
    // One of two lines is enough: both are offered together.
    expect(trophyNeeds(find(list, 'Temperança'), list, guide)?.steps).toEqual([
      ['linha da Panam', 'rota da Rogue'],
    ])
  })

  test('an earned trophy marks the steps it needed as done', () => {
    // Bushido a dois came from the friendly choice: what is left for O Sol starts after it.
    const list = game('Bushido a dois')
    expect(trophyNeeds(find(list, 'O Sol'), list, guide)?.steps).toEqual([
      ['Amor Ardente'],
      ['rota da Rogue'],
    ])
    // A Estrela needed Panam's line, so Temperança has nothing left before it.
    const star = game('A Estrela')
    expect(trophyNeeds(find(star, 'Temperança'), star, guide)).toEqual({
      steps: [],
      closesAt: 'Nocturne Op55N1',
    })
  })

  test('once the point that closes it has passed, an open trophy is lost in this save', () => {
    // Earning O Sol means Nocturne was played: A Estrela, still open, cannot come anymore.
    const graph = guide.trophyGraph as NonNullable<GraphGuide['trophyGraph']>
    const after: GraphGuide = {
      trophyGraph: {
        nodes: [...graph.nodes, { id: 'end', label: 'Final', trophy: 'O Diabo' }],
        edges: [...graph.edges, { from: 'nocturne', to: 'end', kind: 'unlocks' }],
      },
    }
    const list = game('O Diabo')
    expect(trophyNeeds(find(list, 'A Estrela'), list, after)).toEqual({
      steps: [],
      lost: 'Nocturne Op55N1',
    })
  })

  test('the key step is the one that opens the most open trophies, aimed at the nearest', () => {
    const list = game()
    // Chippin' In leads to Bushido a dois, O Sol and Temperança; Cavaleiros ties and comes later.
    expect(keyStep(list, guide)).toMatchObject({
      step: "Chippin' In (amigável)",
      opens: 3,
      trophy: { name: 'Bushido a dois' },
    })
    // With Bushido a dois earned, Chippin' In is done: Cavaleiros opens three.
    const next = keyStep(game('Bushido a dois'), guide)
    expect(next).toMatchObject({
      step: 'Cavaleiros na Tempestade',
      trophy: { name: 'Vida na estrada' },
    })
  })

  test('a guide without a usable graph says nothing', () => {
    const list = game()
    expect(trophyNeeds(list[0], list, {})).toBeUndefined()
    expect(keyStep(list, null)).toBeUndefined()
    const graph = guide.trophyGraph as NonNullable<GraphGuide['trophyGraph']>
    const broken = {
      trophyGraph: { ...graph, edges: [{ from: 'x', to: 'sun', kind: 'unlocks' as const }] },
    }
    expect(trophyNeeds(list[0], list, broken)).toBeUndefined()
    // A trophy the graph does not name, and an earned one, have no needs.
    expect(trophyNeeds(find(list, 'O Diabo'), list, guide)).toBeUndefined()
    const won = game('O Sol')
    expect(trophyNeeds(find(won, 'O Sol'), won, guide)).toBeUndefined()
  })
})
