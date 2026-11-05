/** The 80px trophy frame has a 6px outer ring; anchors sit on that ring's midline. */
export const ROADMAP_RIM = 46

/** One stop measured on screen: its centre inside its own column and the radius the road meets. */
export interface RoadStopGeometry {
  x: number
  y: number
  rim: number
}

interface RoadGeometry {
  x: number
  rim: number
  low: number
  high: number
  /** Each stop's own size: natural trophies are smaller, so the road has to reach further in. */
  stops?: RoadStopGeometry[]
}
const desktop: RoadGeometry = { x: 48, rim: ROADMAP_RIM, low: 96, high: 56 }

function node(index: number, width: number, geometry: RoadGeometry) {
  const stop = geometry.stops?.[index]
  return stop
    ? { x: stop.x + index * width, y: stop.y, rim: stop.rim }
    : {
        x: geometry.x + index * width,
        y: index % 2 ? geometry.high : geometry.low,
        rim: geometry.rim,
      }
}

/** A node's first half follows its upper rim; the second follows the road to the next node. */
export function roadPoint(position: number, width: number, geometry: RoadGeometry = desktop) {
  const index = Math.floor(position)
  const fraction = position - index
  const from = node(index, width, geometry)
  if (fraction <= 0.5) {
    const angle = Math.PI * (1 - 2 * fraction)
    return {
      x: from.x + from.rim * Math.cos(angle),
      y: from.y - from.rim * Math.sin(angle),
    }
  }
  const to = node(index + 1, 0, geometry)
  const t = (fraction - 0.5) * 2
  const curve = t * t * (3 - 2 * t)
  // The span inside one column: the next stop sits one column width further on.
  const span = width + to.x - node(index, 0, geometry).x - from.rim - to.rim
  return {
    x: from.x + from.rim + span * t,
    y: from.y + (to.y - from.y) * curve,
  }
}

/** Connect the right and left outer edges with horizontal tangents at the trophy midlines. */
export function roadSegment(index: number, width: number, geometry: RoadGeometry = desktop) {
  const from = node(index, 0, geometry)
  const to = node(index + 1, 0, geometry)
  const start = from.x + from.rim
  const end = width + to.x - to.rim
  const gap = end - start
  return `M${start} ${from.y} C${start + gap / 3} ${from.y} ${start + (gap * 2) / 3} ${to.y} ${end} ${to.y}`
}

/** The first visible node connects forward; the remaining nodes connect from behind. */
export function roadStop(index: number, columns: number) {
  return index + (index % Math.max(1, columns) === 0 ? 0.5 : 0)
}
