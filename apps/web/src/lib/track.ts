/** What the player does on screen, for the operator: the screens opened, the sections expanded and
 * the searches. Kept in the app's own database (POST /api/events), never sent anywhere else; the
 * demo sends nothing. Events wait in a queue and go in batches. */

type EventName = 'screen' | 'open' | 'search'
interface QueuedEvent {
  name: EventName
  target: string
  path: string
  at: number
}

const FLUSH_MS = 15_000
const MAX_QUEUE = 50
let queue: QueuedEvent[] = []
let on = false
let timer: ReturnType<typeof setInterval> | undefined

/** Sends what is queued. On the way out of the page only a beacon survives, so that is preferred. */
function flush(): void {
  if (!queue.length) return
  const body = JSON.stringify({ events: queue })
  queue = []
  const blob = new Blob([body], { type: 'application/json' })
  if (navigator.sendBeacon?.('/api/events', blob)) return
  fetch('/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}

/** Queues one event; a full queue goes right away. Does nothing until tracking is on. */
export function track(name: EventName, target: string): void {
  if (!on || !target) return
  queue.push({ name, target, path: location.pathname, at: Date.now() })
  if (queue.length >= MAX_QUEUE) flush()
}

// A section opened: its name from data-track, or the hook the page already gives it, or its class.
function sectionName(el: HTMLElement): string {
  return el.dataset.track ?? el.dataset.keyDetail ?? el.className.split(' ')[0] ?? ''
}

function onToggle(e: Event): void {
  const el = e.target
  if (el instanceof HTMLDetailsElement && el.open) track('open', sectionName(el))
}

function onHide(): void {
  if (document.visibilityState === 'hidden') flush()
}

/** Turns tracking on for a signed-in player (not the demo); returns how to turn it off. */
export function startTracking(): () => void {
  on = true
  // `toggle` does not bubble: listened to on the way down.
  document.addEventListener('toggle', onToggle, true)
  document.addEventListener('visibilitychange', onHide)
  timer = setInterval(flush, FLUSH_MS)
  return () => {
    flush()
    on = false
    document.removeEventListener('toggle', onToggle, true)
    document.removeEventListener('visibilitychange', onHide)
    clearInterval(timer)
  }
}
