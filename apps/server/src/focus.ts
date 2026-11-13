// What the player should go after now, from the guide's roadmap and the PSN list. The session
// notice and the trophy notice both use it, so the target a notice names does not change unless
// the player earned it.
//
// The roadmap's phases are an order to play in, not a place the player is: someone who finished
// the story and came back for the side activities has trophies open in several phases at once.
// So nothing here says which phase the player is in. A phase describes trophies: how many are
// left in it, which one the focus belongs to, and when the last one of a phase falls.
import { keyStep } from '../../../shared/journey/graph.ts'
import { nextPlaced, trophyWhen } from '../../../shared/journey/places.ts'
import type { Guide } from './guide.ts'
import type { GameContext } from './nexo.ts'
import type { TrophyStatus } from './psn.ts'

interface PhaseLeft {
  // The phase as the roadmap names it, and its short name ("Fase 1" from "Fase 1 — Campanha").
  phase: string
  short: string
  left: number
}

interface Focus {
  // Base-game trophies still open in each roadmap phase, in the roadmap's order, open ones only.
  phases: PhaseLeft[]
  // The first phase with a trophy open: a missable there first, then a counter almost full (one
  // horde left), from any phase, then the next one in the guide's order. A phase can span half the
  // story, so a trophy with a trick further down it is not something to do now. Trophies the
  // roadmap leaves to a later phase wait for it.
  trophy?: TrophyStatus
  trick?: string
  // The short name of the phase the focus belongs to, and whether the player already has trophies
  // from a later phase: then the focus is something left behind, not the next step.
  phase?: string
  behind?: boolean
  // A missable still open in the focus's phase. One the roadmap plans for later (a New Game+ skill)
  // is not news yet: repeating it in every notice buries the one that matters now.
  missable?: { trophy: string; when: string }
}

// PSN sometimes writes a name with a double space ("Caçador de  Emboscadas"); the guide copies it.
// Compared and shown with single spaces.
export const tidy = (name: string) => name.replace(/\s+/g, ' ').trim()

// A trophy that opens one of the guide's milestones: the story trophy for finishing a chapter.
export function storyTrophy(guide: Pick<Guide, 'milestones'> | undefined, name?: string): boolean {
  if (!name) return false
  const key = tidy(name).toLowerCase()
  return (guide?.milestones ?? []).some((m) => m.after && tidy(m.after).toLowerCase() === key)
}

const shortName = (phase: string) => tidy(phase.split(/\s[—–-]\s/)[0])

// A counter this close to its target is the trophy most likely to fall next, wherever the guide
// places it: what is left is a few kills, not a stretch of the game.
const ALMOST = 0.8

// How full an open counter is, from 0 to 1; undefined when PSN gives no count for it.
function fill(t: TrophyStatus): number | undefined {
  if (!t.progressTarget || t.progressTarget <= 1 || t.progressValue === undefined) return undefined
  return Math.min(t.progressValue / t.progressTarget, 1)
}

// The fullest open counter the roadmap places, when one is almost done. Hidden ones stay out:
// naming them would spoil what the player chose not to see.
function almostFull(roadmap: { trophies: string[] }[], open: Map<string, TrophyStatus>) {
  const best = roadmap
    .flatMap((r) => r.trophies)
    .map((n) => open.get(n))
    .filter((t): t is TrophyStatus => !!t && !t.hidden && (fill(t) ?? 0) >= ALMOST)
    .sort((a, b) => (fill(b) ?? 0) - (fill(a) ?? 0))[0]
  return best && tidy(best.name)
}

// The phase the focus belongs to (the first one open, unless an almost full counter came from
// another), and whether the player already has trophies from a later phase.
function placeOf<R extends { trophies: string[] }>(
  roadmap: R[],
  name: string | undefined,
  at: number,
  earned: Set<string>,
) {
  const owner = name ? roadmap.findIndex((r) => r.trophies.includes(name)) : -1
  const index = owner >= at ? owner : at
  const home = roadmap[index] as R | undefined
  const behind =
    !!home && roadmap.slice(index + 1).some((r) => r.trophies.some((n) => earned.has(n)))
  return { home, behind }
}

/**
 * Where the guide's structure points next: with a graph, the trophy behind the step that opens the
 * most others; with places, the nearest ahead of the player; else the phase's first.
 *
 * A graph only says what a trophy depends on, not when in the game a step comes: a step with nothing
 * before it in the graph ("Radagon e Elden Beast", the last boss) counts as ready from the first
 * minute. So the graph's pick stands only when the roadmap does not leave it to a later phase
 * (`later`); otherwise a player who just started would be sent to an ending.
 */
