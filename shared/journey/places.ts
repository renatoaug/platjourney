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

export interface Storyline {
  // What one step of the game is called ("Missão", "Capítulo") and how many there are.
  unit: string
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

export interface PlacedGuide {
  storyline?: Storyline | null
  trophyPlaces?: TrophyPlace[] | null
  trophyKinds?: { trophy: string; kind: 'natural' | 'hunt' | 'grind' }[] | null
}

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
  !!g?.storyline && g.storyline.total > 0 && !!g.trophyPlaces?.length

/** The guide's place for a trophy, matched by a name no other trophy of the list shares. */
function placeOf<T extends PlacedTrophy>(trophy: T, trophies: T[], guide?: PlacedGuide | null) {
  return guide?.trophyPlaces?.find(
    (p) =>
      trophyMatches(trophy, p.trophy) &&
      trophies.filter((t) => trophyMatches(t, p.trophy)).length === 1,
  )
}

const counter = (t: PlacedTrophy) => (t.progressTarget ?? 0) > 1

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
 * a pace yet, the guide's end.
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
  const end = place.to ?? place.from
  const value = trophy.progressValue ?? 0
  const target = trophy.progressTarget ?? 0
  if (at === undefined || at < place.from || value <= 0 || target <= 1)
    return Math.max(end, at ?? 0)
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
