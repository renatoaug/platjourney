/** Trophy centers and the connecting road share the same cubic curve at every width. */
export function roadPoint(position: number, width: number) {
  const index = Math.floor(position)
  const fraction = position - index
  const start = index % 2 ? 56 : 96
  const end = index % 2 ? 96 : 56
  const curve = fraction * fraction * (3 - 2 * fraction)
  return { x: 48 + position * width, y: start + (end - start) * curve }
}

export function roadSegment(index: number, width: number) {
  const start = index % 2 ? 56 : 96
  const end = index % 2 ? 96 : 56
  return `M48 ${start} C${48 + width / 3} ${start} ${48 + (width * 2) / 3} ${end} ${48 + width} ${end}`
}

/** Stop at the 80px trophy border where the road meets the trophy, without covering its artwork. */
export function roadStop(index: number, width: number, count: number) {
  const direction = count > 1 && index === count - 1 ? -1 : 1
  const center = roadPoint(index, width)
  let low = 0
  let high = 0.5
  for (let i = 0; i < 24; i++) {
    const fraction = (low + high) / 2
    const point = roadPoint(index + direction * fraction, width)
    if (Math.hypot(point.x - center.x, point.y - center.y) < 40) low = fraction
    else high = fraction
  }
  return index + (direction * (low + high)) / 2
}
