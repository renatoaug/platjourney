/** The 80px trophy frame has a 6px outer ring; anchors sit on that ring's midline. */
export const ROADMAP_RIM = 46

function center(index: number, width: number) {
  return { x: 48 + index * width, y: index % 2 ? 56 : 96 }
}

/** A node's first half follows its upper rim; the second follows the road to the next node. */
export function roadPoint(position: number, width: number) {
  const index = Math.floor(position)
  const fraction = position - index
  const from = center(index, width)
  if (fraction <= 0.5) {
    const angle = Math.PI * (1 - 2 * fraction)
    return {
      x: from.x + ROADMAP_RIM * Math.cos(angle),
      y: from.y - ROADMAP_RIM * Math.sin(angle),
    }
  }
  const to = center(index + 1, width)
  const t = (fraction - 0.5) * 2
  const curve = t * t * (3 - 2 * t)
  return {
    x: from.x + ROADMAP_RIM + (width - 2 * ROADMAP_RIM) * t,
    y: from.y + (to.y - from.y) * curve,
  }
}

/** Connect the right and left outer edges with horizontal tangents at the trophy midlines. */
export function roadSegment(index: number, width: number) {
  const from = center(index, 0)
  const to = center(index + 1, 0)
  const start = from.x + ROADMAP_RIM
  const end = from.x + width - ROADMAP_RIM
  const gap = end - start
  return `M${start} ${from.y} C${start + gap / 3} ${from.y} ${start + (gap * 2) / 3} ${to.y} ${end} ${to.y}`
}

/** The first visible node connects forward; the remaining nodes connect from behind. */
export function roadStop(index: number, columns: number) {
  return index + (index % Math.max(1, columns) === 0 ? 0.5 : 0)
}
