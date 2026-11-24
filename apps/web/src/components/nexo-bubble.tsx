/** Nexo floating over every screen, like a chat head: drag it anywhere, it stays where it was left
 * (this browser only), and a tap opens a conversation above the screen, which stays mounted
 * underneath: about the game on screen when there is one, else the latest. It hides on the
 * conversation page itself. When Nexo wrote while the player was away (an answer it owed), it
 * calls for attention: a count, a soft pulse and, once per message, a note beside it with how the
 * message starts. A tap then opens that conversation, and opening it is what clears the call. */
import {
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { tick } from '../lib/native'
import type { NexoNews } from '../lib/types'
import { Icon } from '../ui/icon'
import './nexo-bubble.css'
import { BuddyAvatar } from './buddy-avatar'

const messages = defineMessages({
  [Language.PtBR]: {
    open: 'Falar com o Nexo',
    news: { one: 'O Nexo tem uma mensagem nova', other: 'O Nexo tem {count} mensagens novas' },
    closeNote: 'Fechar aviso',
  },
  [Language.En]: {
    open: 'Talk to Nexo',
    news: { one: 'Nexo has a new message', other: 'Nexo has {count} new messages' },
    closeNote: 'Close note',
  },
})

const SIZE = 60
// The gap kept from the window's edges; above a phone's bottom bar it sits right on its edge.
const MARGIN = 8
const BAR_GAP = 4
// A press that moves less than this is a tap, not a drag.
const DRAG_PX = 5
const KEY = 'platjourney:nexo-bubble'
// The note beside Nexo shows once per message: the last one this browser already showed.
const NOTED = 'platjourney:nexo-noted'
const NOTE_MS = 8000
// The note says how the message starts, in one short line.
const NOTE_CHARS = 90

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

/** The conversation a message from Nexo is in: its game's (by the PSN list when the player has
 * it), else the one without a game. */
export function newsHref(news: NexoNews): string {
  const { game, np, name } = news.latest
  if (!game) return '/nexo?history=none'
  return `/nexo?game=${encodeURIComponent(np ?? game)}&name=${encodeURIComponent(name ?? '')}`
}

/** The first line of a message, without its markdown, short enough for the note. */
export function noteText(content: string): string {
  const line =
    content
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_`#>]/g, '')
      .split('\n')
      .map((l) => l.trim())
      .find(Boolean) ?? ''
  return line.length > NOTE_CHARS ? `${line.slice(0, NOTE_CHARS - 1).trimEnd()}…` : line
}

function noted(): string | null {
  try {
    return localStorage.getItem(NOTED)
  } catch {
    return null
  }
}

/** The window's width without a scrollbar, so the bubble can reach the visible right edge. */
const width = () => document.documentElement.clientWidth || window.innerWidth

/** How tall a phone's bottom bar is right now (the sidebar becomes it), or 0 on a wide screen. */
function bottomBar(): number {
  if (width() > 760) return 0
  const bar = document.querySelector('.sidebar')?.getBoundingClientRect()
  return bar ? Math.max(0, window.innerHeight - bar.top) : 0
}

/** `point` kept inside the window, clear of the edges and of the `bottom` space (a phone's bar),
 * whose top edge it may sit right on. */
export function clampBubble(point: Point, width: number, height: number, bottom = 0): Point {
  const floor = bottom ? height - SIZE - BAR_GAP - bottom : height - SIZE - MARGIN
  return {
    x: Math.min(Math.max(MARGIN, point.x), Math.max(MARGIN, width - SIZE - MARGIN)),
    y: Math.min(Math.max(MARGIN, point.y), Math.max(MARGIN, floor)),
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
  const { data, cache } = useApp()
  const news = data?.nexo ?? null
  const [point, setPoint] = useState<Point>(() => initial ?? start())
  const [dragging, setDragging] = useState(false)
  // Pressed, before or while dragging: Nexo grows and glows under the finger.
  const [held, setHeld] = useState(false)
  const screenHref = useSyncExternalStore(subscribe, () => target) ?? LATEST
  // A message waiting takes the tap to its conversation, whatever the screen is about.
  const href = news ? newsHref(news) : screenHref
  // The note shows once per message, and leaves after a while or when closed.
  const [noteFor, setNoteFor] = useState<string | null>(() => noted())
  const note = news && noteFor !== news.latest.created_at ? news : null
  const closeNote = useCallback(() => {
    if (!news) return
    setNoteFor(news.latest.created_at)
    try {
      localStorage.setItem(NOTED, news.latest.created_at)
    } catch {}
  }, [news])
  useEffect(() => {
    if (!note) return
    const timer = setTimeout(closeNote, NOTE_MS)
    return () => clearTimeout(timer)
  }, [note, closeNote])
  const press = useRef<{ dx: number; dy: number; x: number; y: number } | null>(null)
  // A drag ends with a click on the same button: this tells it apart from a tap.
  const dragged = useRef(false)
  const button = useRef<HTMLButtonElement>(null)

  const fit = useCallback(
    () => setPoint((p) => clampBubble(p, width(), window.innerHeight, bottomBar())),
    [],
  )
  // The first place is worked out before the shell's bottom bar is on screen, so it lay over the
  // bar while a drag stopped above it: fit again once the bar is there, and whenever it changes.
  useEffect(() => {
    window.addEventListener('resize', fit)
    const frame = requestAnimationFrame(fit)
    const bar = document.querySelector('.sidebar')
    const watch = bar && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    if (bar) watch?.observe(bar)
    return () => {
      window.removeEventListener('resize', fit)
      cancelAnimationFrame(frame)
      watch?.disconnect()
    }
  }, [fit])

  // iOS scrolls the page under a finger dragging the bubble, whatever its touch-action says: at the
  // end of the page the bounce lifted the whole screen, Nexo with it, so the drag stopped short of
  // the bottom bar and Nexo dropped into place on release. While held, the page stays still.
  useEffect(() => {
    const el = button.current
    if (!el) return
    const still = (e: TouchEvent) => {
      if (press.current) e.preventDefault()
    }
    el.addEventListener('touchmove', still, { passive: false })
    return () => el.removeEventListener('touchmove', still)
  })

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragged.current = false
    setHeld(true)
    press.current = { dx: e.clientX - point.x, dy: e.clientY - point.y, x: e.clientX, y: e.clientY }
  }
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const p = press.current
    if (!p) return
    if (!dragged.current && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_PX) return
    // A short tap of the phone as Nexo comes loose.
    if (!dragged.current) tick()
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
    setHeld(false)
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
    go()
  }
  const go = () => {
    // The conversation kept in the app's cache is from before the message: it is read again.
    if (news) {
      const chats = cache.chats as Record<string, unknown> | undefined
      if (chats) delete chats[news.latest.game ?? 'none']
      closeNote()
    }
    // The conversation lights up the message it opens for.
    navigate(href, { state: { journey: location, fresh: news?.latest.content } })
  }

  if (location.pathname === '/nexo') return null
  return (
    <>
      {note && <NexoNote news={note} point={point} onOpen={go} onClose={closeNote} />}
      <button
        ref={button}
        type="button"
        className={`nexo-bubble${held ? ' is-held' : ''}${dragging ? ' is-dragging' : ''}${news ? ' is-calling' : ''}`}
        data-no-pull
        style={{ transform: `translate3d(${point.x}px, ${point.y}px, 0)` }}
        aria-label={news ? t('news', { count: news.count }) : t('open')}
        data-tip={news ? t('news', { count: news.count }) : t('open')}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={open}
      >
        <BuddyAvatar width={SIZE} height={SIZE} />
        {news && (
          <span className="nexo-bubble-badge" aria-hidden="true">
            {news.count > 9 ? '9+' : news.count}
          </span>
        )}
      </button>
    </>
  )
}

/** Beside Nexo, on the side with more room: whose conversation it is and how the message starts. */
function NexoNote({
  news,
  point,
  onOpen,
  onClose,
}: {
  news: NexoNews
  point: Point
  onOpen: () => void
  onClose: () => void
}) {
  const t = useMessages(messages)
  const left = point.x + SIZE / 2 > width() / 2
  const place = left
    ? { right: width() - point.x + 10, top: point.y + SIZE / 2 }
    : { left: point.x + SIZE + 10, top: point.y + SIZE / 2 }
  return (
    <div className={`nexo-bubble-note${left ? ' is-left' : ''}`} role="status" style={place}>
      <button type="button" className="nexo-bubble-note-open" onClick={onOpen}>
        {news.latest.name && <b>{news.latest.name}</b>}
        <span>{noteText(news.latest.content)}</span>
      </button>
      <button
        type="button"
        className="nexo-bubble-note-close"
        aria-label={t('closeNote')}
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
    </div>
  )
}
