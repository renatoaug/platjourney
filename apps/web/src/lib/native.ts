/** What the native app (Capacitor) adds to the web app. Its bridge exposes the native plugins on
 * `window.Capacitor`; in a browser there is no bridge and every call here does nothing. */

interface Bridge {
  isNativePlatform?: () => boolean
  Plugins?: {
    Haptics?: { selectionChanged?: () => Promise<void> }
    SplashScreen?: { hide?: (options?: { fadeOutDuration?: number }) => Promise<void> }
  }
}

const bridge = (): Bridge | undefined => (window as Window & { Capacitor?: Bridge }).Capacitor

export function isNative(): boolean {
  return bridge()?.isNativePlatform?.() === true
}

/** The light tick a phone gives when a choice changes (a tab, a switch). */
export function tick(): void {
  bridge()
    ?.Plugins?.Haptics?.selectionChanged?.()
    ?.catch(() => {})
}

/** Fades the native launch screen out: called once the page's own boot screen is on screen, so
 * the launch screen hands over to it with no gap. */
export function hideLaunchScreen(): void {
  bridge()
    ?.Plugins?.SplashScreen?.hide?.({ fadeOutDuration: 200 })
    ?.catch(() => {})
}

// Choices that tick under the finger: the menu, tab bars, switches and check boxes.
const TICKS = '.nav a, .nav-sheet a, [role="tab"], input[type="checkbox"], input[type="radio"]'

/** Ticks on every tap on a choice, app-wide. Only in the native app. */
export function tickOnChoices(): void {
  if (!isNative()) return
  document.addEventListener('click', (e) => {
    if ((e.target as Element | null)?.closest?.(TICKS)) tick()
  })
}
