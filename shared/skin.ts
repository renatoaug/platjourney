/** The app's skins a player can pick in Settings: the default look, Neon, Pixel and Sunset. An account
 * that never picked one stores nothing. A skin restyles the whole app (palette, fonts, corners,
 * shadows); its values live in the web app's theme and skins stylesheet. This is only the list,
 * shared by the server (to accept a choice) and the web app (to offer and apply it). */
export const SKINS = ['default', 'neon', 'pixel', 'sunset'] as const

export type Skin = (typeof SKINS)[number]

export const DEFAULT_SKIN: Skin = 'default'

export const isSkin = (value: unknown): value is Skin =>
  typeof value === 'string' && (SKINS as readonly string[]).includes(value)
