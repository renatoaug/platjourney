// What the player should go after now, from the guide's roadmap and the PSN list. The session
// notice and the trophy notice both use it, so the target a notice names does not change unless
// the player earned it.
//
// The roadmap's phases are an order to play in, not a place the player is: someone who finished
// the story and came back for the side activities has trophies open in several phases at once.
// So nothing here says which phase the player is in. A phase describes trophies: how many are
// left in it, which one the focus belongs to, and when the last one of a phase falls.
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
  // The first phase with a trophy open: a missable there first, then a trophy the guide has a
  // trick for, then the next one in order (story trophies come by themselves and say little).
  // Trophies the roadmap leaves to a later phase wait for it.
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

const shortName = (phase: string) => tidy(phase.split(/\s[—–-]\s/)[0])

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
  const name =
    inPhase.find((n) => missableNames.has(n)) ?? inPhase.find((n) => trickFor(n)) ?? inPhase[0]
  const trophy = name ? open.get(name) : undefined
  const behind = !!first && roadmap.slice(at + 1).some((r) => r.trophies.some((n) => earned.has(n)))
  const missables = (guide?.missables ?? []).filter((m) => open.has(tidy(m.trophy)))
  const missable = missables.find((m) => first?.trophies.includes(tidy(m.trophy)))
  return {
    phases,
    ...(trophy ? { trophy: { ...trophy, name: tidy(trophy.name) } } : {}),
    ...(trophy && name && trickFor(name) ? { trick: trickFor(name)?.trick } : {}),
    ...(trophy && first ? { phase: shortName(first.phase), behind } : {}),
    ...(missable ? { missable: { trophy: tidy(missable.trophy), when: missable.when } } : {}),
  }
}

// The focus a trophy notice talks about: the one the player had before these unlocks stays, unless
// one of them was it; then the next one by the same rule is new. A phase whose last open trophy is
// among these unlocks is `completed`.
export function focusAfter(
  ctx: Pick<GameContext, 'trophies' | 'guide'>,
  unlocked: TrophyStatus[],
): Focus & { changed: boolean; completed?: string } {
  const ids = new Set(unlocked.map((t) => t.id))
  const before = todaysFocus({
    ...ctx,
    trophies: ctx.trophies.map((t) => (ids.has(t.id) ? { ...t, earned: false } : t)),
  })
  const now = todaysFocus(ctx)
  const still = new Set(now.phases.map((p) => p.phase))
  const completed = before.phases.find((p) => !still.has(p.phase))?.short
  return {
    ...now,
    changed: before.trophy?.name !== now.trophy?.name,
    ...(completed ? { completed } : {}),
  }
}
