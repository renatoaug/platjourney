/** The app's accent colors a player can pick in Settings. Lime is the default (an account that
 * never picked one stores nothing). Their values live in the web app's theme; this is only the
 * list, shared by the server (to accept a choice) and the web app (to offer and apply it). */
export const ACCENTS = ['lime', 'cyan', 'cobalt', 'violet', 'magenta', 'amber'] as const

export type Accent = (typeof ACCENTS)[number]

export const DEFAULT_ACCENT: Accent = 'lime'

export const isAccent = (value: unknown): value is Accent =>
  typeof value === 'string' && (ACCENTS as readonly string[]).includes(value)
