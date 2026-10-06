/** Toast: short feedback at the bottom of the screen, with an optional action. Call toast() from anywhere; <ToastHost /> renders it. */
import { useEffect, useState } from 'react'
import { Icon } from './icon'
import './toast.css'

export type ToastKind = 'error' | 'success' | 'info'
export interface ToastAction {
  href: string
  label: string
}
interface ToastItem {
  id: number
  text: string
  kind: ToastKind
  action?: ToastAction
}

const KINDS: ToastKind[] = ['error', 'success', 'info']
let listener: ((t: ToastItem) => void) | null = null
let next = 0

/**
 * @param kind  error is the default (failures); success pops with a burst; info is neutral
 */
export function toast(text: string, kind: ToastKind = 'error', action?: ToastAction) {
  if (!KINDS.includes(kind)) throw new Error(`toast kind must be one of ${KINDS.join(', ')}`)
  listener?.({ id: ++next, text, kind, action })
}

export function ToastHost() {
  const [item, setItem] = useState<ToastItem | null>(null)
  const [phase, setPhase] = useState<'enter' | 'show' | 'leave'>('enter')

  useEffect(() => {
    listener = (t) => {
      setItem(t)
      setPhase('enter')
    }
    return () => {
      listener = null
    }
  }, [])

  useEffect(() => {
    if (!item) return
    const raf = requestAnimationFrame(() => setPhase('show'))
    const leave = setTimeout(() => setPhase('leave'), item.kind === 'success' ? 4200 : 3500)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(leave)
    }
  }, [item])

  useEffect(() => {
    if (phase !== 'leave') return
    const gone = setTimeout(() => setItem(null), 350)
    return () => clearTimeout(gone)
  }, [phase])

  if (!item) return null
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking only dismisses early; it also leaves on its own
    // biome-ignore lint/a11y/noStaticElementInteractions: same; the toast is announced by its role
    <div
      key={item.id}
      className={`toast ${item.kind}${phase === 'show' ? ' show' : ''}${phase === 'leave' ? ' leave' : ''}`}
      role={item.kind === 'error' ? 'alert' : 'status'}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('a')) setPhase('leave')
      }}
    >
      {item.kind === 'success' && (
        <span className="burst" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: decorative sparks, never reordered
            <i key={i} />
          ))}
        </span>
      )}
      {item.kind !== 'info' && (
        <span className="toast-mark">
          <Icon name={item.kind === 'success' ? 'check' : 'warning'} />
        </span>
      )}
      <span className="toast-text">{item.text}</span>
      {item.action && (
        <a className="toast-action" href={item.action.href}>
          {item.action.label} <Icon name="arrow" />
        </a>
      )}
    </div>
  )
}
