/** A link to a section of a screen (`/settings#appearance`): once the screen is ready and has arrived,
 * glide to the section and light it up for a moment (`.is-spotlit` in page.css). The section is the
 * element with the hash's id, or with `<hash>-card`. Under reduced motion it jumps there and keeps
 * a plain outline for the same moment. */
import { useEffect } from 'react'
import { useLocation } from 'react-router'

// How long the screen's own entrance takes before the glide starts (--motion-screen and a beat).
const SETTLE_MS = 350
// How long the section stays lit (--motion-spotlight and its delay).
const LIT_MS = 3200

export function useHashSpotlight(ready: boolean) {
  const { hash } = useLocation()
  useEffect(() => {
    if (!ready || !hash) return
    const id = decodeURIComponent(hash.slice(1))
    const target = document.getElementById(id) ?? document.getElementById(`${id}-card`)
    if (!target) return
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const go = setTimeout(
      () => {
        target.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' })
        target.classList.remove('is-spotlit')
        void target.offsetWidth
        target.classList.add('is-spotlit')
      },
      still ? 0 : SETTLE_MS,
    )
    const done = setTimeout(() => target.classList.remove('is-spotlit'), LIT_MS)
    return () => {
      clearTimeout(go)
      clearTimeout(done)
    }
  }, [ready, hash])
}
