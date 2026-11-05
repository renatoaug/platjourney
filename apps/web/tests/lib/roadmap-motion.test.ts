import { expect, test } from 'bun:test'
import { ROADMAP_RIM, roadPoint, roadSegment, roadStop } from '../../src/lib/roadmap-motion'

for (const width of [100, 124, 151.5, 236.8]) {
  test(`road endpoints meet the outer ring at its horizontal midline at width ${width}`, () => {
    for (let i = 0; i < 5; i++) {
      const y = i % 2 ? 56 : 96
      const nextY = i % 2 ? 96 : 56
      expect(roadPoint(i + 0.5, width)).toEqual({ x: 48 + i * width + ROADMAP_RIM, y })
      expect(roadPoint(i + 1, width).x).toBe(48 + (i + 1) * width - ROADMAP_RIM)
      expect(roadPoint(i + 1, width).y).toBeCloseTo(nextY, 8)
      expect(roadSegment(i, width)).toStartWith(`M94 ${y} C`)
      expect(roadSegment(i, width)).toEndWith(`${width + 2} ${nextY}`)
      expect(roadPoint(i + 0.75, width)).toEqual({ x: 48 + (i + 0.5) * width, y: 76 })
      const rim = roadPoint(i + 0.25, width)
      expect(Math.hypot(rim.x - (48 + i * width), rim.y - y)).toBeCloseTo(ROADMAP_RIM, 8)
      expect(rim.y).toBe(y - ROADMAP_RIM)
    }
  })
}

for (const columns of [1, 2, 3, 5]) {
  test(`page-relative stops use front then rear edges with ${columns} columns in both directions`, () => {
    const width = 151.5
    const indices = Array.from({ length: 12 }, (_, i) => i)
    for (const index of [...indices, ...indices.toReversed()]) {
      const point = roadPoint(roadStop(index, columns), width)
      expect(point.x).toBe(
        48 + index * width + (index % columns === 0 ? ROADMAP_RIM : -ROADMAP_RIM),
      )
      expect(point.y).toBeCloseTo(index % 2 ? 56 : 96, 8)
    }
  })
}

test('resizing changes the side only when the milestone becomes first on its page', () => {
  expect(roadStop(3, 5)).toBe(3)
  expect(roadStop(3, 3)).toBe(3.5)
  expect(roadStop(3, 2)).toBe(3)
  expect(roadStop(4, 2)).toBe(4.5)
})

for (const width of [82.6667, 101, 180])
  test(`measured compact geometry follows ring and road at ${width}px`, () => {
    const geometry = { x: width / 2, rim: 34, low: 72, high: 44 }
    for (let i = 0; i < 9; i++) {
      const point = roadPoint(roadStop(i, 3), width, geometry)
      expect(point.x).toBeCloseTo(width / 2 + i * width + (i % 3 ? -34 : 34), 8)
      expect(point.y).toBeCloseTo(i % 2 ? 44 : 72, 8)
      expect(roadSegment(i, width, geometry)).toStartWith(`M${width / 2 + 34} ${i % 2 ? 44 : 72}`)
      const midpoint = roadPoint(i + 0.75, width, geometry)
      expect(midpoint.y).toBe(58)
      expect(midpoint.x).toBeCloseTo((i + 1) * width, 8)
    }
  })

test('a smaller stop pulls the road in to its own rim', () => {
  const width = 200
  const stops = [
    { x: 100, y: 96, rim: 62 },
    { x: 100, y: 56, rim: 32 },
    { x: 100, y: 96, rim: 62 },
  ]
  const geometry = { x: 100, rim: 62, low: 96, high: 56, stops }
  expect(roadSegment(0, width, geometry)).toStartWith('M162 96 C')
  expect(roadSegment(0, width, geometry)).toEndWith(' 268 56')
  expect(roadSegment(1, width, geometry)).toStartWith('M132 56 C')
  expect(roadSegment(1, width, geometry)).toEndWith(' 238 96')
  for (const [at, x, y] of [
    [1, 268, 56],
    [1.5, 332, 56],
    [2, 438, 96],
  ]) {
    expect(roadPoint(at, width, geometry).x).toBeCloseTo(x, 8)
    expect(roadPoint(at, width, geometry).y).toBeCloseTo(y, 8)
  }
})
