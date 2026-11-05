import { achievementHistory } from '../../../../shared/journey/history'
import type { GuideDetail, Trophy, TrophyKind } from './types'

/** Base and extra-content tracks remain separate. Priority only affects unfinished work, and the
 * platinum closes the route even when PSN dates it with, or before, the trophy that unlocked it. */
export function personalRoadmap(reference: Trophy[], remaining: Trophy[] = []) {
  return [false, true].flatMap((extra) => {
    const track = reference.filter((t) => (t.groupId !== 'default') === extra)
    const history = achievementHistory(track)
    const priority = remaining.filter((t) => !t.earned && track.includes(t))
    const pending = [...priority, ...track.filter((t) => !t.earned && !priority.includes(t))]
    const route = [...history.dated, ...history.undated, ...pending]
    return [
      ...route.filter((t) => t.type !== 'platinum'),
      ...route.filter((t) => t.type === 'platinum'),
    ]
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

/** What a trophy asks of the player, when the guide says. */
export function trophyKind(trophy: Trophy, guide?: GuideDetail | null): TrophyKind | undefined {
  return guide?.trophyKinds?.find((x) => trophyMatches(trophy, x.trophy))?.kind
}

export function trophyAdvice(trophy: Trophy, guide?: GuideDetail | null) {
  return {
    tips: (guide?.milestones ?? []).flatMap((m) =>
      m.tips.filter((tip) => !!tip.trophy && trophyMatches(trophy, tip.trophy)),
    ),
    phase: guide?.roadmap.find((p) => p.trophies.some((name) => trophyMatches(trophy, name))),
    trick: guide?.tricks?.find((x) => trophyMatches(trophy, x.trophy))?.trick,
    warning: guide?.missables.find((x) => trophyMatches(trophy, x.trophy)),
    online: guide?.onlineTrophies.find((x) => trophyMatches(trophy, x.trophy)),
    bug: guide?.buggy?.find((x) => trophyMatches(trophy, x.trophy)),
  }
}

const MAX_MENTIONS = 3

// A step of a phase or a sentence of a tip, on its own. A sentence that leans on the one before it
// ("Isso libera o troféu X.") keeps that one, or it says nothing alone.
function guideSteps(text: string) {
  return text.split(/\n+/).flatMap((line) => {
    const step = line.replace(/^\s*(?:\d+[.)]|[-•])\s*/, '').trim()
    if (!step) return []
    if (/^\s*\d+[.)]/.test(line)) return [step]
    const sentences = step.split(/(?<=[.!?])\s+(?=[\p{Lu}*\d])/u)
    return sentences.map((sentence, i) =>
      i && /^(?:isso|isto|esse|essa|este|esta|assim|this|that|these)\b/i.test(sentence)
        ? `${sentences[i - 1]} ${sentence}`
        : sentence,
    )
  })
}

// Guides write trophy names in bold. A name of several words is also safe in plain text; one word
// alone ("Piedade") is an ordinary word unless it is bold.
function names(step: string, name: string | undefined) {
  if (!name) return false
  const key = normalized(name)
  const bold = [...step.matchAll(/\*\*(.+?)\*\*/g)].some((m) => normalized(m[1]) === key)
  return bold || (key.includes(' ') && words(step).includes(words(name)))
}

const mentions = (step: string, trophy: Trophy) =>
  names(step, trophy.name) || names(step, trophy.nameEn)

/** A phase's goal for the whole phase, without the steps that name a trophy still hidden. */
export function phasePlan(goal: string, trophies: Trophy[]) {
  const hidden = trophies.filter((t) => t.hidden && !t.earned)
  return goal
    .split(/\n+/)
    .filter((line) => !hidden.some((t) => mentions(line, t)))
    .join('\n')
}

/** The guide's steps that name this trophy and no other. */
export function trophyMentions(trophy: Trophy, trophies: Trophy[], guide?: GuideDetail | null) {
  // A step that names another trophy belongs to the phase's plan, not to this trophy's tip.
  const others = trophies.filter((t) => t !== trophy)
  const shared = trophies.some(
    (o) => o !== trophy && (o.name === trophy.name || (!!o.nameEn && o.nameEn === trophy.nameEn)),
  )
  if (shared) return []
  const steps = [
    ...(guide?.roadmap ?? []).flatMap((p) => guideSteps(p.goal)),
    ...(guide?.earlyTips ?? []).flatMap(guideSteps),
    ...guideSteps(guide?.collectibles ?? ''),
    ...(guide?.milestones ?? []).flatMap((m) =>
      m.tips.filter((tip) => !tip.trophy).flatMap((tip) => guideSteps(tip.text)),
    ),
  ]
  return [...new Set(steps)]
    .filter((step) => mentions(step, trophy) && !others.some((t) => mentions(step, t)))
    .slice(0, MAX_MENTIONS)
}

function ongoingBasis(early: boolean, duration: boolean, repeated: boolean, counter: boolean) {
  if (early) return 'early' as const
  if (duration) return 'duration' as const
  if (repeated) return 'repeated' as const
  if (counter) return 'counter' as const
  // Only the guide's kind says so: a grind with no other sign in the guide.
  return 'long' as const
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

/**
 * With the guide's kinds, only what keeps going: a grind always, a hunt only when it is counted (a
 * PSN counter) or lasts the campaign, a natural trophy or a one-off hunt never. Without them, any
 * sign in the guide.
 */
function keepsGoing(
  kind: TrophyKind | undefined,
  sign: { repeated: boolean; duration: boolean; counter: boolean; early: boolean },
) {
  if (kind === 'natural') return false
  if (kind === 'grind') return true
  if (kind === 'hunt') return sign.counter || sign.duration
  return sign.repeated || sign.duration || sign.counter || sign.early
}

/**
 * A conservative view over existing evidence, not a position or completion predictor: what to keep
 * an eye on for a while (collections, counts, spending), not a single moment of the campaign.
 */
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
    // Tips about it in several stretches of the route: a collection picked up along the way.
    const stretches = (guide?.milestones ?? []).filter((m) =>
      m.tips.some((tip) => !!tip.trophy && trophyMatches(trophy, tip.trophy) && unique(tip.trophy)),
    )
    const repeated = phases.length > 1 || stretches.length > 1
    const kind = guide?.trophyKinds?.length ? trophyKind(trophy, guide) : undefined
    if (!keepsGoing(kind, { repeated, duration: !!duration, counter, early: !!early })) return []
    return [
      {
        trophy,
        basis: ongoingBasis(!!early, !!duration, repeated, counter),
        warning,
        early,
      },
    ]
  })
}
