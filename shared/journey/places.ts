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
  // `free` when the steps can be played in any order (bosses, worlds, regions): the player's place is
  // how many of them they have done, and nothing they skipped is ever behind them.
  order?: 'free' | null
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
  // A model's estimate of where each trophy without a single moment falls, stored with the guide by
  // the AI service: the prior before players say otherwise (ADR-017).
  predictedSteps?: PredictedStep[] | null
}

/** Where a model expects a trophy to fall, from the guide and the trophy's text (ADR-017). */
interface PredictedStep {
  trophy: string
  step: number
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
  // PSN's share of the game's players who earned it, for a trophy nothing else places.
  earnedRate?: number | null
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

const free = (g: PlacedGuide) => g.storyline?.order === 'free'

/** The model's estimate for a trophy, used only when players have not said yet. */
function predictedStep(t: PlacedTrophy, guide: PlacedGuide) {
  return guide.predictedSteps?.find((s) => trophyMatches(t, s.trophy))?.step
}

/** Where players usually earned a trophy the guide gives no moment for, when enough of them did. */
export function usualStep(t: PlacedTrophy, guide?: PlacedGuide | null) {
  return guide?.trophySteps?.find((s) => trophyMatches(t, s.trophy) && s.players >= MIN_PLAYERS)
}

/**
 * Without players, where a trophy the guide does not place probably falls: at the story trophy
 * whose share of players (PSN rarity) is closest, as fewer players reach later moments. Without a
 * rarity (PSN sends 0 for unknown), after the story.
 */
function rarityStep<T extends PlacedTrophy>(
  trophy: T,
  trophies: T[],
  guide: PlacedGuide & { storyline: Storyline },
) {
  const after = guide.storyline.total + 1
  const rate = trophy.earnedRate
  // PSN sends 0 when it does not know the share.
  if (!rate || rate <= 0) return after
  let best: { step: number; gap: number } | undefined
  for (const t of trophies) {
    if (t === trophy || !t.earnedRate || t.groupId !== 'default' || t.type === 'platinum') continue
    const place = placeOf(t, trophies, guide)
    if (!place || keepsGoing(t, place, guide)) continue
    const gap = Math.abs(t.earnedRate - rate)
    if (!best || gap < best.gap) best = { step: place.from, gap }
  }
  return best?.step ?? after
}

/** A trophy that keeps going: a range in the guide, a grind, or a PSN counter. */
function keepsGoing(t: PlacedTrophy, place: TrophyPlace, guide: PlacedGuide) {
  const kind = guide.trophyKinds?.find((k) => trophyMatches(t, k.trophy))?.kind
  return (place.to !== undefined && place.to > place.from) || kind === 'grind' || counter(t)
}

/**
 * The furthest step the player's earned trophies point to; in a game of free order, how many steps
 * they have done. Only trophies of a single moment count: a count can close anywhere, so it says
 * nothing about where the player is.
 */
export function playerStep<T extends PlacedTrophy>(trophies: T[], guide?: PlacedGuide | null) {
  if (!usable(guide)) return undefined
  const steps = trophies.flatMap((t) => {
    if (!t.earned || t.groupId !== 'default' || t.type === 'platinum') return []
    const place = placeOf(t, trophies, guide)
    return place && !keepsGoing(t, place, guide) ? [place.from] : []
  })
  if (!steps.length) return undefined
  return free(guide) ? new Set(steps).size : Math.max(...steps)
}

/**
 * Where an open trophy is expected to fall, the step the route orders it by (ADR-016). One of a
 * single moment: where it unlocks. One that keeps going: where its counter, at the pace so far,
 * reaches the target, never before the player nor its own start, and after the story when the pace
 * would not close it in time. Without a pace: where players usually earned it, else halfway through
 * the guide's range, else its start. One the guide does not place: where players usually earned it,
 * else by its rarity. Before players, a model's estimate stands in for halfway and for the rarity
 * (ADR-017). Undefined only when the guide places nothing.
 */
export function expectedStep<T extends PlacedTrophy>(
  trophy: T,
  trophies: T[],
  guide: PlacedGuide | null | undefined,
  at: number | undefined,
) {
  if (!usable(guide)) return undefined
  const place = placeOf(trophy, trophies, guide)
  const usual = usualStep(trophy, guide)?.step ?? predictedStep(trophy, guide)
  if (!place) return Math.max(usual ?? rarityStep(trophy, trophies, guide), at ?? 0)
  if (!keepsGoing(trophy, place, guide)) return place.from
  const value = trophy.progressValue ?? 0
  const target = trophy.progressTarget ?? 0
  if (at === undefined || at < place.from || value <= 0 || target <= 1) {
    const middle =
      place.to === undefined
        ? place.from
        : Math.round((place.from + Math.min(place.to, guide.storyline.total + 1)) / 2)
    return Math.max(usual ?? middle, place.from, at ?? 0)
  }
  const pace = value / (at - place.from + 1)
  const projected = at + Math.ceil((target - value) / pace)
  return Math.min(Math.max(projected, at, place.from), guide.storyline.total + 1)
}

/** The open trophies in the order they are expected to fall (`expectedStep`). */
export function placedOrder<T extends PlacedTrophy>(
  open: T[],
  trophies: T[],
  guide?: PlacedGuide | null,
) {
  if (!usable(guide)) return open
  const at = playerStep(trophies, guide)
  const keyed = open.map((t, i) => {
    const place = placeOf(t, trophies, guide)
    // At the same step, a trophy of that moment comes first: a count closes around it.
    const rank = !place ? 2 : keepsGoing(t, place, guide) ? 1 : 0
    return { t, i, step: expectedStep(t, trophies, guide, at) ?? 0, rank }
  })
  return keyed.sort((a, b) => a.step - b.step || a.rank - b.rank || a.i - b.i).map((k) => k.t)
}

/**
 * The next trophy ahead of the player: the first expected at or after their step, else the first
 * left behind. In a game of free order nothing is behind: the first in the route. Undefined when the
 * guide places nothing.
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
  if (free(guide)) return placed[0]
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
    total: guide.storyline.total,
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
    // In a game of free order a step the player skipped is still ahead of them.
    behind: !keeps && !free(guide) && at !== undefined && place.from < at,
  }
}

export interface Unlock {
  user: string
  trophyId: number
  at: string
}

/** The trophies the guide places at a single moment: their step by id. */
function momentSteps<T extends PlacedTrophy & { id: number }>(
  base: T[],
  trophies: T[],
  guide: PlacedGuide,
) {
  const moment = new Map<number, number>()
  for (const t of base) {
    const place = placeOf(t, trophies, guide)
    if (place && !keepsGoing(t, place, guide)) moment.set(t.id, place.from)
  }
  return moment
}

type Mark = { at: number; step: number }

const time = (u: Unlock) => Date.parse(u.at)

/**
 * A player's story trophies in time, each no earlier in the story than the one before. In a game of
 * free order a mark is how many steps the player had done by then.
 */
function marksOf(list: Unlock[], moment: Map<number, number>, inAnyOrder: boolean) {
  const marks: Mark[] = []
  const done = new Set<number>()
  for (const u of list) {
    const step = moment.get(u.trophyId)
    if (step === undefined) continue
    if (inAnyOrder) {
      if (done.has(step)) continue
      done.add(step)
      marks.push({ at: time(u), step: done.size })
    } else if (step >= (marks.at(-1)?.step ?? 0)) marks.push({ at: time(u), step })
  }
  return marks
}

/**
 * Where a player was at a moment: between two marks in proportion to the time, before the first
 * growing from 0 (the start of the game) since their first unlock, after the last one that ends the
 * story past the story.
 */
function stepAt(at: number, marks: Mark[], start: number, total: number) {
  const next = marks.findIndex((m) => m.at > at)
  const last = marks[marks.length - 1]
  if (next === -1) return last.step >= total ? total + 1 : last.step
  const prev = next ? marks[next - 1] : { at: start, step: 0 }
  const span = marks[next].at - prev.at
  return prev.step + (span > 0 ? ((at - prev.at) / span) * (marks[next].step - prev.step) : 0)
}

/** One player's unlocks: where they were at each trophy without a moment of its own. A player with
 * no story trophy says nothing. */
function stepsOfPlayer(
  list: Unlock[],
  moment: Map<number, number>,
  total: number,
  steps: Map<number, number[]>,
  inAnyOrder: boolean,
) {
  list.sort((a, b) => time(a) - time(b))
  const marks = marksOf(list, moment, inAnyOrder)
  if (!marks.length) return
  const start = time(list[0])
  for (const u of list) {
    if (moment.has(u.trophyId)) continue
    const step = stepAt(time(u), marks, start, total)
    steps.set(u.trophyId, [...(steps.get(u.trophyId) ?? []), step])
  }
}

/**
 * Where players earned each trophy the guide gives no single moment for (a count, a collection, a
 * trophy it does not place), from their unlock times: the median over the players who earned it,
 * rounded to a step (ADR-015, ADR-016).
 */
export function closingSteps<T extends PlacedTrophy & { id: number }>(
  trophies: T[],
  unlocks: Unlock[],
  guide?: PlacedGuide | null,
): PlayerStep[] {
  if (!usable(guide)) return []
  const base = trophies.filter((t) => t.groupId === 'default' && t.type !== 'platinum')
  const byId = new Map(base.map((t) => [t.id, t]))
  const moment = momentSteps(base, trophies, guide)
  const users = new Map<string, Unlock[]>()
  for (const u of unlocks)
    if (byId.has(u.trophyId)) users.set(u.user, [...(users.get(u.user) ?? []), u])
  const steps = new Map<number, number[]>()
  for (const list of users.values())
    stepsOfPlayer(list, moment, guide.storyline.total, steps, free(guide))
  return [...steps].map(([id, list]) => {
    const sorted = list.sort((a, b) => a - b)
    const mid = sorted.length / 2
    const median = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2
    return { trophy: byId.get(id)?.name ?? '', step: Math.round(median), players: sorted.length }
  })
}
