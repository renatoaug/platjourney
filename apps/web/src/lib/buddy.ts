/** The buddy the signed-in player picked and the name they gave it, for every screen at once:
 * the texts say that name wherever they say Nexo, and `BuddyAvatar` draws that buddy. */
import { useSyncExternalStore } from 'react'
import { type Buddy, DEFAULT_BUDDY, isBuddy } from '../../../../shared/buddy'

interface BuddyChoice {
  buddy: Buddy
  name: string | null
}

const KEY = 'platjourney:buddy'

// The choice this browser last saw, so the loading and the first screens show the right buddy
// before the account loads (public/buddy.js does the same for the boot screen in the page).
function remembered(): BuddyChoice {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (saved && isBuddy(saved.buddy))
      return { buddy: saved.buddy, name: typeof saved.name === 'string' ? saved.name : null }
  } catch {}
  return { buddy: DEFAULT_BUDDY, name: null }
}

let current: BuddyChoice = remembered()
const listeners = new Set<() => void>()

export const getBuddy = (): BuddyChoice => current

export function setBuddy(buddy: Buddy | undefined, name: string | null | undefined): void {
  const next = { buddy: buddy ?? DEFAULT_BUDDY, name: name ?? null }
  if (next.buddy === current.buddy && next.name === current.name) return
  current = next
  // On the page too, like the skin's data-skin: plugins can read it (absent means Nexo).
  const root = document.documentElement
  if (next.buddy === DEFAULT_BUDDY) delete root.dataset.buddy
  else root.dataset.buddy = next.buddy
  if (next.name) root.dataset.buddyName = next.name
  else delete root.dataset.buddyName
  try {
    if (next.buddy === DEFAULT_BUDDY && !next.name) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
  for (const listener of listeners) listener()
}

export function subscribeBuddy(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The name the player's buddy answers to: the one they gave it, or Nexo's. */
export function useBuddyName(): string {
  return useSyncExternalStore(subscribeBuddy, getBuddy, getBuddy).name ?? 'Nexo'
}
