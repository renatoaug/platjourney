import { q } from '../db.ts'
import { userRef } from './user.ts'

export const EVENT_NAMES = ['screen', 'open', 'search'] as const
export type EventName = (typeof EVENT_NAMES)[number]

/** Something the player did in the app, as the browser reports it. */
export interface AppEvent {
  name: EventName
  target: string
  path: string
  at: Date
}

/** Stores a batch of the player's events in one query. */
export async function saveEvents(user: string, events: AppEvent[]): Promise<void> {
  if (!events.length) return
  await q('INSERT INTO event $rows', {
    rows: events.map((e) => ({
      user: userRef(user),
      name: e.name,
      target: e.target,
      path: e.path,
      created_at: e.at,
    })),
  })
}

/** Events older than 180 days go. */
export async function pruneEvents(): Promise<void> {
  await q('DELETE event WHERE created_at < time::now() - 180d')
}
