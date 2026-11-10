/**
 * Where each trophy sits along the game, when the guide says (`storyline` and `trophyPlaces`): the
 * map orders what is left by it and the suggestion is the next one ahead of the player. A trophy
 * that comes at a moment sits where it unlocks; one that keeps going (a count, a collection) sits
 * where it is expected to close, projected from its PSN counter. Guides without places keep the
 * roadmap's order.
 *
 * The player's place is an estimate from the trophies they earned, never a claim about their save.
 */
import { trophyMatches } from './ongoing'

const UNITS = ['mission', 'chapter', 'episode', 'act', 'level'] as const
export type StoryUnit = (typeof UNITS)[number]

export interface Storyline {
  // What one step of the game is (the app names it in the player's language) and how many there are.
  unit: StoryUnit
  total: number
}

export interface TrophyPlace {
  trophy: string
  // The step where it unlocks, or where it can first be worked on when it keeps going.
  from: number
  // When it keeps going: the step by which a normal run closes it. A step past `total` is after the
  // story (mission select, free roam).
  to?: number
}

/** Where players who earned a long trophy were in the campaign when it closed (ADR-015). */
export interface PlayerStep {
  trophy: string
  step: number
  players: number
}

export interface PlacedGuide {
  storyline?: Storyline | null
  trophyPlaces?: TrophyPlace[] | null
  trophyKinds?: { trophy: string; kind: 'natural' | 'hunt' | 'grind' }[] | null
  // Worked out from players' unlock times, never stored in the guide.
  trophySteps?: PlayerStep[] | null
}

// Fewer players than this never set where a trophy closes: one offline sync could move it.
const MIN_PLAYERS = 3

export interface PlacedTrophy {
  name: string
  nameEn?: string
  earned: boolean
  type: string
  groupId: string
  progressValue?: number | null
  progressTarget?: number | null
}

const usable = (g?: PlacedGuide | null): g is PlacedGuide & { storyline: Storyline } =>
  !!g?.storyline &&
  g.storyline.total > 0 &&
  // A unit the app cannot name (an old or hand-written guide) leaves the guide unplaced.
  (UNITS as readonly string[]).includes(g.storyline.unit) &&
  !!g.trophyPlaces?.length

/** The guide's place for a trophy, matched by a name no other trophy of the list shares. */
function placeOf<T extends PlacedTrophy>(trophy: T, trophies: T[], guide?: PlacedGuide | null) {
  return guide?.trophyPlaces?.find(
    (p) =>
      trophyMatches(trophy, p.trophy) &&
      trophies.filter((t) => trophyMatches(t, p.trophy)).length === 1,
  )
}

const counter = (t: PlacedTrophy) => (t.progressTarget ?? 0) > 1

/** Where players usually closed a long trophy, when enough of them did. */
function usualStep(t: PlacedTrophy, guide: PlacedGuide) {
  return guide.trophySteps?.find((s) => trophyMatches(t, s.trophy) && s.players >= MIN_PLAYERS)
}

/** A trophy that keeps going: a range in the guide, a grind, or a PSN counter. */
function keepsGoing(t: PlacedTrophy, place: TrophyPlace, guide: PlacedGuide) {
  const kind = guide.trophyKinds?.find((k) => trophyMatches(t, k.trophy))?.kind
  return (place.to !== undefined && place.to > place.from) || kind === 'grind' || counter(t)
}

/**
 * The furthest step the player's earned trophies point to. Only trophies of a single moment count:
 * a count can close anywhere, so it says nothing about where the player is.
 */
export function playerStep<T extends PlacedTrophy>(trophies: T[], guide?: PlacedGuide | null) {
  if (!usable(guide)) return undefined
  const steps = trophies.flatMap((t) => {
    if (!t.earned || t.groupId !== 'default' || t.type === 'platinum') return []
    const place = placeOf(t, trophies, guide)
    return place && !keepsGoing(t, place, guide) ? [place.from] : []
  })
  return steps.length ? Math.max(...steps) : undefined
}

/**
 * Where an open trophy is expected to fall. One of a single moment: where it unlocks. One that keeps
 * going: where its counter, at the pace so far, reaches the target, never before the player nor
 * its own start, and after the story when the pace would not close it in time. Without a counter or
 * a pace yet, the guide's end, or undefined when the guide only gives its start.
 */
export function expectedStep<T extends PlacedTrophy>(
  trophy: T,
  trophies: T[],
  guide: PlacedGuide | null | undefined,
  at: number | undefined,
) {
  if (!usable(guide)) return undefined
  const place = placeOf(trophy, trophies, guide)
  if (!place) return undefined
  if (!keepsGoing(trophy, place, guide)) return place.from
  const value = trophy.progressValue ?? 0
  const target = trophy.progressTarget ?? 0
  // Without a pace, the guide's end; a guide that only says where it starts does not say where it
  // falls, so the trophy does not order the route (it keeps its spot, as an unplaced one).
  if (at === undefined || at < place.from || value <= 0 || target <= 1) {
    const end = place.to ?? usualStep(trophy, guide)?.step
    return end === undefined ? undefined : Math.max(end, at ?? 0)
  }
  const pace = value / (at - place.from + 1)
  const projected = at + Math.ceil((target - value) / pace)
  return Math.min(Math.max(projected, at, place.from), guide.storyline.total + 1)
}

/**
 * The open trophies in the order they are expected to fall. One the guide does not place keeps its
 * spot after the placed trophy before it in `trophies`, so a partial list never reshuffles it.
 */
