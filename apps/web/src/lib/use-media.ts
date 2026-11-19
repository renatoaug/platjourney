/** Whether a media query matches now, following it as the window changes. */
import { useSyncExternalStore } from 'react'

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (changed) => {
      const list = window.matchMedia?.(query)
      list?.addEventListener?.('change', changed)
      return () => list?.removeEventListener?.('change', changed)
    },
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  )
}

/** The large screen the game page lays out in columns for (a desktop window). */
export const WIDE = '(min-width: 1280px)'
