import { defineMessages, Language, translator } from './i18n.ts'
import type { TrophyStatus } from './psn.ts'
import type { User } from './repository/user.ts'

// Our own line at each mark, in PlatJourney's voice, after Nexo's words: a few of each, picked at
// random so the same mark on the next game does not read the same.
const messages = defineMessages({
  [Language.PtBR]: {
    cheer: {
      first: {
        a: 'O primeiro caiu! Agora é até os 100%, nada de deixar jogo pela metade, hein.',
        b: 'Tá aberta a porteira! Agora é um troféu atrás do outro até a platina.',
        c: 'Foi dada a largada! Que venham os próximos.',
      },
      half: {
        a: 'Metade do caminho! Daqui pra frente a platina só fica mais perto.',
        b: 'Passou da metade. A platina já tá te esperando lá na frente.',
        c: 'Metade do jogo base fechada. Que ritmo!',
      },
      final: {
        a: 'Reta final! A platina tá logo ali.',
        b: 'Faltam poucos. Essa platina já tá praticamente na estante.',
        c: 'Tá cheirando a platina!',
      },
      platinum: {
        a: 'PLATINOU! Mais uma pra estante. Quando quiser, a gente escolhe a próxima juntos.',
        b: 'Platina na conta! Jogo fechado de verdade, do jeito certo.',
        c: 'Que platina! Pode comemorar, depois a gente acha a próxima.',
      },
    },
  },
  [Language.En]: {
    cheer: {
      first: {
        a: 'The first one is down! Now all the way to 100%, no half-finished games.',
        b: 'The gates are open! One trophy after another until the platinum.',
        c: 'And they are off! Bring on the next ones.',
      },
      half: {
        a: 'Halfway there! The platinum only gets closer from here.',
        b: 'Past the halfway mark. The platinum is waiting up ahead.',
        c: 'Half of the base game done. What a pace!',
      },
      final: {
        a: 'Final stretch! The platinum is right there.',
        b: 'Only a few left. This platinum is nearly on the shelf.',
        c: 'Smells like a platinum!',
      },
      platinum: {
        a: 'PLATINUM! One more for the shelf. When you are ready, we pick the next one together.',
        b: 'Platinum earned! A game finished for real, the right way.',
        c: 'What a platinum! Celebrate, then we find the next one.',
      },
    },
  },
})

/** Our line for a mark, one of a few, in the player's language. */
export function markCheer(user: User, kind: ProgressMark['kind'], pick = Math.random()): string {
  const variant = (['a', 'b', 'c'] as const)[Math.min(2, Math.floor(pick * 3))]
  return translator(messages, user)(`cheer.${kind}.${variant}`)
}

/** A point in the player's progress an unlock can reach: the first trophy, half of the base game,
 * the final stretch, the platinum. The notice for that unlock marks it. */
interface ProgressMark {
  kind: 'first' | 'half' | 'final' | 'platinum'
  earned: number
  total: number
  /** The base game's trophies still to earn ("final"). */
  remaining: string[]
}

/** The mark these unlocks reach, counting the base game without the platinum, or undefined. When
 * one unlock reaches two (a game of three trophies), the later one wins. */
export function progressMark(
  trophies: TrophyStatus[],
  unlocked: TrophyStatus[],
): ProgressMark | undefined {
  const base = trophies.filter((t) => t.groupId === 'default' && t.type !== 'platinum')
  const just = new Set(unlocked.map((t) => t.id))
  const earned = base.filter((t) => t.earned).length
  const before = earned - base.filter((t) => t.earned && just.has(t.id)).length
  const total = base.length
  const remaining = base.filter((t) => !t.earned).map((t) => t.name)
  const at = { earned, total, remaining: [] as string[] }
  if (unlocked.some((t) => t.type === 'platinum')) return { kind: 'platinum', ...at }
  if (!total || earned === before) return undefined
  // The last stretch: a handful of trophies left, at least three or a tenth of the list.
  const stretch = Math.max(3, Math.ceil(total * 0.1))
  if (remaining.length > 0 && remaining.length <= stretch && total - before > stretch)
    return { kind: 'final', ...at, remaining }
  if (before * 2 < total && earned * 2 >= total) return { kind: 'half', ...at }
  if (before === 0) return { kind: 'first', ...at }
  return undefined
}