export function placedOrder<T extends PlacedTrophy>(
  open: T[],
  trophies: T[],
  guide?: PlacedGuide | null,
) {
  if (!usable(guide)) return open
  const at = playerStep(trophies, guide)
  let last = 0
  const keyed = open.map((t, i) => {
    const step = expectedStep(t, trophies, guide, at)
    if (step !== undefined) last = step
    const place = placeOf(t, trophies, guide)
    // At the same step, a trophy of that moment comes first: a count closes around it.
    const rank = !place ? 2 : keepsGoing(t, place, guide) ? 1 : 0
    return { t, i, step: step ?? last, rank }
  })
  return keyed.sort((a, b) => a.step - b.step || a.rank - b.rank || a.i - b.i).map((k) => k.t)
}

/**
 * The next trophy ahead of the player: the first expected at or after their step, else the first
 * left behind. Undefined when the guide places nothing.
 */
export function nextPlaced<T extends PlacedTrophy>(
  open: T[],
  trophies: T[],
  guide?: PlacedGuide | null,
) {
  if (!usable(guide)) return undefined
  const at = playerStep(trophies, guide) ?? 0
  const placed = placedOrder(open, trophies, guide).filter(
    (t) => expectedStep(t, trophies, guide, at || undefined) !== undefined,
  )
  return (
    placed.find((t) => (expectedStep(t, trophies, guide, at || undefined) ?? 0) >= at) ?? placed[0]
  )
}

/**
 * When an open trophy falls, for its advice: its place in the guide, where the player is, where it
 * is expected to fall (for a count, at the pace so far; `late` when not before the story ends), and
 * whether it was left behind. Undefined when the guide does not place it.
 */
export function trophyWhen<T extends PlacedTrophy>(
  trophy: T,
  trophies: T[],
  guide?: PlacedGuide | null,
) {
  if (!usable(guide)) return undefined
  const place = placeOf(trophy, trophies, guide)
  if (!place) return undefined
  const at = playerStep(trophies, guide)
  const expected = expectedStep(trophy, trophies, guide, at) ?? place.from
  const keeps = keepsGoing(trophy, place, guide)
  return {
    unit: guide.storyline.unit,
    from: place.from,
    to: keeps ? (place.to ?? place.from) : undefined,
    // A trophy that keeps going and whose end the guide does not state: where players usually closed
    // it, when enough did, else only where it can start.
    open: keeps && place.to === undefined,
    usually: keeps && place.to === undefined ? usualStep(trophy, guide) : undefined,
    at,
    expected,
    late: expected > guide.storyline.total,
    // The guide writes "after the story" as the step past the last one (the 25th of 24 missions).
    after: keeps && (place.to ?? place.from) > guide.storyline.total,
    behind: !keeps && at !== undefined && place.from < at,
  }
}

export interface Unlock {
  user: string
  trophyId: number
  at: string
}

/** Which placed trophies mark where a player is (step by id) and which keep going. */
function splitPlaced<T extends PlacedTrophy & { id: number }>(
  base: T[],
  trophies: T[],
  guide: PlacedGuide,
) {
  const moment = new Map<number, number>()
  const long = new Set<number>()
  for (const t of base) {
    const place = placeOf(t, trophies, guide)
    if (!place) continue
    if (keepsGoing(t, place, guide)) long.add(t.id)
    else moment.set(t.id, place.from)
  }
  return { moment, long }
}

/** One player's unlocks, in order: where they were as each long trophy closed. */
function stepsOfPlayer(
  list: Unlock[],
  moment: Map<number, number>,
  long: Set<number>,
  steps: Map<number, number[]>,
) {
  // At the same second, the story trophy comes first: the count closed where it happened.
  const first = (u: Unlock) => Number(long.has(u.trophyId))
  list.sort((a, b) => a.at.localeCompare(b.at) || first(a) - first(b))
  let reached = 0
  for (const u of list) {
    const step = moment.get(u.trophyId)
    if (step !== undefined) reached = Math.max(reached, step)
    else if (long.has(u.trophyId) && reached)
      steps.set(u.trophyId, [...(steps.get(u.trophyId) ?? []), reached])
  }
}

/**
 * Where each long trophy closes, from players' unlock times: for each player who earned it, the
 * furthest single-moment trophy they had by then says where they were; the median over players is
 * the trophy's step (ADR-015). A trophy earned before any placed story trophy says nothing.
 */
export function closingSteps<T extends PlacedTrophy & { id: number }>(
  trophies: T[],
  unlocks: Unlock[],
  guide?: PlacedGuide | null,
): PlayerStep[] {
  if (!usable(guide)) return []
  const base = trophies.filter((t) => t.groupId === 'default' && t.type !== 'platinum')
  const byId = new Map(base.map((t) => [t.id, t]))
  const { moment, long } = splitPlaced(base, trophies, guide)
  const users = new Map<string, Unlock[]>()
  for (const u of unlocks)
    if (byId.has(u.trophyId)) users.set(u.user, [...(users.get(u.user) ?? []), u])
  const steps = new Map<number, number[]>()
  for (const list of users.values()) stepsOfPlayer(list, moment, long, steps)
  return [...steps].map(([id, list]) => {
    const sorted = list.sort((a, b) => a - b)
    return {
      trophy: byId.get(id)?.name ?? '',
      step: sorted[Math.floor((sorted.length - 1) / 2)],
      players: sorted.length,
    }
  })
}
