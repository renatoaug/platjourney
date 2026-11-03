import { evaluateJourney, type JourneyModel, type JourneyTrophy } from './model'

/** Reserved time, never an estimate of task duration or a promised unlock. */
export function selectJourneySession<T extends JourneyTrophy>(
  model: JourneyModel,
  trophies: T[],
  minutes: number,
  revealed: boolean,
  avoid: string[] = [],
) {
  const journey = evaluateJourney(model, trophies)
  if (!Number.isFinite(minutes) || minutes < 15 || minutes > 600)
    return { journey, steps: [], reason: 'invalid-time' as const }
  if (journey.covered !== journey.expected || journey.unmatched.length)
    return { journey, steps: [], reason: 'incomplete' as const }
  const eligible = journey.candidates.filter((x) => revealed || !x.trophy.hidden)
  if (!eligible.length) return { journey, steps: [], reason: 'no-visible-actions' as const }
  // At most one focus per reserved hour, capped at three. This limits context switching;
  // it does not assert that any objective can be completed within that hour.
  const count = Math.min(3, Math.ceil(minutes / 60), eligible.length)
  const selected = [
    ...eligible.filter((x) => !avoid.includes(x.trophy.name)),
    ...eligible.filter((x) => avoid.includes(x.trophy.name)),
  ].slice(0, count)
  const whole = Math.floor(minutes / selected.length)
  return {
    journey,
    steps: selected.map((item, i) => ({
      ...item,
      minutes: i === selected.length - 1 ? minutes - whole * (selected.length - 1) : whole,
    })),
    reason: null,
  }
}
