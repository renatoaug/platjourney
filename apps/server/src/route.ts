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
    // The same count when no item says what it is ("Esse aviso adianta o troféu X: ...").
    collectiblesUntyped: {
      one: '1 coisa para pegar aqui.',
      other: '{count} coisas para pegar aqui.',
    },
    // The type of the items that do not say theirs, next to those that do ("2 flores e 1 item").
    otherItem: 'item',
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
    collectiblesUntyped: {
      one: '1 thing to pick up here.',
      other: '{count} things to pick up here.',
    },
    otherItem: 'item',
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
  // The tip in one or two sentences, for where a checklist item does not fit.
  text: string
  trophy: string | null
  // A chapter's checklist item (a collectible, an item to pick up, a missable) step by step: what it
  // is ("Flor 3/5: Genciana"), the sub-chapter and objective, the steps from the previous item, and
  // how to tell you went past it and get it back. Guides written before this have only `text`.
  name?: string
  where?: string | null
  steps?: string[]
  ifMissed?: string | null
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
  const tips = byTrophy(milestone.tips).map((tip) => tipLine(tip, locale))
  return [head, ...tips].join('\n')
}

// A plain tip about a trophy: one line that opens with the trophy's name.
const aboutTrophy = (tip: RouteTip) =>
  !!tip.trophy && tip.kind !== 'collectible' && !(tip.name && tip.steps?.length)

/** Several plain tips about the same trophy go under one heading, their texts one after the
 * other, where the first one was: two bullets both titled "🏆 **X**" read as a mistake. The same
 * text twice goes once. Checklist items and collectibles keep their own lines. */
export function byTrophy(tips: RouteTip[]): RouteTip[] {
  const out: RouteTip[] = []
  const seen = new Map<string, RouteTip>()
  for (const tip of tips) {
    const key = aboutTrophy(tip) ? `${tip.kind === 'missable'}:${norm(tip.trophy ?? '')}` : ''
    const first = key ? seen.get(key) : undefined
    if (!first) {
      const own = { ...tip }
      if (key) seen.set(key, own)
      out.push(own)
    } else if (!first.text.includes(tip.text.trim())) first.text = `${first.text} ${tip.text}`
  }
  return out
}

// Guides write names in bold inside their texts; inside a heading that is already bold, the inner
// marks would close it halfway.
const unbold = (text: string) => text.replace(/\*\*/g, '')

/** What a collectible is called, when its text or name opens with that: "Flor 3/5" from "Flor 3/5:
 * Genciana", "Souvenir 1/21, Best player" from "Souvenir 1/21, Best player: na varanda". A label is
 * short or numbered and has no markdown: a sentence before a colon ("Esse aviso adianta o troféu
 * **X**: recolha...") is not one. Undefined when there is none. */
function collectibleLabel(tip: RouteTip): string | undefined {
  const source = tip.name ?? tip.text
  const at = source.indexOf(': ')
  if (at < 0 && !tip.name) return undefined
  const head = (at < 0 ? source : source.slice(0, at)).trim()
  const label = !!head && !head.includes('*') && (/\d/.test(head) || head.split(/\s+/).length <= 4)
  return label ? head : undefined
}

