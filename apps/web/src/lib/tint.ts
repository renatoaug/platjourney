import type { CSSProperties } from 'react'

/** The style that paints an element's tinted surfaces in a game's color; without one they keep the brand's. */
export const tintStyle = (tint?: string | null): CSSProperties | undefined =>
  tint ? ({ '--game-tint': tint } as CSSProperties) : undefined
