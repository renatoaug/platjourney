/** Reviewed game knowledge, independent of rendering, storage and model calls. */
export interface JourneyTrophy {
  id: number
  groupId: string
  name: string
  nameEn?: string
  earned: boolean
  earnedAt?: string
  type: string
  hidden?: boolean
}

interface JourneyText {
  pt: string
  en: string
}

interface JourneyObjective {
  key: string
  /** Identity is scoped by JourneyModel.edition, never by translated display names. */
  trophyId: number
  groupId: 'default'
  placement: {
    kind: 'story' | 'window' | 'parallel' | 'destination'
    /** Advisory map relations, not requirements to have earned another trophy. */
    after?: string
    before?: string
    label: JourneyText
    evidence: JourneyText
    sources: string[]
  }
  names: [string, string]
  kind:
    | 'story'
    | 'chapter'
    | 'collectible'
    | 'upgrade'
    | 'skill'
    | 'counter'
    | 'quest'
    | 'task'
    | 'platinum'
  /** Advisory position; never the player's current location or a required unlock sequence. */
  order: number
  chapter?: number
  /** Hard dependencies only. Preparation and ordering are deliberately not dependencies. */
  requires?: string[]
  prepareFrom?: number
  /** Last collectible location, not proof that earlier items were collected. */
  completionChapter?: number
  /** Open-world attention is independent of path order and never implies a known counter. */
  ongoing?: boolean
  /** Sufficient evidence of a system being unlocked, not mandatory trophy prerequisites. */
  evidenceAny?: string[]
  availability?: JourneyText
  risk?: 'replay' | 'skill-carryover' | 'opportunity'
  action: JourneyText
  approach?: JourneyText
  recovery?: JourneyText
  sources: string[]
}

export interface JourneyModel {
  schemaVersion: 1
  edition: string
  name: string
  version: number
  reviewedAt: string
  objectives: JourneyObjective[]
  planning: { kind: 'chapters'; finalChapter: number } | { kind: 'open-world'; finale: string }
}

export type ObjectiveState =
  | 'complete'
  | 'available'
  | 'prepare'
  | 'later'
  | 'recover'
  | 'verify'
  | 'check'
export interface JourneyItem<T extends JourneyTrophy> {
  objective: JourneyObjective
  trophy: T
  state: ObjectiveState
}

/** Edition is resolved by the registry; duplicate identities fail closed, names never bind. */
export function evaluateJourney<T extends JourneyTrophy>(model: JourneyModel, trophies: T[]) {
  const base = trophies.filter((t) => t.groupId === 'default')
  const matches = model.objectives.flatMap((objective) => {
    const found = base.filter((t) => t.id === objective.trophyId && t.groupId === objective.groupId)
    return found.length === 1 ? [{ objective, trophy: found[0] }] : []
  })
  const earned = new Set(matches.filter((x) => x.trophy.earned).map((x) => x.objective.key))
  const confirmedChapter = Math.max(
    0,
    ...matches
      .filter((x) => x.trophy.earned && x.objective.kind === 'story')
      .map((x) => x.objective.chapter ?? 0),
  )
  const planning = model.planning
  const storyComplete =
    planning.kind === 'chapters'
      ? confirmedChapter === planning.finalChapter
      : earned.has(planning.finale)
  // This is a planning horizon after a confirmed milestone, not a location inference.
  const horizon =
    planning.kind === 'chapters' ? Math.min(planning.finalChapter, confirmedChapter + 1) : 0
  const lastStory = Math.max(
    -1,
    ...matches
      .filter((x) => x.trophy.earned && x.objective.kind === 'story')
      .map((x) => x.objective.order),
  )
  const storyNext = matches
    .filter(
      (x) => !x.trophy.earned && x.objective.kind === 'story' && x.objective.order > lastStory,
    )
    .sort((a, b) => a.objective.order - b.objective.order)[0]?.objective.key
  const items: JourneyItem<T>[] = matches
    .map(({ objective, trophy }) => ({
      objective,
      trophy,
      state:
        planning.kind === 'open-world'
          ? openWorldState(objective, trophy, earned, lastStory, storyNext)
          : objectiveState(objective, trophy, earned, confirmedChapter, horizon, storyComplete),
    }))
    .sort((a, b) => a.objective.order - b.objective.order)
  const rank = (x: JourneyItem<T>) => {
    if (x.state === 'complete' || x.state === 'later' || x.state === 'verify') return 100
    if (planning.kind === 'open-world') return openWorldRank(x)
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
  // Rebase the unfinished route on the same next action used by sessions. Preserve
  // source order for the horizon; missing earlier story records need verification,
  // not a claim that the player must repeat them before continuing.
  const remaining = [
    ...(next ? [next] : []),
    ...items.filter(
      (x) =>
        !x.trophy.earned && x !== next && x.state !== 'verify' && x.objective.kind !== 'platinum',
    ),
    ...items.filter(
      (x) => !x.trophy.earned && x.state === 'verify' && x.objective.kind !== 'platinum',
    ),
    ...items.filter((x) => !x.trophy.earned && x.objective.kind === 'platinum'),
  ]
  const ongoing = items.filter(
    (x) =>
      x.state !== 'complete' &&
      x.state !== 'later' &&
      (planning.kind === 'open-world'
        ? !!x.objective.ongoing
        : ['collectible', 'upgrade', 'skill', 'counter'].includes(x.objective.kind)),
  )
  const unmatched = base.filter((t) => !matches.some((x) => x.trophy === t))
  return {
    items,
    name: model.name,
    mode: planning.kind,
    next,
    // Deterministic candidates for a future time-budget selector; not a session plan.
    candidates,
    remaining,
    ongoing,
    confirmedChapter,
    storyComplete,
    unmatched,
    covered: matches.length,
    expected: model.objectives.length,
  }
}

function openWorldState(
  o: JourneyObjective,
  trophy: JourneyTrophy,
  earned: Set<string>,
  lastStory: number,
  storyNext?: string,
): ObjectiveState {
  if (trophy.earned) return 'complete'
  if (o.requires?.some((key) => !earned.has(key))) return 'later'
  if (o.kind === 'platinum') return 'verify'
  if (o.kind === 'story') {
    if (o.order < lastStory) return 'verify'
    return o.key === storyNext ? 'available' : 'later'
  }
  if (o.ongoing) return 'prepare'
  return o.evidenceAny?.some((key) => earned.has(key)) ? 'available' : 'check'
}

function openWorldRank(x: JourneyItem<JourneyTrophy>): number {
  if (x.state === 'available' && x.objective.kind === 'story') return 0
  if (x.state === 'available') return 1
  if (x.state === 'prepare') return 2
  return 3
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
  if (o.completionChapter && confirmed >= o.completionChapter) return 'recover'
  if ((o.prepareFrom ?? 1) > horizon) return 'later'
  if (o.kind === 'skill') return storyComplete ? 'available' : 'prepare'
  return storyComplete ? 'recover' : 'prepare'
}

function chapterState(o: JourneyObjective, confirmed: number, horizon: number): ObjectiveState {
  if ((o.chapter ?? 0) <= confirmed) return o.kind === 'story' ? 'verify' : 'recover'
  return (o.chapter ?? 0) > horizon ? 'later' : 'available'
}
