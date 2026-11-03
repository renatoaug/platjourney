/** Reviewed game knowledge, independent of rendering, storage and model calls. */
export interface JourneyTrophy {
  id: number
  groupId: string
  name: string
  nameEn?: string
  earned: boolean
  type: string
  hidden?: boolean
}

export interface JourneyText {
  pt: string
  en: string
}

export interface JourneyObjective {
  key: string
  names: [string, string]
  kind: 'story' | 'chapter' | 'collectible' | 'upgrade' | 'skill' | 'counter' | 'platinum'
  /** Advisory position; never the player's current location or a required unlock sequence. */
  order: number
  chapter?: number
  /** Hard dependencies only. Preparation and ordering are deliberately not dependencies. */
  requires?: string[]
  prepareFrom?: number
  risk?: 'replay' | 'skill-carryover'
  action: JourneyText
  approach?: JourneyText
  recovery?: JourneyText
  sources: string[]
}

export interface JourneyModel {
  version: number
  reviewedAt: string
  objectives: JourneyObjective[]
  finalChapter: number
}

export type ObjectiveState = 'complete' | 'available' | 'prepare' | 'later' | 'recover' | 'verify'
export interface JourneyItem<T extends JourneyTrophy> {
  objective: JourneyObjective
  trophy: T
  state: ObjectiveState
}

const normalized = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** Missing and ambiguous names fail closed, rather than attaching guidance to a different trophy. */
export function evaluateJourney<T extends JourneyTrophy>(model: JourneyModel, trophies: T[]) {
  const base = trophies.filter((t) => t.groupId === 'default')
  const matches = model.objectives.flatMap((objective) => {
    const names = objective.names.map(normalized)
    const found = base.filter((t) =>
      [t.name, t.nameEn].some((n) => n && names.includes(normalized(n))),
    )
    return found.length === 1 ? [{ objective, trophy: found[0] }] : []
  })
  const earned = new Set(matches.filter((x) => x.trophy.earned).map((x) => x.objective.key))
  const confirmedChapter = Math.max(
    0,
    ...matches
      .filter((x) => x.trophy.earned && x.objective.kind === 'story')
      .map((x) => x.objective.chapter ?? 0),
  )
  const storyComplete = confirmedChapter === model.finalChapter
  // This is a planning horizon after a confirmed milestone, not a location inference.
  const horizon = Math.min(model.finalChapter, confirmedChapter + 1)
  const items: JourneyItem<T>[] = matches
    .map(({ objective, trophy }) => ({
      objective,
      trophy,
      state: objectiveState(objective, trophy, earned, confirmedChapter, horizon, storyComplete),
    }))
    .sort((a, b) => a.objective.order - b.objective.order)
  const rank = (x: JourneyItem<T>) => {
    if (x.state === 'complete' || x.state === 'later' || x.state === 'verify') return 100
    if (storyComplete && x.objective.kind === 'skill') return 0
    if (x.state === 'available' && x.objective.kind === 'chapter') return 1
    if (x.state === 'available') return 2
    if (x.state === 'prepare') return 3
    return 4
  }
  const candidates = items
    .filter((x) => rank(x) < 100)
    .sort((a, b) => rank(a) - rank(b) || a.objective.order - b.objective.order)
  const next = candidates[0]
  const ongoing = items.filter(
    (x) =>
      x.state !== 'complete' &&
      x.state !== 'later' &&
      ['collectible', 'upgrade', 'skill', 'counter'].includes(x.objective.kind),
  )
  const unmatched = base.filter((t) => !matches.some((x) => x.trophy === t))
  return {
    items,
    next,
    ongoing,
    confirmedChapter,
    storyComplete,
    unmatched,
    covered: matches.length,
    expected: model.objectives.length,
  }
}

function objectiveState(
  o: JourneyObjective,
  trophy: JourneyTrophy,
  earned: Set<string>,
  confirmed: number,
  horizon: number,
  storyComplete: boolean,
): ObjectiveState {
  if (trophy.earned) return 'complete'
  if (o.requires?.some((key) => !earned.has(key))) return 'later'
  if (o.kind === 'platinum') return 'verify'
  if (o.kind === 'story' || o.kind === 'chapter') return chapterState(o, confirmed, horizon)
  if (o.kind === 'skill') return storyComplete ? 'available' : 'prepare'
  if ((o.prepareFrom ?? 1) > horizon) return 'later'
  return storyComplete ? 'recover' : 'prepare'
}

function chapterState(o: JourneyObjective, confirmed: number, horizon: number): ObjectiveState {
  if ((o.chapter ?? 0) <= confirmed) return o.kind === 'story' ? 'verify' : 'recover'
  return (o.chapter ?? 0) > horizon ? 'later' : 'available'
}
