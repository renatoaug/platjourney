import type { Guide } from './guide.ts'
import { DEFAULT_LOCALE, defineMessages, Language, type Locale, translator } from './i18n.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    after: 'Agora vale saber:',
    before: 'Antes de começar:',
    // A tip about one trophy names it, so the player knows what it is for.
    missableTip: '⚠️ **{trophy}** é perdível: {text}',
    trophyTip: '🏆 **{trophy}**: {text}',
    // The stretch's checklist, summed up before the list: what to pick up, counted by type
    // ("2 Souvenir, 1 Flor"), and its missable trophies by name.
    collectibles: {
      one: '1 coisa para pegar aqui: {types}.',
      other: '{count} coisas para pegar aqui: {types}.',
    },
    alsoMissable: {
      one: 'Além do troféu {trophies}, que é perdível.',
      other: 'Além dos troféus {trophies}, que são perdíveis.',
    },
    onlyMissable: {
      one: 'Aqui tem o troféu {trophies}, que é perdível.',
      other: 'Aqui tem os troféus {trophies}, que são perdíveis.',
    },
    inOrder: 'Seguem na ordem.',
  },
  [Language.En]: {
    after: 'Worth knowing now:',
    before: 'Before you start:',
    missableTip: '⚠️ **{trophy}** is missable: {text}',
    trophyTip: '🏆 **{trophy}**: {text}',
    collectibles: {
      one: '1 thing to pick up here: {types}.',
      other: '{count} things to pick up here: {types}.',
    },
    alsoMissable: {
      one: 'Plus the trophy {trophies}, which is missable.',
      other: 'Plus the trophies {trophies}, which are missable.',
    },
    onlyMissable: {
      one: 'The trophy {trophies} is missable here.',
      other: 'The trophies {trophies} are missable here.',
    },
    inOrder: 'In order:',
  },
})

// The guide's real-time route: after a story trophy, what matters right there
// (a missable about to close, an item worth grabbing, a trophy that is easy now, where the
// collectibles of the chapter just reached are).
export interface RouteTip {
  kind: 'missable' | 'item' | 'advantage' | 'trophy' | 'warning' | 'collectible'
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

// The stretch the player is in now: the furthest milestone whose story trophy they have, or the
// opening one before any. The session notice repeats its tips, so a player who comes back to a
// chapter game hears again where that chapter's collectibles are.
export function currentMilestone(
  guide: Pick<Guide, 'milestones'> | undefined,
  earned: string[],
): Milestone | undefined {
  const have = new Set(earned.map(norm))
  return (guide?.milestones ?? []).filter((m) => !m.after || have.has(norm(m.after))).at(-1)
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
  const tips = milestone.tips.map((tip) => tipLine(tip, locale))
  return [head, ...tips].join('\n')
}

// One tip as a line. A collectible opens with its name ("Souvenir 1/21, Best player: ..."): the
// name goes in bold on a line of its own, the directions below it. A tip about a trophy names the
// trophy, and says so when it is missable.
export function tipLine(tip: RouteTip, locale: Locale = DEFAULT_LOCALE): string {
  const t = translator(messages, locale)
  const at = tip.text.indexOf(': ')
  if (tip.kind === 'collectible' && at >= 0) {
    const rest = tip.text.slice(at + 2)
    return `• **${tip.text.slice(0, at)}**\n${rest.charAt(0).toUpperCase()}${rest.slice(1)}`
  }
  if (!tip.trophy || tip.kind === 'collectible') return `• ${tip.text}`
  return `• ${t(tip.kind === 'missable' ? 'missableTip' : 'trophyTip', { trophy: tip.trophy, text: tip.text })}`
}

// The collectible's type from its name: "Flor 3/5, Genciana" is a Flor, "Baú secreto 2/10" a Baú
// secreto.
const collectibleType = (tip: RouteTip) => {
  const name = tip.text.split(': ')[0] ?? tip.text
  return (
    name.match(/^(.*?)\s+\d+(?:\s*\/\s*\d+)?(?:\D|$)/)?.[1] ??
    name.split(',')[0] ??
    name
  ).trim()
}

// The stretch's checklist summed up: how many things to pick up, by type in the order they first
// appear, and the missable trophies by name. Empty when there is neither.
export function collectibleSummary(tips: RouteTip[], locale: Locale = DEFAULT_LOCALE): string {
  const t = translator(messages, locale)
  const found = tips.filter((tip) => tip.kind === 'collectible')
  const missables = [
    ...new Set(
      tips.filter((tip) => tip.kind === 'missable' && tip.trophy).map((tip) => `**${tip.trophy}**`),
    ),
  ]
  const types = new Map<string, number>()
  for (const tip of found)
    types.set(collectibleType(tip), (types.get(collectibleType(tip)) ?? 0) + 1)
  const list = [...types].map(([type, n]) => `${n} ${type}`).join(', ')
  const parts = [
    found.length ? t('collectibles', { count: found.length, types: list }) : '',
    missables.length
      ? t(found.length ? 'alsoMissable' : 'onlyMissable', {
          count: missables.length,
          trophies: missables.join(', '),
        })
      : '',
  ].filter(Boolean)
  return parts.length ? `${parts.join(' ')} ${t('inOrder')}` : ''
}
