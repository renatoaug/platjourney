import { expect, test } from 'bun:test'
import { roadPoint, roadSegment, roadStop } from '../../src/lib/roadmap-motion'

for (const width of [124, 151.5, 236.8]) {
  test(`road curve and marker share exact endpoints and interpolation at width ${width}`, () => {
    expect(roadPoint(0, width)).toEqual({ x: 48, y: 96 })
    expect(roadPoint(1, width)).toEqual({ x: 48 + width, y: 56 })
    expect(roadPoint(2, width)).toEqual({ x: 48 + width * 2, y: 96 })
    expect(roadPoint(0.25, width).y).toBe(89.75)
    expect(roadPoint(0.5, width).y).toBe(76)
    expect(roadPoint(1.5, width).y).toBe(76)
    expect(roadSegment(0, width)).toEndWith(`${48 + width} 56`)
    expect(roadSegment(1, width)).toEndWith(`${48 + width} 96`)
  })
}

for (const width of [100, 124, 151.5, 236.8]) {
  test(`resting marker stays on the road at the trophy rim at width ${width}`, () => {
    let previous = -1
    for (let i = 0; i < 5; i++) {
      const position = roadStop(i, width, 5)
      const center = roadPoint(i, width)
      const point = roadPoint(position, width)
      expect(Math.hypot(point.x - center.x, point.y - center.y)).toBeCloseTo(40, 4)
      expect(position).toBeGreaterThan(previous)
      if (i === 4) expect(position).toBeLessThan(i)
      else expect(position).toBeGreaterThan(i)
      previous = position
    }
    expect(roadStop(0, width, 1)).toBeGreaterThan(0)
  })
}
