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
