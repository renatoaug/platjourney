/** A segmented control's sliding fill: keeps `--slide-x` and `--slide-w` on the control at the place
 * and width of its chosen item (`aria-pressed="true"`, `aria-current` or `.active`), so a pseudo
 * element in its CSS can slide there when the choice changes. Follows the control's size too. */
import { useLayoutEffect, useRef } from 'react'

const CHOSEN = '[aria-pressed="true"], [aria-current="location"], .active'

export function useSlide<T extends HTMLElement>(choice: unknown) {
  const ref = useRef<T>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `choice` is the trigger, not an input
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const place = () => {
      const item = el.querySelector<HTMLElement>(CHOSEN)
      el.toggleAttribute('data-slide', !!item)
      if (!item) return
      const box = el.getBoundingClientRect()
      const at = item.getBoundingClientRect()
      // From the control's padding edge, where its pseudo element starts.
      el.style.setProperty('--slide-x', `${at.left - box.left - el.clientLeft + el.scrollLeft}px`)
      el.style.setProperty('--slide-w', `${at.width}px`)
    }
    place()
    const watch = new ResizeObserver(place)
    watch.observe(el)
    return () => watch.disconnect()
  }, [choice])
  return ref
}
