/** Tooltip for any element with data-tip. One floating node, shown on hover and focus; mount <TooltipHost /> once. */
import { useEffect, useRef } from 'react'

export function TooltipHost() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tip = ref.current
    if (!tip) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const hide = () => {
      clearTimeout(timer)
      tip.classList.remove('show')
    }
    const show = (el: HTMLElement) => {
      const text = el.dataset.tip
      if (!text) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        tip.textContent = text
        tip.classList.add('show')
        const r = el.getBoundingClientRect()
        let top = r.top - tip.offsetHeight - 8
        const flip = top < 8
        if (flip) top = r.bottom + 8
        const w = tip.offsetWidth
        tip.style.top = `${top}px`
        tip.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8)}px`
        tip.classList.toggle('below', flip)
      }, 120)
    }
    const target = (e: Event) =>
      (e.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-tip]')
    const over = (e: Event) => {
      const el = target(e)
      if (el) show(el)
    }
    const out = (e: Event) => {
      if (target(e)) hide()
    }
    document.addEventListener('mouseover', over)
    document.addEventListener('mouseout', out)
    document.addEventListener('focusin', over)
    document.addEventListener('focusout', hide)
    document.addEventListener('click', hide)
    window.addEventListener('scroll', hide, { passive: true })
    return () => {
      hide()
      document.removeEventListener('mouseover', over)
      document.removeEventListener('mouseout', out)
      document.removeEventListener('focusin', over)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('click', hide)
      window.removeEventListener('scroll', hide)
    }
  }, [])

  // Visual only: every element with data-tip already carries its own accessible name.
  return <div className="tooltip" ref={ref} aria-hidden="true" />
}
