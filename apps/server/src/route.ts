import type { Guide } from './guide.ts'
import { DEFAULT_LOCALE, defineMessages, Language, type Locale, translator } from './i18n.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    after: 'Agora vale saber:',
    before: 'Antes de começar:',
  },
  [Language.En]: {
    after: 'Worth knowing now:',
    before: 'Before you start:',
  },
})

// The guide's real-time route: after a story trophy, what matters right there
// (a missable about to close, an item worth grabbing, a trophy that is easy now).
interface RouteTip {
  kind: 'missable' | 'item' | 'advantage' | 'trophy' | 'warning'
  text: string
  trophy: string | null
}

export interface Milestone {
  // The trophy's pt-BR name; null only for the first milestone, the start of the game.
  after: string | null
  tips: RouteTip[]
}

const norm = (name: string) => name.normalize('NFC').trim().toLowerCase()

// The stretch the player just reached. Several story trophies can land in one sweep
// (a session synced late): only the furthest one is sent, since earlier tips are behind them.
export function reachedMilestone(
  guide: Pick<Guide, 'milestones'> | undefined,
  unlocked: string[],
  started: boolean,
): Milestone | undefined {
  const names = new Set(unlocked.map(norm))
  return (guide?.milestones ?? [])
    .filter((m) => (m.after ? names.has(norm(m.after)) : started))
    .at(-1)
}

// The milestone without the tips about trophies the player already has: telling them to earn
// one they earned reads as if Nexo was not paying attention. Nothing left, no note.
export function stillOpen(milestone: Milestone, earned: string[]): Milestone | undefined {
  const have = new Set(earned.map(norm))
  const tips = milestone.tips.filter((t) => !t.trophy || !have.has(norm(t.trophy)))
  return tips.length ? { ...milestone, tips } : undefined
}

// It follows the start or trophy notice in the same message, which already names the game
// and the trophy. The header is the player's language; the tips are the guide's text as written.
export function routeNotice(milestone: Milestone, locale: Locale = DEFAULT_LOCALE): string {
  const t = translator(messages, locale)
  const head = t(milestone.after ? 'after' : 'before')
  const tips = milestone.tips.map((t) => `• ${t.text}`)
  return [head, ...tips].join('\n')
}
