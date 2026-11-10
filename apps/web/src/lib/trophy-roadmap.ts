import { achievementHistory } from '../../../../shared/journey/history'
import {
  normalized,
  ongoingObjectives as ongoing,
  trophyMatches,
  words,
} from '../../../../shared/journey/ongoing'
import { placedOrder } from '../../../../shared/journey/places'
import type { GuideDetail, Trophy, TrophyKind } from './types'

/** Base and extra-content tracks remain separate. Unfinished work keeps the guide's order, or, when
 * the guide places trophies along the game, the order they are expected to fall: a count sits where
 * it should close, not where it starts. The suggestion is marked where it falls, never moved. The
 * platinum closes the route even when PSN dates it with, or before, the trophy that unlocked it. */
export function personalRoadmap(reference: Trophy[], guide?: GuideDetail | null) {
  return [false, true].flatMap((extra) => {
    const track = reference.filter((t) => (t.groupId !== 'default') === extra)
    const history = achievementHistory(track)
    const open = track.filter((t) => !t.earned)
    const pending = extra ? open : placedOrder(open, track, guide)
    const route = [...history.dated, ...history.undated, ...pending]
    return [
      ...route.filter((t) => t.type !== 'platinum'),
      ...route.filter((t) => t.type === 'platinum'),
    ]
  })
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

// A step shared with more trophies than this is a list of what a phase gives, not how to get one.
const MAX_SHARED = 3

// A sentence that points at what came before it ("Isso libera...", "Dica: esses quatro troféus...").
const LEANS =
  /^(?:\*{0,2}(?:dica|aten[çc][ãa]o|nota|tip|note)\*{0,2}:\*{0,2}\s*)?(?:isso|isto|ess[ea]s?|est[ea]s?|aquel[ea]s?|ambos|ambas|assim|this|that|these|those|both)\b/i

// A step of a phase or a sentence of a tip, on its own. A sentence that leans on the one before it
// ("Isso libera o troféu X.") keeps that one; one that opens a line has nothing to lean on (the list
// above it is another step), so it says nothing alone and never shows.
function guideSteps(text: string) {
  return text.split(/\n+/).flatMap((line) => {
    const step = line.replace(/^\s*(?:\d+[.)]|[-•])\s*/, '').trim()
    if (!step) return []
    if (/^\s*\d+[.)]/.test(line)) return [step]
    const sentences = step.split(/(?<=[.!?])\s+(?=[\p{Lu}*\d])/u)
    return sentences.flatMap((sentence, i) => {
      if (!LEANS.test(sentence)) return [sentence]
      return i ? [`${sentences[i - 1]} ${sentence}`] : []
    })
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

/**
 * The guide's steps that name this trophy and no other; with none and no tip of its own, the steps it
 * shares with other trophies, never one that names a trophy still hidden.
 */
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
  // A step that names a trophy still hidden would spoil it, so it never shows here.
  const secret = others.filter((t) => t.hidden && !t.earned)
  const naming = [...new Set(steps)].filter(
    (step) => mentions(step, trophy) && !secret.some((t) => mentions(step, t)),
  )
  const own = naming.filter((step) => !others.some((t) => mentions(step, t)))
  // A story trophy comes by playing: a step it shares with others (the story's whole list, "from
  // the first trophy to the last") only makes it look like work.
  if (trophyKind(trophy, guide) === 'natural') return own.slice(0, MAX_MENTIONS)
  // With no step of its own, one shared with a few other trophies still says how, instead of nothing.
  const few = naming.filter((step) => others.filter((t) => mentions(step, t)).length < MAX_SHARED)
  return (own.length || hasOwnAdvice(trophy, guide) ? own : few).slice(0, MAX_MENTIONS)
}

/** Whether the guide has a tip, a trick, a warning, an online note or a bug for this trophy. */
function hasOwnAdvice(trophy: Trophy, guide?: GuideDetail | null) {
  const a = trophyAdvice(trophy, guide)
  return !!(a.trick || a.warning || a.online || a.bug || a.tips.length)
}

/** The journey's "Throughout the journey" list (shared/journey/ongoing.ts). */
export function ongoingObjectives(trophies: Trophy[], guide?: GuideDetail | null) {
  return ongoing(trophies, guide)
}
