/** What to keep an eye on throughout a game: the journey's "Throughout the journey" list and the
 * start notice read the same pick, so the screen and the notice never disagree. */

type TrophyKind = 'natural' | 'hunt' | 'grind'

interface OngoingTrophy {
  name: string
  nameEn?: string
  earned: boolean
  hidden?: boolean
  type: string
  groupId: string
  progressTarget?: number | null
}

interface OngoingGuide {
  roadmap: { phase: string; trophies: string[] }[]
  missables: { trophy: string; when: string }[]
  earlyTips: string[]
  milestones?: { tips: { trophy?: string | null }[] }[]
  trophyKinds?: { trophy: string; kind: TrophyKind }[]
}

export const normalized = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Exact localized names only: ambiguous matches stay unplaced instead of inventing an order. */
export function trophyMatches(trophy: Pick<OngoingTrophy, 'name' | 'nameEn'>, name: string) {
  const key = normalized(name)
  return key !== '' && [trophy.name, trophy.nameEn].some((n) => n && normalized(n) === key)
}

/** A text as whole words, padded, so a name is found only as words of its own. */
export const words = (value: string) =>
  ` ${normalized(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `

function ongoingBasis(early: boolean, duration: boolean, repeated: boolean, counter: boolean) {
  if (early) return 'early' as const
  if (duration) return 'duration' as const
  if (repeated) return 'repeated' as const
  if (counter) return 'counter' as const
  // Only the guide's kind says so: a grind with no other sign in the guide.
  return 'long' as const
}

function earlyAdvice(trophy: OngoingTrophy, trophies: OngoingTrophy[], tips: string[]) {
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

/** What the trophy asks of the player, when the guide has kinds at all. */
function guideKind(trophy: OngoingTrophy, guide?: OngoingGuide | null) {
  return guide?.trophyKinds?.find((x) => trophyMatches(trophy, x.trophy))?.kind
}

const CAMPAIGN_WINDOW =
  /^(?:durante (?:toda )?a campanha|ao longo (?:de toda )?da campanha|throughout (?:the )?(?:campaign|game)|during (?:the )?campaign)\b/i

/**
 * A conservative view over existing evidence, not a position or completion predictor: what to keep
 * an eye on for a while (collections, counts, spending), not a single moment of the campaign.
 */
export function ongoingObjectives<T extends OngoingTrophy, G extends OngoingGuide>(
  trophies: T[],
  guide?: G | null,
) {
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
    const warning = (guide?.missables ?? []).find(
      (w) => trophyMatches(trophy, w.trophy) && unique(w.trophy),
    ) as G['missables'][number] | undefined
    const duration = warning && CAMPAIGN_WINDOW.test(warning.when.trim()) ? warning : undefined
    const early = earlyAdvice(trophy, trophies, guide?.earlyTips ?? [])
    const counter = trophy.progressTarget != null && trophy.progressTarget > 1
    // Tips about it in several stretches of the route: a collection picked up along the way.
    const stretches = (guide?.milestones ?? []).filter((m) =>
      m.tips.some((tip) => !!tip.trophy && trophyMatches(trophy, tip.trophy) && unique(tip.trophy)),
    )
    const repeated = phases.length > 1 || stretches.length > 1
    const kind = guideKind(trophy, guide)
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
