import { odyssey } from './odyssey'
import { requiem } from './requiem'

/** Explicit selected edition wins over a catalog containing multiple editions. */
export function reviewedJourney(identity: {
  id?: string
  np?: string
  np_communication_ids?: string[]
}) {
  const editions = identity.np ? [identity.np] : (identity.np_communication_ids ?? [])
  const found = [requiem, odyssey].filter((model) => editions.includes(model.edition))
  return found.length === 1 ? found[0] : undefined
}
