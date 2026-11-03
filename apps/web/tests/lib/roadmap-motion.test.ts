import { expect, test } from 'bun:test'
import { roadPoint, roadSegment } from '../../src/lib/roadmap-motion'

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
