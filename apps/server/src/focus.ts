// What the player should go after now, from the guide's roadmap and the PSN list. The session
// notice and the trophy notice both use it, so the target a notice names does not change unless
// the player earned it.
import type { GameContext } from './nexo.ts'
import type { TrophyStatus } from './psn.ts'

export interface Focus {
  // The roadmap phase the player is in: the first one with a base-game trophy still open.
  phase?: string
  // In that phase, a missable first, then a trophy the guide has a trick for, then the next one in
  // order (story trophies come by themselves and say little).
  trophy?: TrophyStatus
  trick?: string
  // A missable still open, the one in this phase first.
  missable?: { trophy: string; when: string }
}

export function todaysFocus(ctx: Pick<GameContext, 'trophies' | 'guide'>): Focus {
  const missing = ctx.trophies.filter(
    (x) => !x.earned && x.groupId === 'default' && x.type !== 'platinum',
  )
  const open = new Map(missing.map((x) => [x.name, x]))
  const guide = ctx.guide
  const phase = guide?.roadmap?.find((r) => r.trophies?.some((n) => open.has(n)))
  const inPhase = phase?.trophies.filter((n) => open.has(n)) ?? []
  const missableNames = new Set((guide?.missables ?? []).map((m) => m.trophy))
  const trickFor = (n: string) =>
    guide?.tricks?.find((x) => x.trophy === n || x.trophy === open.get(n)?.nameEn)
  const name =
    inPhase.find((n) => missableNames.has(n)) ?? inPhase.find((n) => trickFor(n)) ?? inPhase[0]
  const trophy = name ? open.get(name) : undefined
  const missables = (guide?.missables ?? []).filter((m) => open.has(m.trophy))
  const missable = missables.find((m) => phase?.trophies.includes(m.trophy)) ?? missables[0]
  return {
    ...(phase ? { phase: phase.phase } : {}),
    ...(trophy ? { trophy } : {}),
    ...(trophy && trickFor(trophy.name) ? { trick: trickFor(trophy.name)?.trick } : {}),
    ...(missable ? { missable: { trophy: missable.trophy, when: missable.when } } : {}),
  }
}

// The focus a trophy notice talks about: the one the player had before these unlocks stays, unless
// one of them was it; then the next one by the same rule is new.
export function focusAfter(
  ctx: Pick<GameContext, 'trophies' | 'guide'>,
  unlocked: TrophyStatus[],
): Focus & { changed: boolean } {
  const ids = new Set(unlocked.map((t) => t.id))
  const before = todaysFocus({
    ...ctx,
    trophies: ctx.trophies.map((t) => (ids.has(t.id) ? { ...t, earned: false } : t)),
  })
  const now = todaysFocus(ctx)
  return { ...now, changed: before.trophy?.name !== now.trophy?.name }
}
