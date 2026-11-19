/** The skin the player picked in Settings, on the page: `data-skin` on <html> switches the
 * theme's palette, fonts, corners and shadows (styles/theme.css) and the component touches of
 * each skin (styles/skins.css). A skin brings its own display font, loaded only while it is on.
 * The pick is also kept in this browser, so the next visit paints in it from the first frame
 * (public/skin.js), before the account has loaded. */
import { DEFAULT_SKIN, isSkin, type Skin } from '../../../../shared/skin'

const SKIN_KEY = 'platjourney:skin'
const FONT_ID = 'skin-font'

/** The stylesheet with each skin's display font; the default look uses the page's own fonts. */
export const SKIN_FONTS: Record<Skin, string | null> = {
  default: null,
  neon: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&display=swap',
  pixel: 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&display=swap',
  vice_city: 'https://fonts.googleapis.com/css2?family=Anton&display=swap',
  christmas:
    'https://fonts.googleapis.com/css2?family=Mountains+of+Christmas:wght@700&display=swap',
  aurora: 'https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&display=swap',
}

function loadFont(skin: Skin): void {
  const href = SKIN_FONTS[skin]
  const current = document.getElementById(FONT_ID) as HTMLLinkElement | null
  if (!href) {
    current?.remove()
    return
  }
  if (current?.getAttribute('href') === href) return
  const link = current ?? document.createElement('link')
  link.id = FONT_ID
  link.rel = 'stylesheet'
  link.href = href
  if (!current) document.head.append(link)
}

/** Dresses the page in `skin` and remembers it for the next visit. */
export function applySkin(skin: Skin | null | undefined): void {
  const next = isSkin(skin) ? skin : DEFAULT_SKIN
  const root = document.documentElement
  if (next === DEFAULT_SKIN) delete root.dataset.skin
  else root.dataset.skin = next
  loadFont(next)
  try {
    if (next === DEFAULT_SKIN) localStorage.removeItem(SKIN_KEY)
    else localStorage.setItem(SKIN_KEY, next)
  } catch {}
  // The phone's status bar and the browser's chrome take the skin's background.
  const bg = getComputedStyle(root).getPropertyValue('--color-bg').trim()
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}