// One tip as a line. A checklist item goes out numbered, its name in bold, the sub-chapter in
// italics and one step per line. An older collectible opens with its name ("Souvenir 1/21, Best
// player: ..."): the name goes in bold on a line of its own, the directions below it. A tip about a
// trophy names the trophy, and says so when it is missable.
export function tipLine(tip: RouteTip, locale: Locale = DEFAULT_LOCALE, n?: number): string {
  const t = translator(messages, locale)
  if (tip.name && tip.steps?.length) {
    const title = `**${n ? `${n}. ` : ''}${tip.kind === 'missable' ? '⚠️ ' : ''}${unbold(tip.name)}**`
    return [
      title,
      tip.where ? `*${tip.where}*` : '',
      ...tip.steps.map((step) => `• ${step}`),
      tip.ifMissed ? `↩️ ${tip.ifMissed}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }
  const at = tip.text.indexOf(': ')
  if (tip.kind === 'collectible' && at >= 0 && collectibleLabel({ ...tip, name: undefined })) {
    const rest = tip.text.slice(at + 2)
    return `• **${tip.text.slice(0, at)}**\n${rest.charAt(0).toUpperCase()}${rest.slice(1)}`
  }
  if (!tip.trophy || tip.kind === 'collectible') return `• ${tip.text}`
  return `• ${t(tip.kind === 'missable' ? 'missableTip' : 'trophyTip', { trophy: tip.trophy, text: tip.text })}`
}

// The collectible's type from its label: "Flor 3/5, Genciana" is a Flor, "Baú secreto 2/10" a Baú
// secreto. Undefined when the item has no label.
const collectibleType = (tip: RouteTip) => {
  const name = collectibleLabel(tip)
  if (!name) return undefined
  return (
    name.match(/^(.*?)\s+\d+(?:\s*\/\s*\d+)?(?:\D|$)/)?.[1] ??
    name.split(',')[0] ??
    name
  ).trim()
}

// Borrowed words keep the plural of their language: souvenirs, not souvenires.
const LOANWORDS = new Set([
  'souvenir',
  'poster',
  'pôster',
  'laser',
  'sticker',
  'trailer',
  'scanner',
])

// Portuguese plurals by ending, the first that matches: flor, flores; anel, anéis; baú, baús.
const PLURAL_ENDINGS: [RegExp, string][] = [
  [/ão$/, 'ões'],
  [/([rz])$/, '$1es'],
  [/([sx])$/, '$1'],
  [/m$/, 'ns'],
  [/al$/, 'ais'],
  [/el$/, 'éis'],
  [/ol$/, 'óis'],
  [/ul$/, 'uis'],
  [/$/, 's'],
]

// One Portuguese word in the plural: flor, flores; baú, baús; secreto, secretos.
const pluralWord = (word: string) => {
  if (LOANWORDS.has(word)) return `${word}s`
  const [ending, plural] = PLURAL_ENDINGS.find(([re]) => re.test(word)) ?? [/$/, 's']
  return word.replace(ending, plural)
}

// A count of one type, lowercase as in a sentence: "1 flor", "2 baús de ferramentas", "2 souvenirs".
// In Portuguese every word before a "de" takes the plural; in English the last word does, or the one
// before an "of".
function counted(n: number, type: string, locale: Locale): string {
  const words = type.toLowerCase().split(/\s+/)
  if (n === 1) return `1 ${words.join(' ')}`
  if (locale === Language.PtBR) {
    const stop = words.findIndex((w) => /^d[aeo]s?$/.test(w))
    return `${n} ${words.map((w, i) => (stop < 0 || i < stop ? pluralWord(w) : w)).join(' ')}`
  }
  const of = words.indexOf('of')
  const head = of > 0 ? of - 1 : words.length - 1
  const english = (w: string) =>
    /(x|z|ch|sh|ss)$/.test(w) ? `${w}es` : w.endsWith('s') ? w : `${w}s`
  return `${n} ${words.map((w, i) => (i === head ? english(w) : w)).join(' ')}`
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
  let untyped = 0
  for (const tip of found) {
    const type = collectibleType(tip)
    if (type) types.set(type, (types.get(type) ?? 0) + 1)
    else untyped++
  }
  const counts = [...types].map(([type, n]) => counted(n, type, locale))
  if (untyped && types.size) counts.push(counted(untyped, t('otherItem'), locale))
  const list = new Intl.ListFormat(locale, { type: 'conjunction' }).format(counts)
  const parts = [
    found.length
      ? t(types.size ? 'collectibles' : 'collectiblesUntyped', {
          count: found.length,
          types: list,
        })
      : '',
    missables.length
      ? t(found.length ? 'alsoMissable' : 'onlyMissable', {
          count: missables.length,
          trophies: missables.join(', '),
        })
      : '',
  ].filter(Boolean)
  return parts.length ? `${parts.join(' ')} ${t('inOrder')}` : ''
}
