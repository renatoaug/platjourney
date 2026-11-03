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

/** Release the native cover after React mounts, the mascot decodes and a frame paints.
 * A failed or stalled image cannot keep the app covered; cleanup cancels StrictMode's old mount. */
export function handoffLaunchScreen(): () => void {
  if (!isNative()) return () => {}
  let cancelled = false
  let scheduled = false
  let frame = 0
  const paint = () => {
    if (cancelled || scheduled) return
    scheduled = true
    clearTimeout(timeout)
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (!cancelled) hideLaunchScreen()
      })
    })
  }
  const timeout = setTimeout(paint, 1500)
  const image = document.querySelector<HTMLImageElement>('.boot-nexo')
  if (image?.decode)
    image
      .decode()
      .catch(() => {})
      .then(paint)
  else paint()
  return () => {
    cancelled = true
    clearTimeout(timeout)
    cancelAnimationFrame(frame)
  }
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
