import type { JourneyModel } from './model'

/** Only the actually opened edition can select API-provided knowledge. No catalog guessing. */
export function reviewedJourney(
  identity: { id?: string; np?: string; np_communication_ids?: string[] },
  model?: JourneyModel | null,
) {
  return identity.np && model?.edition === identity.np ? model : undefined
}
