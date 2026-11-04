/** The 80px trophy frame has a 6px outer ring; anchors sit on that ring's midline. */
export const ROADMAP_RIM = 46

interface RoadGeometry {
  x: number
  rim: number
  low: number
  high: number
}
const desktop: RoadGeometry = { x: 48, rim: ROADMAP_RIM, low: 96, high: 56 }

function center(index: number, width: number, geometry: RoadGeometry) {
  return { x: geometry.x + index * width, y: index % 2 ? geometry.high : geometry.low }
}

/** A node's first half follows its upper rim; the second follows the road to the next node. */
export function roadPoint(position: number, width: number, geometry: RoadGeometry = desktop) {
  const index = Math.floor(position)
  const fraction = position - index
  const from = center(index, width, geometry)
  if (fraction <= 0.5) {
    const angle = Math.PI * (1 - 2 * fraction)
    return {
      x: from.x + geometry.rim * Math.cos(angle),
      y: from.y - geometry.rim * Math.sin(angle),
    }
  }
  const to = center(index + 1, width, geometry)
  const t = (fraction - 0.5) * 2
  const curve = t * t * (3 - 2 * t)
  return {
    x: from.x + geometry.rim + (width - 2 * geometry.rim) * t,
    y: from.y + (to.y - from.y) * curve,
  }
}

/** Connect the right and left outer edges with horizontal tangents at the trophy midlines. */
export function roadSegment(index: number, width: number, geometry: RoadGeometry = desktop) {
  const from = center(index, 0, geometry)
  const to = center(index + 1, 0, geometry)
  const start = from.x + geometry.rim
  const end = from.x + width - geometry.rim
  const gap = end - start
  return `M${start} ${from.y} C${start + gap / 3} ${from.y} ${start + (gap * 2) / 3} ${to.y} ${end} ${to.y}`
}

/** The first visible node connects forward; the remaining nodes connect from behind. */
export function roadStop(index: number, columns: number) {
  return index + (index % Math.max(1, columns) === 0 ? 0.5 : 0)
}
