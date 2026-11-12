/** Nexo floating over every screen, like a chat head: drag it anywhere, it stays where it was left
 * (this browser only), and a tap opens a conversation above the screen, which stays mounted
 * underneath: about the game on screen when there is one, else the latest. It hides on the
 * conversation page itself. */
import {
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useLocation, useNavigate } from 'react-router'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import './nexo-bubble.css'

const messages = defineMessages({
  [Language.PtBR]: { open: 'Falar com o Nexo' },
  [Language.En]: { open: 'Talk to Nexo' },
})

const SIZE = 60
// The gap kept from the window's edges, the same as above a phone's bottom bar.
const MARGIN = 8
// A press that moves less than this is a tap, not a drag.
const DRAG_PX = 5
const KEY = 'platjourney:nexo-bubble'

type Point = { x: number; y: number }

// Where a tap opens Nexo: a screen about one game says so (useNexoTarget), else the latest talk.
const LATEST = '/nexo?resume=latest'
let target: string | null = null
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** While the calling screen is mounted, a tap on the floating Nexo opens `href` (a conversation
 * about the game on screen) instead of the latest one. */
export function useNexoTarget(href: string | null) {
  useEffect(() => {
    target = href
    for (const fn of listeners) fn()
    return () => {
      if (target !== href) return
      target = null
      for (const fn of listeners) fn()
    }
  }, [href])
}

/** The window's width without a scrollbar, so the bubble can reach the visible right edge. */
const width = () => document.documentElement.clientWidth || window.innerWidth

/** How tall a phone's bottom bar is right now (the sidebar becomes it), or 0 on a wide screen. */
function bottomBar(): number {
  if (width() > 760) return 0
  const bar = document.querySelector('.sidebar')?.getBoundingClientRect()
  return bar ? Math.max(0, window.innerHeight - bar.top) : 0
}

/** `point` kept inside the window, clear of the edges and of the `bottom` space (a phone's bar). */
export function clampBubble(point: Point, width: number, height: number, bottom = 0): Point {
  return {
    x: Math.min(Math.max(MARGIN, point.x), Math.max(MARGIN, width - SIZE - MARGIN)),
    y: Math.min(Math.max(MARGIN, point.y), Math.max(MARGIN, height - SIZE - MARGIN - bottom)),
  }
}

function saved(): Point | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return typeof p?.x === 'number' && typeof p?.y === 'number' ? p : null
  } catch {
    return null
  }
}

/** Where it starts: where it was left, or the bottom right corner. */
function start(): Point {
  const p = saved() ?? { x: width(), y: window.innerHeight }
  return clampBubble(p, width(), window.innerHeight, bottomBar())
}

export function NexoBubble({ initial }: { initial?: Point }) {
  const t = useMessages(messages)
  const location = useLocation()
  const navigate = useNavigate()
  const [point, setPoint] = useState<Point>(() => initial ?? start())
  const [dragging, setDragging] = useState(false)
  const href = useSyncExternalStore(subscribe, () => target) ?? LATEST
  const press = useRef<{ dx: number; dy: number; x: number; y: number } | null>(null)
  // A drag ends with a click on the same button: this tells it apart from a tap.
  const dragged = useRef(false)

  const fit = useCallback(
    () => setPoint((p) => clampBubble(p, width(), window.innerHeight, bottomBar())),
    [],
  )
  useEffect(() => {
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [fit])

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragged.current = false
    press.current = { dx: e.clientX - point.x, dy: e.clientY - point.y, x: e.clientX, y: e.clientY }
  }
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const p = press.current
    if (!p) return
    if (!dragged.current && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_PX) return
    dragged.current = true
    setDragging(true)
    setPoint(
      clampBubble(
        { x: e.clientX - p.dx, y: e.clientY - p.dy },
        width(),
        window.innerHeight,
        bottomBar(),
      ),
    )
  }
  const up = () => {
    press.current = null
    setDragging(false)
    if (!dragged.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(point))
    } catch {}
  }
  // A tap, or Enter and Space: the latest conversation, above the screen.
  const open = () => {
    if (dragged.current) {
      dragged.current = false
      return
    }
    navigate(href, { state: { journey: location } })
  }

  if (location.pathname === '/nexo') return null
  return (
    <button
      type="button"
      className={`nexo-bubble${dragging ? ' is-dragging' : ''}`}
      style={{ transform: `translate3d(${point.x}px, ${point.y}px, 0)` }}
      aria-label={t('open')}
      data-tip={t('open')}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClick={open}
    >
      <img src="/nexo-avatar.svg" alt="" width={SIZE} height={SIZE} draggable={false} />
    </button>
  )
}
