import data from '../../../../db/journeys/npwr13822_00-v2.json'
import { parseJourneyModel } from '../../../../shared/journey/validation'
export const odyssey = parseJourneyModel(data)

import type { CurrentGame } from '../lib/types'
import { current } from './index'

/** Public metadata, entirely synthetic progress. */
export function odysseyGame(earned: string[] = []): CurrentGame {
  return {
    ...current,
    journeyModel: odyssey,
    game: {
      id: 'game:103054',
      name: "Assassin's Creed Odyssey",
      np_communication_ids: ['NPWR13822_00'],
    },
    name: "Assassin's Creed Odyssey",
    np: 'NPWR13822_00',
    focus: null,
    guide: null,
    icon: '',
    trophies: odyssey.objectives.map((o) => ({
      id: o.trophyId,
      groupId: 'default',
      name: o.names[0],
      nameEn: o.names[1],
      detail: o.action.pt,
      earned: earned.includes(o.key),
      type: o.kind === 'platinum' ? 'platinum' : 'bronze',
    })),
  }
}
