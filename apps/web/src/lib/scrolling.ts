/** While the page scrolls, the root carries `is-scrolling`: the skins pause their moving decor
 * (a rolling floor, a sea, palms, a glint on the bars) so the phone spends each frame on the
 * scroll. They pick up where they were once the page has been still for a moment. */

const CLASS = 'is-scrolling'
// How long the page stays still before the decor moves again.
const STILL_MS = 180

export function markScrolling(root: HTMLElement = document.documentElement): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const still = () => {
    timer = undefined
    root.classList.remove(CLASS)
  }
  const scrolled = () => {
    if (!timer) root.classList.add(CLASS)
    else clearTimeout(timer)
    timer = setTimeout(still, STILL_MS)
  }
  // Capture: screens that scroll a box of their own (a sheet, the chat's log) count too.
  document.addEventListener('scroll', scrolled, { capture: true, passive: true })
  return () => {
    document.removeEventListener('scroll', scrolled, { capture: true })
    clearTimeout(timer)
    still()
  }
}
