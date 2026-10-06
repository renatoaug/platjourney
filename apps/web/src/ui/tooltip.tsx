/** Tooltip for any element with data-tip. One floating node, shown on hover and focus; mount <TooltipHost /> once. */
import { useEffect, useRef } from 'react'
import './tooltip.css'

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
    // Touch screens have no hover: a tap would leave the tip hanging. Focus from a tap is skipped
    // too; focus from the keyboard still shows it.
    const hover = window.matchMedia?.('(hover: hover)')
    let touched = false
    const touch = () => {
      touched = true
    }
    const key = () => {
      touched = false
    }
    const over = (e: Event) => {
      const el = target(e)
      if (!el) return
      if (e.type === 'mouseover' && hover && !hover.matches) return
      if (e.type === 'focusin' && touched) return
      show(el)
    }
    const out = (e: Event) => {
      if (target(e)) hide()
    }
    document.addEventListener('touchstart', touch, { passive: true })
    document.addEventListener('keydown', key)
    document.addEventListener('mouseover', over)
    document.addEventListener('mouseout', out)
    document.addEventListener('focusin', over)
    document.addEventListener('focusout', hide)
    document.addEventListener('click', hide)
    window.addEventListener('scroll', hide, { passive: true })
    return () => {
      hide()
      document.removeEventListener('touchstart', touch)
      document.removeEventListener('keydown', key)
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
