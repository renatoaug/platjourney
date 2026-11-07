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

/** How far the bottom bar's bottom edge sits below what the screen shows, in pixels. */
export function barOverflow(
  barBottom: number,
  visibleBottom: number,
  screenHeight: number,
): number {
  return Math.max(0, Math.round(barBottom - Math.min(visibleBottom, screenHeight)))
}

/** A field the keyboard is open for. */
const typing = () =>
  !!document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')

/**
 * The iOS app's web view can lay the page out taller than the screen, which leaves the fixed bottom
 * bar below the edge with nothing to bring it back. This measures the bar and lifts it by what is
 * hidden. In portrait only, since `screen.height` does not follow the rotation. While a field has
 * the keyboard the bar stays where it is, behind the keyboard: lifting it over the keyboard left it
 * floating when iOS closed the keyboard without a last resize. When the field lets go, the bar is
 * measured again once the keyboard has gone.
 */
export function keepBottomBarOnScreen(bar: HTMLElement): () => void {
  if (!isNative()) return () => {}
  let lift = 0
  const timers: ReturnType<typeof setTimeout>[] = []
  const check = () => {
    const viewport = window.visualViewport
    const visible = viewport ? viewport.offsetTop + viewport.height : window.innerHeight
    const portrait = window.innerHeight >= window.innerWidth
    const next =
      portrait && !typing()
        ? barOverflow(bar.getBoundingClientRect().bottom + lift, visible, window.screen.height)
        : 0
    if (next === lift) return
    lift = next
    bar.style.setProperty('--bar-lift', `${lift}px`)
  }
  // The keyboard takes about a third of a second to leave; measure during and after it.
  const settle = () => {
    check()
    for (const ms of [120, 400, 800]) timers.push(setTimeout(check, ms))
  }
  check()
  const targets: EventTarget[] = [window, window.visualViewport].filter((x) => !!x) as EventTarget[]
  for (const target of targets) target.addEventListener('resize', check)
  window.visualViewport?.addEventListener('scroll', check)
  window.addEventListener('scroll', check, { passive: true })
  document.addEventListener('visibilitychange', check)
  document.addEventListener('focusin', check)
  document.addEventListener('focusout', settle)
  return () => {
    for (const target of targets) target.removeEventListener('resize', check)
    window.visualViewport?.removeEventListener('scroll', check)
    window.removeEventListener('scroll', check)
    document.removeEventListener('visibilitychange', check)
    document.removeEventListener('focusin', check)
    document.removeEventListener('focusout', settle)
    for (const timer of timers) clearTimeout(timer)
  }
}
