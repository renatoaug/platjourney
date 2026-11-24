/** The buddies a player can pick in Settings to walk the road to the platinum with: Nexo (the
 * default) or one of the living gamer objects. An account that never picked one stores nothing.
 * Each object has five drawings of the same body (rest, blink, a side look and two gestures of its
 * own) in the web app's `public/buddies/<id>/`; this is only the list and the gestures, shared by
 * the server (to accept a choice) and the web app (to offer and animate it). */
export const BUDDIES = [
  'nexo',
  'controller',
  'cartridge',
  'trophy',
  'coffee',
  'heart',
  'crt',
  'arcade',
  'headset',
  'bomb',
  'energy',
  'handheld',
  'pizza',
  'burger',
] as const

export type Buddy = (typeof BUDDIES)[number]

export const DEFAULT_BUDDY: Buddy = 'nexo'

export const isBuddy = (value: unknown): value is Buddy =>
  typeof value === 'string' && (BUDDIES as readonly string[]).includes(value)

/** How the body moves while a gesture's face shows. */
export type BuddyMotion = 'shake' | 'hop' | 'stretch' | 'tilt' | 'wobble' | 'flicker' | 'bounce'

/** Each object's two gestures, in the order they play, and how its body moves with each. */
export const BUDDY_GESTURES: Record<Exclude<Buddy, 'nexo'>, [BuddyMotion, BuddyMotion]> = {
  controller: ['bounce', 'shake'],
  cartridge: ['stretch', 'tilt'],
  trophy: ['tilt', 'hop'],
  coffee: ['stretch', 'hop'],
  heart: ['tilt', 'hop'],
  crt: ['flicker', 'hop'],
  arcade: ['hop', 'shake'],
  headset: ['wobble', 'hop'],
  bomb: ['tilt', 'shake'],
  energy: ['hop', 'shake'],
  handheld: ['hop', 'stretch'],
  pizza: ['stretch', 'tilt'],
  burger: ['bounce', 'hop'],
}

/** The longest name a player can give their buddy. */
export const BUDDY_NAME_MAX = 20

/** A name as typed, trimmed and with inner spaces collapsed; null when nothing is left. */
export function cleanBuddyName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.replace(/\s+/g, ' ').trim()
  return name ? name : null
}

/** A text with Nexo's name swapped for the name the player gave their buddy. */
export const withBuddyName = (text: string, name: string | null | undefined): string =>
  name && name !== 'Nexo' ? text.replace(/\bNexo\b/g, name) : text
