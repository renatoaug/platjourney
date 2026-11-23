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

// How long the page stays still before the bottom bar is measured again after a scroll.
const SCROLL_SETTLE_MS = 150

/** A field the keyboard is open for. Focus alone is not enough where the visible area is known:
 * iOS can close the keyboard and leave the field focused, and a bar held down for a keyboard that
 * is gone stayed below the edge. The keyboard takes well over this much of the screen. */
const KEYBOARD_PX = 150
const typing = () => {
  if (!document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]'))
    return false
  const viewport = window.visualViewport
  return !viewport || viewport.height < window.innerHeight - KEYBOARD_PX
}

// Every so often the bar is measured again, whatever happened: an event iOS did not send (a
// keyboard closed, a rotation undone, a screen left mid-bounce) must not leave it off screen.
const RECHECK_MS = 2_000

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
    // Zoomed in, the visible area is not the layout's: leave the bar as it is until it is back.
    if (viewport && viewport.scale !== 1) return
    const visible = viewport ? viewport.offsetTop + viewport.height : window.innerHeight
    // A moment out of portrait (a rotation, a resize on the way) keeps the lift it had: dropping it
    // then sank the bar, with nothing to bring it back.
    if (window.innerHeight < window.innerWidth) return
    const next = typing()
      ? 0
      : barOverflow(bar.getBoundingClientRect().bottom + lift, visible, window.screen.height)
    if (next === lift) return
    lift = next
    bar.style.setProperty('--bar-lift', `${lift}px`)
  }
  // The keyboard takes about a third of a second to leave; measure during and after it.
  const settle = () => {
    check()
    for (const ms of [120, 400, 800]) timers.push(setTimeout(check, ms))
  }
  // While the page scrolls, and above all while it bounces at an end, the visible area moves under
  // the bar: measured then, the lift dropped to nothing and the bar sank below the edge, with no
  // event left to bring it back. Scrolling measures once it has stopped.
  let scrolling: ReturnType<typeof setTimeout> | undefined
  let scrolledAt = 0
  const scrolled = () => {
    scrolledAt = Date.now()
    clearTimeout(scrolling)
    scrolling = setTimeout(check, SCROLL_SETTLE_MS)
  }
  // The safety net waits for a still page, like a scroll does.
  const recheck = setInterval(() => {
    if (Date.now() - scrolledAt > SCROLL_SETTLE_MS) check()
  }, RECHECK_MS)
  check()
  const targets: EventTarget[] = [window, window.visualViewport].filter((x) => !!x) as EventTarget[]
  for (const target of targets) target.addEventListener('resize', check)
  window.visualViewport?.addEventListener('scroll', scrolled)
  window.addEventListener('scroll', scrolled, { passive: true })
  document.addEventListener('visibilitychange', check)
  document.addEventListener('focusin', check)
  document.addEventListener('focusout', settle)
  window.addEventListener('pageshow', settle)
  window.addEventListener('popstate', settle)
  return () => {
    clearInterval(recheck)
    window.removeEventListener('pageshow', settle)
    window.removeEventListener('popstate', settle)
    for (const target of targets) target.removeEventListener('resize', check)
    window.visualViewport?.removeEventListener('scroll', scrolled)
    window.removeEventListener('scroll', scrolled)
    clearTimeout(scrolling)
    document.removeEventListener('visibilitychange', check)
    document.removeEventListener('focusin', check)
    document.removeEventListener('focusout', settle)
    for (const timer of timers) clearTimeout(timer)
  }
}
