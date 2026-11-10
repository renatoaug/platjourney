/**
 * Players' unlock times, kept as they arrive from PSN and read back to say where long trophies
 * usually close (ADR-015). Nothing here blocks a page: a failed write or read only leaves the
 * guide as it was.
 */
import { closingSteps, type PlacedGuide } from '../../../shared/journey/places.ts'
import type { TrophyStatus } from './psn.ts'
import { saveUnlocks, unlocksOn } from './repository/unlock.ts'

// What was already written for a player's list: a page load with nothing new writes nothing.
const saved = new Map<string, number>()

export function keepUnlocks(user: string, np: string, trophies: TrophyStatus[]) {
  const earned = trophies.flatMap((t) =>
    t.earned && t.earnedAt ? [{ id: t.id, earnedAt: t.earnedAt }] : [],
  )
  const key = `${user}|${np}`
  if (!earned.length || saved.get(key) === earned.length) return
  if (saved.size > 20_000) saved.clear()
  saved.set(key, earned.length)
  saveUnlocks(user, np, earned).catch((e) => {
    saved.delete(key)
    console.error('unlocks not kept:', (e as Error).message)
  })
}

// Read back once an hour per list: steps move slowly, as players earn trophies.
const steps = new Map<
  string,
  { at: number; unlocks: Promise<Awaited<ReturnType<typeof unlocksOn>>> }
>()
const TTL = 60 * 60_000

/** The guide with where its long trophies usually close, from the players of this PSN list. */
export async function withPlayerSteps<G extends PlacedGuide>(
  guide: G | null | undefined,
  trophies: TrophyStatus[] | null | undefined,
  np: string | null | undefined,
): Promise<G | null | undefined> {
  if (!guide?.trophyPlaces?.length || !trophies?.length || !np) return guide
  let entry = steps.get(np)
  if (!entry || Date.now() - entry.at > TTL) {
    if (steps.size > 5_000) steps.clear()
    entry = { at: Date.now(), unlocks: unlocksOn(np) }
    steps.set(np, entry)
    entry.unlocks.catch(() => steps.delete(np))
  }
  const unlocks = await entry.unlocks.catch(() => [])
  const found = closingSteps(trophies, unlocks, guide)
  return found.length ? { ...guide, trophySteps: found } : guide
}