function along(
  base: TrophyStatus[],
  guide: GameContext['guide'],
  inPhase: string[],
  later: Set<string>,
) {
  const open = base.filter((x) => !x.earned)
  const step = keyStep(base, guide)?.trophy
  const name = step && tidy(step.name)
  const now = name && (inPhase.includes(name) || !later.has(name)) ? step : undefined
  const key = now ?? nextPlaced(open, base, guide)
  return key ? tidy(key.name) : inPhase[0]
}

export function todaysFocus(ctx: Pick<GameContext, 'trophies' | 'guide'>): Focus {
  const base = ctx.trophies.filter((x) => x.groupId === 'default' && x.type !== 'platinum')
  const open = new Map(base.filter((x) => !x.earned).map((x) => [tidy(x.name), x]))
  const earned = new Set(base.filter((x) => x.earned).map((x) => tidy(x.name)))
  const guide = ctx.guide
  const roadmap = (guide?.roadmap ?? []).map((r) => ({
    phase: r.phase,
    trophies: (r.trophies ?? []).map(tidy),
  }))
  const phases = roadmap
    .map((r) => ({
      phase: r.phase,
      short: shortName(r.phase),
      left: r.trophies.filter((n) => open.has(n)).length,
    }))
    .filter((p) => p.left > 0)
  const at = roadmap.findIndex((r) => r.trophies.some((n) => open.has(n)))
  const first = roadmap[at]
  // A trophy the roadmap names again in a later phase ("chapter select") is planned for then: it is
  // not the focus while something else in this phase is open.
  const later = new Set(roadmap.slice(at + 1).flatMap((r) => r.trophies))
  const openHere = first?.trophies.filter((n) => open.has(n)) ?? []
  const forNow = openHere.filter((n) => !later.has(n))
  const inPhase = forNow.length ? forNow : openHere
  const missableNames = new Set((guide?.missables ?? []).map((m) => tidy(m.trophy)))
  const trickFor = (n: string) =>
    guide?.tricks?.find((x) => tidy(x.trophy) === n || x.trophy === open.get(n)?.nameEn)
  // With places in the guide, the next one is the nearest ahead of the player, not the phase's first.
  const name =
    inPhase.find((n) => missableNames.has(n)) ??
    almostFull(roadmap, open) ??
    along(base, guide, inPhase, later)
  const trophy = name ? open.get(name) : undefined
  const { home, behind: phaseBehind } = placeOf(roadmap, name, at, earned)
  // With places in the guide, "left behind" means a later story trophy was earned, not a later phase.
  const placed = trophy ? trophyWhen(trophy, base, guide) : undefined
  const behind = placed ? placed.behind : phaseBehind
  const missables = (guide?.missables ?? []).filter((m) => open.has(tidy(m.trophy)))
  const missable = missables.find((m) => first?.trophies.includes(tidy(m.trophy)))
  return {
    phases,
    ...(trophy ? { trophy: { ...trophy, name: tidy(trophy.name) } } : {}),
    ...(trophy && name && trickFor(name) ? { trick: trickFor(name)?.trick } : {}),
    ...(trophy && home ? { phase: shortName(home.phase), behind } : {}),
    ...(missable ? { missable: { trophy: tidy(missable.trophy), when: missable.when } } : {}),
  }
}

// The focus a trophy notice talks about: the one the player had before these unlocks stays, unless
// one of them was it; then the next one by the same rule is new. Every phase whose last open trophy
// is among these unlocks is `completed`, in the roadmap's order: one sweep can close two (a trophy
// the roadmap lists in both, or several unlocks synced together), and naming only the first made
// the next notice look like it skipped a phase.
export function focusAfter(
  ctx: Pick<GameContext, 'trophies' | 'guide'>,
  unlocked: TrophyStatus[],
): Focus & { changed: boolean; completed?: string[] } {
  const ids = new Set(unlocked.map((t) => t.id))
  const before = todaysFocus({
    ...ctx,
    trophies: ctx.trophies.map((t) => (ids.has(t.id) ? { ...t, earned: false } : t)),
  })
  const now = todaysFocus(ctx)
  const still = new Set(now.phases.map((p) => p.phase))
  const completed = before.phases.filter((p) => !still.has(p.phase)).map((p) => p.short)
  return {
    ...now,
    changed: before.trophy?.name !== now.trophy?.name,
    ...(completed.length ? { completed } : {}),
  }
}
