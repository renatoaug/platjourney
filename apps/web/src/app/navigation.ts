/** How a screen arrives and where it scrolls to, in one place for every route (page.css animates).
 *
 * - `tab`: between the menu's own screens (the bottom bar on a phone). A short fade.
 * - `push`: into a screen opened from inside another one (settings, profile, a game's journey, a
 *   title). It slides in from the right and starts at the top.
 * - `pop`: back. It slides in from the left and returns to where the reader was.
 *
 * A game's pages (`?view=journey`) count as screens of their own, so the same rules apply to them.
 */
import { useLayoutEffect, useRef } from 'react'
import { type Location, useNavigationType } from 'react-router'

export type Arrival = 'tab' | 'push' | 'pop'

/** The bottom bar's screens: moving between them is a tab change, anything else goes deeper. */
const TABS = new Set(['/', '/game', '/guides', '/discover', '/games'])

/** What makes a screen: the path, plus a game's page when one is open. */
export function screenOf(location: Pick<Location, 'pathname' | 'search'>): string {
  const view = new URLSearchParams(location.search).get('view')
  return view ? `${location.pathname}?view=${view}` : location.pathname
}

const isTab = (screen: string) => TABS.has(screen)

/** The arrival of the current screen, and its entrance played again when only a game's page changed
 * (the same `.page` stays mounted, so its CSS animation would not run by itself). */
export function useArrival(screen: string): Arrival {
  const type = useNavigationType()
  const previous = useRef(screen)
  const arrival = useRef<Arrival>('tab')
  const changed = previous.current !== screen
  if (changed) {
    arrival.current =
      type === 'POP' ? 'pop' : isTab(screen) && isTab(previous.current) ? 'tab' : 'push'
  }
  const samePage = changed && previous.current.split('?')[0] === screen.split('?')[0]
  previous.current = screen
  useLayoutEffect(() => {
    if (!samePage) return
    const page = document.querySelector<HTMLElement>('.page.active')
    if (!page) return
    page.style.animation = 'none'
    void page.offsetWidth
    page.style.animation = ''
  })
  return arrival.current
}

const positions = new Map<string, number>()

/** A new screen starts at its top; going back returns to the height the reader left it at. The
 * screen's content may still be loading, so the way back keeps trying for a moment until the page is
 * tall enough. A link to a section (`#appearance`) is left to the screen, which glides to it. */
export function useScrollMemory(location: Location, screen: string, skip: boolean) {
  const type = useNavigationType()
  const key = useRef(location.key)
  const last = useRef(screen)
  useLayoutEffect(() => {
    const save = () => positions.set(key.current, window.scrollY)
    addEventListener('scroll', save, { passive: true })
    return () => removeEventListener('scroll', save)
  }, [])
  useLayoutEffect(() => {
    if (skip || last.current === screen) {
      key.current = location.key
      return
    }
    last.current = screen
    key.current = location.key
    if (location.hash) return
    const target = type === 'POP' ? (positions.get(location.key) ?? 0) : 0
    window.scrollTo({ top: target })
    if (!target) return
    let tries = 0
    const timer = setInterval(() => {
      tries++
      if (Math.abs(window.scrollY - target) < 2 || tries > 20) return clearInterval(timer)
      if (document.documentElement.scrollHeight - innerHeight >= target)
        window.scrollTo({ top: target })
    }, 50)
    return () => clearInterval(timer)
  }, [screen, location.key, location.hash, skip, type])
}
