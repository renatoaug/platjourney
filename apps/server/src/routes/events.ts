import { json, readBody } from '../http.ts'
import { type AppEvent, EVENT_NAMES, type EventName, saveEvents } from '../repository/event.ts'
import type { ApiHandler } from './api.ts'

// A batch is what the page gathered since its last send: a few dozen at most.
const MAX_EVENTS = 50
const MAX_TEXT = 120
// The browser's clock may be off, and a batch can wait a while: a time outside the last day, or
// ahead of the server, becomes now.
const DAY_MS = 86_400_000

const text = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : '')

function parse(raw: unknown, now: number): AppEvent | null {
  const e = (raw ?? {}) as Record<string, unknown>
  if (!EVENT_NAMES.includes(e.name as EventName)) return null
  const target = text(e.target)
  const path = text(e.path)
  if (!target || !path.startsWith('/')) return null
  const at = typeof e.at === 'number' && e.at <= now && e.at > now - DAY_MS ? e.at : now
  return { name: e.name as EventName, target, path, at: new Date(at) }
}

// What the player did on screen, sent by the page in batches; anything malformed is left out.
export const EVENT_ROUTES: Record<string, ApiHandler> = {
  'POST /api/events': async ({ req, res, me }) => {
    const { events } = await readBody(req)
    if (!Array.isArray(events)) return json(res, 400, { error: 'events required' })
    const now = Date.now()
    const valid = events
      .slice(0, MAX_EVENTS)
      .map((e) => parse(e, now))
      .filter((e) => e !== null)
    await saveEvents(me.id, valid)
    return json(res, 200, { saved: valid.length })
  },
}
