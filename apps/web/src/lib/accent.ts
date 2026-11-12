/** The accent color the player picked in Settings, on the page: `data-accent` on <html> switches
 * the theme's accent family and the tint of the background (styles/theme.css). It is also kept in
 * this browser, so the next visit paints in it from the first frame (public/accent.js), before
 * the account has loaded. */
import { type Accent, DEFAULT_ACCENT, isAccent } from '../../../../shared/accent'

const ACCENT_KEY = 'platjourney:accent'

/** Paints the page in `accent` and remembers it for the next visit. */
export function applyAccent(accent: Accent | null | undefined): void {
  const next = isAccent(accent) ? accent : DEFAULT_ACCENT
  const root = document.documentElement
  if (next === DEFAULT_ACCENT) delete root.dataset.accent
  else root.dataset.accent = next
  try {
    if (next === DEFAULT_ACCENT) localStorage.removeItem(ACCENT_KEY)
    else localStorage.setItem(ACCENT_KEY, next)
  } catch {}
  // The phone's status bar and the browser's chrome take the page's background, now tinted.
  const bg = getComputedStyle(root).getPropertyValue('--color-bg').trim()
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}
