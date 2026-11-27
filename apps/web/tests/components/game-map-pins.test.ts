import { expect, test } from 'bun:test'
import { onScreen, pin, syncMarkers } from '../../src/components/game-map-pins'

const feature = (id: string, at: [number, number]) => ({
  properties: { id },
  geometry: { coordinates: at },
})

test('a pin is a labelled button with the category icon', () => {
  const el = pin('cards', 'Sammy')
  expect(el.getAttribute('aria-label')).toBe('Sammy')
  expect(el.innerHTML).toContain('#icon-cards')
})

test('pins follow what is on screen: added, restyled, removed, and a click chooses the spot', () => {
  let shownNow = [feature('a', [1, 2]), feature('b', [3, 4]), { properties: {}, geometry: {} }]
  const map = { querySourceFeatures: () => shownNow }
  expect([...onScreen(map).keys()]).toEqual(['a', 'b'])
  const markers = new Map()
  const removed: string[] = []
  const chosen: (string | null)[] = []
  const placed: [number, number][] = []
  const shown = {
    points: [
      { id: 'a', category: 'cards', lng: 1, lat: 2, title: 'A' },
      { id: 'b', category: 'banks', lng: 3, lat: 4, approx: true },
    ],
    done: new Set(['a']),
    selected: 'b',
    icons: { cards: 'cards' },
  }
  const on = {
    select: (id: string | null) => chosen.push(id),
    place: (el: HTMLButtonElement, at: [number, number]) => {
      placed.push(at)
      return { remove: () => removed.push(el.getAttribute('aria-label') ?? '') }
    },
  }
  syncMarkers(map, markers, shown, on)
  expect(placed).toEqual([
    [1, 2],
    [3, 4],
  ])
  const a = markers.get('a').el as HTMLButtonElement
  const b = markers.get('b').el as HTMLButtonElement
  expect(a.classList.contains('is-done')).toBe(true)
  expect(b.classList.contains('is-approx')).toBe(true)
  expect(b.getAttribute('aria-pressed')).toBe('true')
  expect(b.innerHTML).toContain('#icon-map')
  a.click()
  expect(chosen).toEqual(['a'])
  shownNow = [feature('b', [3, 4])]
  syncMarkers(map, markers, { ...shown, selected: null }, on)
  expect(removed).toEqual(['A'])
  expect(markers.has('a')).toBe(false)
  expect(b.getAttribute('aria-pressed')).toBe('false')
  expect(placed).toHaveLength(2)
})
