import { achievementHistory } from '../../../../shared/journey/history'
import type { GuideDetail, Trophy } from './types'

/** Base and extra-content tracks remain separate. Priority only affects unfinished work. */
export function personalRoadmap(reference: Trophy[], remaining: Trophy[] = []) {
  return [false, true].flatMap((extra) => {
    const track = reference.filter((t) => (t.groupId !== 'default') === extra)
    const history = achievementHistory(track)
    const priority = remaining.filter((t) => !t.earned && track.includes(t))
    const pending = [...priority, ...track.filter((t) => !t.earned && !priority.includes(t))]
    return [...history.dated, ...history.undated, ...pending]
  })
}

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

function ongoingBasis(early: boolean, duration: boolean, repeated: boolean) {
  if (early) return 'early' as const
  if (duration) return 'duration' as const
  if (repeated) return 'repeated' as const
  return 'counter' as const
}

const words = (value: string) =>
  ` ${normalized(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `

function earlyAdvice(trophy: Trophy, trophies: Trophy[], tips: string[]) {
  const names = trophies.flatMap((t) => [t.name, t.nameEn].filter((n): n is string => !!n))
  return tips.find((tip) => {
    const mentioned = names.filter((name) => words(tip).includes(words(name)))
    return mentioned.some(
      (name) =>
        trophyMatches(trophy, name) &&
        trophies.filter((t) => trophyMatches(t, name)).length === 1 &&
        !mentioned.some(
          (longer) => words(longer) !== words(name) && words(longer).includes(words(name)),
        ),
    )
  })
}

/** A conservative view over existing evidence, not a position or completion predictor. */
export function ongoingObjectives(trophies: Trophy[], guide?: GuideDetail | null) {
  const campaignWindow =
    /^(?:durante (?:toda )?a campanha|ao longo (?:de toda )?da campanha|throughout (?:the )?(?:campaign|game)|during (?:the )?campaign)\b/i
  return trophies.flatMap((trophy) => {
    if (
      trophy.earned ||
      trophy.hidden ||
      trophy.type === 'platinum' ||
      trophy.groupId !== 'default'
    )
      return []
    // A name shared by multiple trophies is insufficient evidence for a guide association.
    const unique = (name: string) => trophies.filter((t) => trophyMatches(t, name)).length === 1
    const phases = (guide?.roadmap ?? []).filter((p) =>
      p.trophies.some((name) => trophyMatches(trophy, name) && unique(name)),
    )
    const warning = guide?.missables.find(
      (w) => trophyMatches(trophy, w.trophy) && unique(w.trophy),
    )
    const duration = warning && campaignWindow.test(warning.when.trim()) ? warning : undefined
    const early = earlyAdvice(trophy, trophies, guide?.earlyTips ?? [])
    const counter = trophy.progressTarget != null && trophy.progressTarget > 1
    if (phases.length < 2 && !duration && !counter && !early) return []
    return [
      {
        trophy,
        basis: ongoingBasis(!!early, !!duration, phases.length > 1),
        warning,
        early,
      },
    ]
  })
}
