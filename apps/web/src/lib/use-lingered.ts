import { type RefObject, useEffect, useState } from 'react'

/**
 * True once the element stayed mostly on screen for `ms` in a row, with the tab in front: the
 * player is reading it slowly, or stuck on it. It stays true after that.
 */
export function useLingered(ref: RefObject<Element | null>, ms: number): boolean {
  const [lingered, setLingered] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || lingered || typeof IntersectionObserver === 'undefined') return
    let timer: ReturnType<typeof setTimeout> | undefined
    let inView = false
    const stop = () => {
      clearTimeout(timer)
      timer = undefined
    }
    const start = () => {
      if (timer || !inView || document.hidden) return
      timer = setTimeout(() => setLingered(true), ms)
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = !!entry?.isIntersecting
        if (inView) start()
        else stop()
      },
      { threshold: 0.6 },
    )
    const visibility = () => (document.hidden ? stop() : start())
    observer.observe(el)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      stop()
      observer.disconnect()
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [ref, ms, lingered])
  return lingered
}
