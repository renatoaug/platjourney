/** One skeleton bar. Components build their own loading layout from these, with their real classes, so nothing jumps when data arrives. Never a spinner. */
import { type CSSProperties, Fragment, type ReactNode } from 'react'

export function Sk({
  w = '100%',
  h = 12,
  style,
}: {
  w?: string | number
  h?: number
  style?: CSSProperties
}) {
  return <span className="sk" style={{ width: w, height: h, ...style }} />
}

/** n copies of a skeleton row. */
export const repeat = (n: number, row: (i: number) => ReactNode) =>
  // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows never reorder
  Array.from({ length: n }, (_, i) => <Fragment key={i}>{row(i)}</Fragment>)
