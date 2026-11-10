import { describe, expect, test } from 'bun:test'
import {
  closingSteps,
  expectedStep,
  nextPlaced,
  type PlacedGuide,
  type PlacedTrophy,
  placedOrder,
  playerStep,
  trophyWhen,
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

  test('a count sits where it should close: halfway through its range, or its pace so far', () => {
    const { list, open } = game()
    // No progress and no players yet: halfway through its range (12 to 30).
    expect(expectedStep(open[0], list, guide, 12)).toBe(21)
    // 10 of 50 in the first mission with the drone, 10 a mission: 4 more missions.
    const fast = game({ progressValue: 10 })
    expect(expectedStep(fast.open[0], fast.list, guide, 12)).toBe(16)
    // Too slow to close in the story: after it, on mission select.
    const slow = game({ progressValue: 1 })
    expect(expectedStep(slow.open[0], slow.list, guide, 14)).toBe(36)
    // A collection with no counter: halfway through its range (3 to 33).
    expect(expectedStep(open[3], list, guide, 12)).toBe(18)
    // A trophy of a single moment: where it unlocks.
    expect(expectedStep(open[1], list, guide, 12)).toBe(13)
    // A long trophy whose end the guide does not give: its start, never behind the player.
    const startOnly = {
      ...guide,
      trophyPlaces: [...(guide.trophyPlaces ?? []), { trophy: 'Café', from: 3 }].filter(
        (p, i, all) => all.findLastIndex((x) => x.trophy === p.trophy) === i,
      ),
    }
    const grind = {
      ...startOnly,
      trophyKinds: [...(guide.trophyKinds ?? []), { trophy: 'Café', kind: 'grind' as const }],
    }
    expect(expectedStep(open[2], list, grind, 12)).toBe(12)
  })

  test('what is left goes in the order it should fall, and the next is the nearest ahead', () => {
    const { list, open } = game()
    expect(names(placedOrder(open, list, guide))).toEqual([
      'Príncipe',
      'Café',
      'Paus e Pedras',
      'Golpe Final',
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

  test('a trophy the guide does not place goes by its rarity, else after the story', () => {
    const rated = game().list.map((t) =>
      t.name === 'Príncipe'
        ? { ...t, earnedRate: 60 }
        : t.name === 'Café'
          ? { ...t, earnedRate: 40 }
          : t.name === 'Sacrifício'
            ? { ...t, earnedRate: 10 }
            : t,
    )
    // As many players as Café's: around mission 16, after the story trophy there.
    const extra = [trophy('Sem lugar', { earnedRate: 38 }), ...rated]
    const open = extra.filter((t) => !t.earned)
    expect(names(placedOrder(open, extra, guide)).slice(0, 3)).toEqual([
      'Príncipe',
      'Café',
      'Sem lugar',
    ])
    // PSN does not know the share (0): after the story, past the last story trophy.
    const unknown = [trophy('Sem lugar', { earnedRate: 0 }), ...rated]
    expect(
      names(
        placedOrder(
          unknown.filter((t) => !t.earned),
          unknown,
          guide,
        ),
      ).at(-1),
    ).toBe('Sem lugar')
  })

  test('without places, the order is the roadmap and there is no next', () => {
    const { list, open } = game()
    expect(placedOrder(open, list, {})).toBe(open)
    expect(placedOrder(open, list, { ...guide, storyline: null })).toBe(open)
    expect(nextPlaced(open, list, null)).toBeUndefined()
    expect(expectedStep(open[0], list, undefined, 12)).toBeUndefined()
    // A name two trophies share is never placed: with no rarity, after the story.
    const twins = [...list, trophy('Café')]
    expect(expectedStep(twins[4], twins, guide, 12)).toBe(36)
  })
})

test('a unit the app cannot name leaves the guide unplaced', () => {
  const { list, open } = game()
  const odd = { ...guide, storyline: { unit: 'Missão', total: 35 } } as unknown as PlacedGuide
  expect(placedOrder(open, list, odd)).toBe(open)
})

describe('where players usually close a long trophy', () => {
  const ids = (list: PlacedTrophy[]) => list.map((t, i) => ({ ...t, id: i + 1 }))
  // Voo (mission 10), Memória (12), Golpe Final, Príncipe (13), Café (16), Paus e Pedras, Sacrifício.
  const startOnly: PlacedGuide = {
    ...guide,
    trophyPlaces: (guide.trophyPlaces ?? []).map((p) =>
      p.trophy === 'Paus e Pedras' ? { trophy: p.trophy, from: 3 } : p,
    ),
  }
  const at = (user: string, id: number, day: number) => ({
    user,
    trophyId: id,
    at: `2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`,
  })

  test('the median step over players, from the story trophy each had when it closed', () => {
    const { list } = game()
    const all = ids(list)
    const unlocks = [
      ...['a', 'b'].flatMap((u) => [at(u, 1, 1), at(u, 6, 3)]), // after Voo (10)
      at('c', 1, 1),
      at('c', 5, 2),
      at('c', 6, 3), // after Café (16)
      at('d', 6, 1), // before any story trophy: says nothing
    ]
    expect(closingSteps(all, unlocks, startOnly)).toEqual([
      { trophy: 'Paus e Pedras', step: 10, players: 3 },
    ])
  })

  test('between two story trophies the step goes with the time; before the first, from the start', () => {
    const { list } = game()
    const all = ids(list)
    const unlocks = ['a', 'b', 'c'].flatMap((u) => [
      at(u, 6, 1), // Paus e Pedras, their first unlock: the start of the game
      at(u, 1, 10), // Voo, mission 10
      at(u, 3, 13), // Golpe Final, halfway to Café in time
      at(u, 5, 16), // Café, mission 16
    ])
    expect(closingSteps(all, unlocks, startOnly)).toEqual([
      { trophy: 'Paus e Pedras', step: 0, players: 3 },
      { trophy: 'Golpe Final', step: 13, players: 3 },
    ])
  })

  test('with three players or more it orders the route and says so; with fewer, only the start', () => {
    const { list, open } = game()
    const paus = open.find((t) => t.name === 'Paus e Pedras') as PlacedTrophy
    const steps = (players: number): PlacedGuide => ({
      ...startOnly,
      trophySteps: [{ trophy: 'Paus e Pedras', step: 20, players }],
    })
    expect(expectedStep(paus, list, steps(3), 12)).toBe(20)
    expect(trophyWhen(paus, list, steps(3))?.usually).toEqual({
      trophy: 'Paus e Pedras',
      step: 20,
      players: 3,
    })
    // Fewer than three: its start, never behind the player.
    expect(expectedStep(paus, list, steps(2), 12)).toBe(12)
    expect(trophyWhen(paus, list, steps(2))?.usually).toBeUndefined()
  })
})

test('a range the guide closes past the last step finishes after the story', () => {
  const late = {
    ...guide,
    trophyPlaces: [{ trophy: 'Corda', from: 8, to: 36 }],
    trophyKinds: [{ trophy: 'Corda', kind: 'grind' as const }],
  }
  const corda = trophy('Corda')
  expect(trophyWhen(corda, [corda], late)).toMatchObject({
    from: 8,
    to: 36,
    after: true,
    // Without players, it is expected halfway, not only after the story.
    late: false,
    expected: 22,
  })
  const paus = trophy('Paus e Pedras')
  expect(trophyWhen(paus, [paus], guide)?.after).toBe(false)
})
