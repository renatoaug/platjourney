import { odyssey } from './odyssey'
import { requiem } from './requiem'

/** Explicit selected edition wins over a catalog containing multiple editions. */
export function reviewedJourney(identity: {
  id?: string
  np?: string
  np_communication_ids?: string[]
}) {
  const editions = identity.np ? [identity.np] : (identity.np_communication_ids ?? [])
  const matches = [
    ['NPWR22997_00', requiem],
    ['NPWR13822_00', odyssey],
  ] as const
  const found = matches.filter(([np]) => editions.includes(np))
  return found.length === 1 ? found[0][1] : undefined
}
