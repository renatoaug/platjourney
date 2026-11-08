import { describe, expect, test } from 'bun:test'
import {
  expectedStep,
  nextPlaced,
  type PlacedGuide,
  type PlacedTrophy,
  placedOrder,
  playerStep,
} from '../../../shared/journey/places.ts'

const trophy = (name: string, extra: Partial<PlacedTrophy> = {}): PlacedTrophy => ({
  name,
  earned: false,
  type: 'bronze',
  groupId: 'default',
  ...extra,
})

// A campaign of 35 missions, as MindsEye's.
const guide: PlacedGuide = {
  storyline: { unit: 'mission', total: 35 },
  trophyPlaces: [
    { trophy: 'Voo', from: 10 },
    { trophy: 'Memória', from: 12 },
    { trophy: 'Golpe Final', from: 12, to: 30 },
    { trophy: 'Príncipe', from: 13 },
    { trophy: 'Café', from: 16 },
    { trophy: 'Paus e Pedras', from: 3, to: 33 },
    { trophy: 'Sacrifício', from: 35 },
  ],
  trophyKinds: [{ trophy: 'Paus e Pedras', kind: 'grind' }],
}

function game(golpe: Partial<PlacedTrophy> = {}) {
  const list = [
    trophy('Voo', { earned: true }),
    trophy('Memória', { earned: true }),
    trophy('Golpe Final', { progressTarget: 50, progressValue: 0, ...golpe }),
    trophy('Príncipe'),
    trophy('Café'),
    trophy('Paus e Pedras'),
    trophy('Sacrifício'),
  ]
  return { list, open: list.filter((t) => !t.earned) }
}

const names = (ts: PlacedTrophy[]) => ts.map((t) => t.name)

describe('trophies placed along the game', () => {
  test('the player is where the furthest earned trophy of a single moment unlocks', () => {
    const { list } = game()
    expect(playerStep(list, guide)).toBe(12)
    // A count that closed says nothing about where the player is.
    list[2] = { ...list[2], earned: true }
    expect(playerStep(list, guide)).toBe(12)
    expect(
      playerStep(
        list.map((t) => ({ ...t, earned: false })),
        guide,
      ),
    ).toBeUndefined()
  })

  test('a count sits where it should close: the guide end, or its pace so far', () => {
    const { list, open } = game()
    // No progress yet: the end of its range.
    expect(expectedStep(open[0], list, guide, 12)).toBe(30)
    // 10 of 50 in the first mission with the drone, 10 a mission: 4 more missions.
    const fast = game({ progressValue: 10 })
    expect(expectedStep(fast.open[0], fast.list, guide, 12)).toBe(16)
    // Too slow to close in the story: after it, on mission select.
    const slow = game({ progressValue: 1 })
    expect(expectedStep(slow.open[0], slow.list, guide, 14)).toBe(36)
    // A collection with no counter: the end of its range.
    expect(expectedStep(open[3], list, guide, 12)).toBe(33)
    // A trophy of a single moment: where it unlocks.
    expect(expectedStep(open[1], list, guide, 12)).toBe(13)
  })

  test('what is left goes in the order it should fall, and the next is the nearest ahead', () => {
    const { list, open } = game()
    expect(names(placedOrder(open, list, guide))).toEqual([
      'Príncipe',
      'Café',
      'Golpe Final',
      'Paus e Pedras',
      'Sacrifício',
    ])
    expect(nextPlaced(open, list, guide)?.name).toBe('Príncipe')
    // A count at a quick pace comes before the story trophies further ahead.
    const fast = game({ progressValue: 10 })
    expect(names(placedOrder(fast.open, fast.list, guide)).slice(0, 3)).toEqual([
      'Príncipe',
      'Café',
      'Golpe Final',
    ])
  })

  test('something left behind stays on the map, and the next is still ahead of the player', () => {
    const { list } = game()
    const behind = list.map((t) => (t.name === 'Voo' ? { ...t, earned: false } : t))
    const open = behind.filter((t) => !t.earned)
    expect(names(placedOrder(open, behind, guide))[0]).toBe('Voo')
    expect(nextPlaced(open, behind, guide)?.name).toBe('Príncipe')
  })

  test('a trophy the guide does not place keeps its spot after the one before it', () => {
    const { list } = game()
    const extra = [...list.slice(0, 4), trophy('Sem lugar'), ...list.slice(4)]
    const open = extra.filter((t) => !t.earned)
    expect(names(placedOrder(open, extra, guide)).slice(0, 3)).toEqual([
      'Príncipe',
      'Sem lugar',
      'Café',
    ])
  })

  test('without places, the order is the roadmap and there is no next', () => {
    const { list, open } = game()
    expect(placedOrder(open, list, {})).toBe(open)
    expect(placedOrder(open, list, { ...guide, storyline: null })).toBe(open)
    expect(nextPlaced(open, list, null)).toBeUndefined()
    expect(expectedStep(open[0], list, undefined, 12)).toBeUndefined()
    // A name two trophies share is never placed.
    const twins = [...list, trophy('Café')]
    expect(expectedStep(twins[4], twins, guide, 12)).toBeUndefined()
  })
})

test('a unit the app cannot name leaves the guide unplaced', () => {
  const { list, open } = game()
  const odd = { ...guide, storyline: { unit: 'Missão', total: 35 } } as unknown as PlacedGuide
  expect(placedOrder(open, list, odd)).toBe(open)
})
