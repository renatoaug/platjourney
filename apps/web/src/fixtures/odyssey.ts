import { odyssey } from '../../../../shared/journey/odyssey'
import type { CurrentGame } from '../lib/types'
import { current } from './index'

/** Public metadata, entirely synthetic progress. */
export function odysseyGame(earned: string[] = []): CurrentGame {
  return {
    ...current,
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
    trophies: odyssey.objectives.map((o, id) => ({
      id,
      groupId: 'default',
      name: o.names[0],
      nameEn: o.names[1],
      detail: o.action.pt,
      earned: earned.includes(o.key),
      type: o.kind === 'platinum' ? 'platinum' : 'bronze',
    })),
  }
}
