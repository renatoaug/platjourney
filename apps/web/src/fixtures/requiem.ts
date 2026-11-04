import { requiem } from '../../../../shared/journey/requiem'
import type { CurrentGame } from '../lib/types'
import { current } from './index'

/** Public trophy names with synthetic progress. Never a snapshot of a player's account. */
export function requiemGame(earned: string[] = []): CurrentGame {
  return {
    ...current,
    game: {
      id: 'game:152242',
      name: 'A Plague Tale: Requiem',
      np_communication_ids: ['NPWR22997_00'],
    },
    name: 'A Plague Tale: Requiem',
    np: 'NPWR22997_00',
    focus: null,
    guide: null,
    icon: '',
    trophies: requiem.objectives.map((o) => ({
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
