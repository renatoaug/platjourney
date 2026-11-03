import type { GuideDetail, Trophy } from './types'

const normalized = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

/** Exact localized names only: ambiguous matches stay unplaced instead of inventing an order. */
function trophyMatches(trophy: Trophy, name: string) {
  const key = normalized(name)
  return key !== '' && [trophy.name, trophy.nameEn].some((n) => n && normalized(n) === key)
}

export interface TrophyStage {
  kind: 'phase' | 'unplaced' | 'platinum' | 'dlc'
  name?: string
  trophies: Trophy[]
}

export function trophyRoadmap(trophies: Trophy[], guide?: GuideDetail | null): TrophyStage[] {
  const base = trophies.filter((t) => t.groupId === 'default' && t.type !== 'platinum')
  const placed = new Set<Trophy>()
  const stages: TrophyStage[] = []
  for (const phase of guide?.roadmap ?? []) {
    const items: Trophy[] = []
    for (const name of phase.trophies) {
      const matches = base.filter((t) => trophyMatches(t, name))
      if (matches.length !== 1 || placed.has(matches[0])) continue
      placed.add(matches[0])
      items.push(matches[0])
    }
    if (items.length) stages.push({ kind: 'phase', name: phase.phase, trophies: items })
  }
  const unplaced = base.filter((t) => !placed.has(t))
  if (unplaced.length) stages.push({ kind: 'unplaced', trophies: unplaced })
  const platinum = trophies.filter((t) => t.groupId === 'default' && t.type === 'platinum')
  if (platinum.length) stages.push({ kind: 'platinum', trophies: platinum })
  const dlc = trophies.filter((t) => t.groupId !== 'default')
  if (dlc.length) stages.push({ kind: 'dlc', trophies: dlc })
  return stages
}

export function trophyAdvice(trophy: Trophy, guide?: GuideDetail | null) {
  return {
    trick: guide?.tricks?.find((x) => trophyMatches(trophy, x.trophy))?.trick,
    warning: guide?.missables.find((x) => trophyMatches(trophy, x.trophy)),
    online: guide?.onlineTrophies.find((x) => trophyMatches(trophy, x.trophy)),
    bug: guide?.buggy?.find((x) => trophyMatches(trophy, x.trophy)),
  }
}
