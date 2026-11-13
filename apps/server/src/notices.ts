import { ongoingObjectives } from '../../../shared/journey/ongoing.ts'
import { focusAfter, tidy, todaysFocus } from './focus.ts'
import {
  defineMessages,
  fmtRate,
  Language,
  type MessageKey,
  translator,
  userLocale,
} from './i18n.ts'
import { markCheer, progressMark } from './marks.ts'
import type { GameContext } from './nexo.ts'
import { lastRecommended } from './repository/recommendation.ts'
import type { User } from './repository/user.ts'
import {
  byTrophy,
  collectibleSummary,
  currentMilestone,
  type RouteTip,
  reachedMilestone,
  routeNotice,
  stillOpen,
  tipLine,
} from './route.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    started: 'Você começou {game}. O guia da platina está no PlatJourney.',
    // The game started was Nexo's recommendation: one of these opens the notice, the same per game.
    followed: {
      a: 'Que bom que você seguiu a minha dica! Tô na torcida por essa platina. 🙌',
      b: 'Fico feliz de ver que você topou a minha sugestão. Bora com tudo! 💪',
      c: 'Olha só, a minha recomendação virou jogatina. Vamos juntos nessa! 🎯',
      d: 'Escolha certeira, e não digo isso só porque fui eu que sugeri. 😄',
    },
    // The session-start notice's first line: the game, then what is left, no greeting.
    playing: '🎮 Hora de jogar **{game}**.',
    goodSession: 'Boa jogatina! 🍀',
    // The game opened again with nothing earned since the last session notice: a short one.
    again: '🎮 Hora de jogar **{game}** de novo.',
    heading: '🎮 Hora de jogar! {left} **{game}**.',
    left: {
      one: 'Falta 1 troféu para a platina de',
      other: 'Faltam {count} troféus para a platina de',
    },
    // The focus is a suggestion: the roadmap's next trophy, or one the player left behind.
    focus:
      '**Sugestão de próximo troféu**\nSeguindo o roteiro, o próximo a pipocar deve ser **{trophy}**.',
    // A focus from a phase the player already went past: something left behind, not the next step.
    focusBehind:
      '**Sugestão de próximo troféu**\nPelo momento em que você está, vale buscar **{trophy}**, que ficou para trás.',
    tip: '**Dica**: {tip}',
    // The guide's tips for the stretch the player is in: a chapter's collectibles, a missable there.
    here: '📍 **Neste trecho do jogo**',
    // The start notice's list of what keeps going the whole game: counters, collections, grinds.
    ongoing: '🔁 **Pra ir fazendo ao longo da jornada**',
    ongoingItem: '• **{trophy}**: {detail}',
    // The start notice's list of the guide's missables still open.
    missables: '⚠️ **Perdíveis: fique de olho**',
    missablesMore: { one: 'E mais 1 no guia.', other: 'E mais {count} no guia.' },
    missable: '⚠️ **{trophy}** é perdível: {when}',
    // The same, without the guide's words on when (a player reading English: the guide is pt-BR).
    missableBare: '⚠️ **{trophy}** é perdível.',
    almost: '**Quase lá**: {trophy}, {value} de {target}.',
    focusStill: 'A sugestão de próximo troféu continua sendo **{trophy}**.',
    mark: {
      first: 'Primeiro troféu de {game}: a jornada começou.',
      // The cheer before it already says it is half: only the count.
      half: '{earned} de {total} troféus do jogo base.',
      final: 'Reta final: faltam {count} para a platina: {remaining}.',
      platinum: 'Platina de {game}! Parabéns.',
    },
    focusNew:
      '**Sugestão de próximo troféu**\nSeguindo o roteiro, o próximo a pipocar deve ser **{trophy}**.\n{detail}',
    focusNewBehind:
      '**Sugestão de próximo troféu**\nPelo momento em que você está, vale buscar **{trophy}**, que ficou para trás.\n{detail}',
    phaseDone: {
      one: '🎉 Fechou a {phase} do roteiro!',
      other: '🎉 Fechou {phase} do roteiro!',
    },
    // A missable just earned: one of these, the same per trophy.
    missableEarned: {
      a: '🔒 **{trophy}** era perdível e agora é seu para sempre. Esse não escapou!',
      b: '🎯 Perdível no bolso: **{trophy}**. Um susto a menos no caminho da platina.',
      c: '😮‍💨 Ufa! **{trophy}** era perdível e você não deixou passar.',
      d: '🛟 **{trophy}** resgatado na hora certa. Menos um perdível tirando o sono.',
    },
    unlocked: '🏆 **{trophy}** ({type}) em **{game}**',
    unlockedRate: '🏆 **{trophy}** ({type}, {rate}% de quem joga) em **{game}**',
    // Several at once: the game once, above them.
    unlockedSeveral: '{count} troféus em **{game}**:',
    unlockedItem: '🏆 **{trophy}** ({type})',
    unlockedItemRate: '🏆 **{trophy}** ({type}, {rate}% de quem joga)',
    types: {
      platinum: 'platina',
      gold: 'ouro',
      silver: 'prata',
      bronze: 'bronze',
    },
  },
  [Language.En]: {
    started: 'You started {game}. The platinum guide is on PlatJourney.',
    followed: {
      a: "So glad you took my tip! I'm rooting for this platinum. 🙌",
      b: "Happy to see you went with my suggestion. Let's do this! 💪",
      c: "Look at that, my recommendation turned into a game night. Let's go! 🎯",
      d: "Great pick, and I'm not just saying that because it was my idea. 😄",
    },
    playing: '🎮 Time to play **{game}**.',
    goodSession: 'Have a good session! 🍀',
    again: '🎮 Time to play **{game}** again.',
    heading: '🎮 Time to play! {left} **{game}**.',
    left: {
      one: '1 trophy left for the platinum of',
      other: '{count} trophies left for the platinum of',
    },
    focus:
      '**Suggested next trophy**\nFollowing the roadmap, the next one to pop should be **{trophy}**.',
    focusBehind:
      '**Suggested next trophy**\nWhere you are now, **{trophy}** is worth going after: it was left behind.',
    tip: '**Tip**: {tip}',
    here: '📍 **Where you are in the game**',
    ongoing: '🔁 **Keep at these throughout the journey**',
    ongoingItem: '• **{trophy}**: {detail}',
    missables: '⚠️ **Missables: keep an eye out**',
    missablesMore: { one: '1 more in the guide.', other: '{count} more in the guide.' },
    missable: '⚠️ **{trophy}** is missable: {when}',
    missableBare: '⚠️ **{trophy}** is missable.',
    almost: '**Almost there**: {trophy}, {value} of {target}.',
    focusStill: 'The suggested next trophy is still **{trophy}**.',
    mark: {
      first: 'First trophy in {game}: the journey has begun.',
      half: '{earned} of {total} base-game trophies.',
      final: 'Final stretch: {count} left to the platinum: {remaining}.',
      platinum: 'Platinum in {game}! Congratulations.',
    },
    focusNew:
      '**Suggested next trophy**\nFollowing the roadmap, the next one to pop should be **{trophy}**.\n{detail}',
    focusNewBehind:
      '**Suggested next trophy**\nWhere you are now, **{trophy}** is worth going after: it was left behind.\n{detail}',
    phaseDone: {
      one: '🎉 You closed {phase} of the roadmap!',
      other: '🎉 You closed {phase} of the roadmap!',
    },
    missableEarned: {
      a: "🔒 **{trophy}** was missable and now it's yours for good. That one didn't get away!",
      b: '🎯 Missable in the bag: **{trophy}**. One less scare on the way to the platinum.',
      c: "😮‍💨 Phew! **{trophy}** was missable and you didn't let it slip.",
      d: '🛟 **{trophy}** rescued right on time. One less missable keeping you up at night.',
    },
    unlocked: '🏆 **{trophy}** ({type}) in **{game}**',
    unlockedRate: '🏆 **{trophy}** ({type}, {rate}% of players) in **{game}**',
    unlockedSeveral: '{count} trophies in **{game}**:',
    unlockedItem: '🏆 **{trophy}** ({type})',
    unlockedItemRate: '🏆 **{trophy}** ({type}, {rate}% of players)',
    types: {
      platinum: 'platinum',
      gold: 'gold',
      silver: 'silver',
      bronze: 'bronze',
    },
  },
})

const TYPES = new Set(['platinum', 'gold', 'silver', 'bronze'])

type Named = Pick<GameContext, 'title'> & Partial<Pick<GameContext, 'game'>>
// The catalog's name ("Days Gone"), not the trophy list's ("DAYS GONE").
const gameName = (ctx: Named) => ctx.game?.name ?? ctx.title.name

type Trophy = GameContext['trophies'][number]

const english = (user: User) => userLocale(user) === Language.En

/** A trophy's name in the player's language: PSN's English name for a player reading English, the
 * pt-BR one (what a Brazilian console shows) otherwise. A list PSN has only in English gives the
 * English name in both: nothing here translates it. */
export const nameFor = (user: User, t: Pick<Trophy, 'name' | 'nameEn'>) =>
  tidy(english(user) && t.nameEn ? t.nameEn : t.name)

/** PSN's description of a trophy in the player's language, by the same rule as `nameFor`. */
export const detailFor = (user: User, t: Pick<Trophy, 'detail' | 'detailEn'>) =>
  english(user) && t.detailEn ? t.detailEn : t.detail

// The trophy a guide names: guides write the pt-BR name, sometimes the English one.
function listed(ctx: Pick<GameContext, 'trophies'>, name: string): Trophy | undefined {
  const key = tidy(name).toLowerCase()
  return ctx.trophies.find((x) =>
    [x.name, x.nameEn].some((n) => n && tidy(n).toLowerCase() === key),
  )
}

/** A trophy name the guide wrote, as the player reads it. */
const guideName = (user: User, ctx: Pick<GameContext, 'trophies'>, name: string) => {
  const found = listed(ctx, name)
  return found ? nameFor(user, found) : tidy(name)
}

/**
 * The guide's tips as the player reads them. The guide is written in pt-BR, so for a player reading
 * English its words (where an item is, when a missable closes) do not go into the notice: a tip about
 * a trophy becomes that trophy, by its English name, with PSN's English description, once per
 * trophy; a tip about no trophy (an item, a warning) has nothing to say in English and is left out.
 */
function readable(user: User, ctx: GameContext, tips: RouteTip[]): RouteTip[] {
  if (!english(user)) return tips
  const seen = new Set<number>()
  return tips.flatMap((tip): RouteTip[] => {
    const found = tip.trophy ? listed(ctx, tip.trophy) : undefined
    if (!found || seen.has(found.id)) return []
    seen.add(found.id)
    const kind = tip.kind === 'missable' ? 'missable' : 'trophy'
    return [{ kind, text: detailFor(user, found), trophy: nameFor(user, found) }]
  })
}

/** The plain notice for a game just started: its first trophies when it came with some (PSN lists a
 * game only once one pops), then the next trophy, the missables and what to keep at the whole game.
 * `after`: the stretch's checklist that follows it, whose missables are not listed again. */
export const startNotice = (
  user: User,
  ctx: GameContext,
  firsts: GameContext['trophies'] = [],
  after = '',
) => {
  const t = translator(messages, user)
  const opening = firsts.length
    ? together(unlockNotice(user, ctx, firsts), markNotice(user, ctx, firsts))
    : t('started', { game: gameName(ctx) })
  const { trophy, behind } = todaysFocus(ctx)
  const next = trophy
    ? t(behind ? 'focusNewBehind' : 'focusNew', {
        trophy: nameFor(user, trophy),
        detail: detailFor(user, trophy),
      })
    : undefined
  return together(opening, next, startLists(user, ctx, ongoingTrophies(ctx), after))
}

// A handful, so the first notice stays short; the guide lists them all.
const MISSABLES_MAX = 3

/** The guide's missables still open, in its order, without those the checklist after the notice
 * already names (by either name). A hidden one is only counted (`hidden`): its name would be a
 * spoiler. `trophy` is the list's own entry. */
export function openMissables(
  ctx: GameContext,
  after = '',
): { trophy: Trophy; when: string; hidden: boolean }[] {
  return (ctx.guide?.missables ?? []).flatMap((m) => {
    const found = listed(ctx, m.trophy)
    if (!found || found.earned) return []
    const names = [m.trophy, found.name, found.nameEn].filter(Boolean).map((n) => tidy(n))
    if (names.some((n) => after.includes(`**${n}**`))) return []
    return [{ trophy: found, when: m.when, hidden: !!found.hidden }]
  })
}

/** The start notice's own lists, as written after Nexo's words (Nexo would shorten them): the open
 * missables, then what to keep at the whole game. A missable says when it closes in the guide's
 * words, or, for a player reading English, what PSN says it asks for. */
export function startLists(
  user: User,
  ctx: GameContext,
  ongoing: GameContext['trophies'],
  after = '',
): string | undefined {
  const t = translator(messages, user)
  const missables = openMissables(ctx, after)
  const shown = missables.filter((m) => !m.hidden).slice(0, MISSABLES_MAX)
  const more = missables.length - shown.length
  const item = (m: (typeof shown)[number]) =>
    t('ongoingItem', {
      trophy: nameFor(user, m.trophy),
      detail: english(user) ? detailFor(user, m.trophy) : m.when,
    })
  const warn = shown.length
    ? [
        t('missables'),
        ...shown.map(item),
        ...(more ? [t('missablesMore', { count: more })] : []),
      ].join('\n')
    : undefined
  // A trophy in the missables list is not repeated in the next one.
  const warned = new Set(shown.map((m) => m.trophy.id))
  const keep = ongoing.filter((x) => !warned.has(x.id))
  return together(warn, ongoingBlock(user, keep)) || undefined
}

// A handful, so the first notice stays short; the journey lists them all.
const ONGOING_MAX = 3

/** The trophies to keep at the whole game (counters, collections, grinds), by the same pick as the
 * journey's "Throughout the journey". Without the trophy the next-trophy line already names. */
export function ongoingTrophies(ctx: GameContext): GameContext['trophies'] {
  const next = todaysFocus(ctx).trophy?.id
  return ongoingObjectives(ctx.trophies, ctx.guide)
    .map((x) => x.trophy)
    .filter((t) => t.id !== next)
    .slice(0, ONGOING_MAX)
}

/** The start notice's block with them, as written: Nexo would shorten it. */
function ongoingBlock(user: User, trophies: GameContext['trophies']): string | undefined {
  if (!trophies.length) return undefined
  const t = translator(messages, user)
  const items = trophies.map((x) =>
    t('ongoingItem', { trophy: nameFor(user, x), detail: detailFor(user, x) }),
  )
  return [t('ongoing'), ...items].join('\n')
}

// A game Nexo recommended this long ago, in a batch or as a pick, still counts as followed.
const FOLLOWED_DAYS = 30
const FOLLOWED = ['a', 'b', 'c', 'd'] as const

/** When the game just started was Nexo's recommendation: how many days ago, and why he gave. */
export async function followedRecommendation(
  user: User,
  game: string,
): Promise<{ daysAgo: number; why: string } | null> {
  const found = await lastRecommended(user.id, game, FOLLOWED_DAYS).catch(() => null)
  if (!found) return null
  const daysAgo = Math.floor((Date.now() - new Date(found.at).getTime()) / 86_400_000)
  return { daysAgo: Math.max(0, daysAgo), why: found.why }
}

/** The plain notice's line for a recommendation followed, always the same for a game. */
export const followedNotice = (user: User, game: string) => {
  const sum = [...game].reduce((n, c) => n + c.charCodeAt(0), 0)
  return translator(messages, user)(`followed.${FOLLOWED[sum % FOLLOWED.length]}`)
}

// The trophies just earned that the guide lists as missable, each with a line of relief.
export const missableCheer = (
  user: User,
  ctx: GameContext,
  unlocked: GameContext['trophies'],
): string | undefined => {
  const t = translator(messages, user)
  const missables = new Set(
    (ctx.guide?.missables ?? []).flatMap((m) => listed(ctx, m.trophy)?.id ?? []),
  )
  const lines = unlocked
    .filter((x) => missables.has(x.id))
    .map((x) => {
      const sum = [...x.name].reduce((n, c) => n + c.charCodeAt(0), 0)
      return t(`missableEarned.${FOLLOWED[sum % FOLLOWED.length]}`, { trophy: nameFor(user, x) })
    })
  return lines.length ? lines.join('\n') : undefined
}

/** The trophies just earned. One goes in a line with its game; several name the game once, above
 * them, instead of repeating it on every line. */
export const unlockNotice = (user: User, ctx: Named, unlocked: GameContext['trophies']) => {
  const t = translator(messages, user)
  const several = unlocked.length > 1
  const lines = unlocked.map((trophy) => {
    const params = {
      trophy: nameFor(user, trophy),
      type: TYPES.has(trophy.type)
        ? t(`types.${trophy.type}` as MessageKey<typeof messages>)
        : trophy.type,
      rate: fmtRate(userLocale(user), trophy.earnedRate),
      game: gameName(ctx),
    }
    if (several) return t(trophy.earnedRate ? 'unlockedItemRate' : 'unlockedItem', params)
    return trophy.earnedRate ? t('unlockedRate', params) : t('unlocked', params)
  })
  const head = several
    ? [t('unlockedSeveral', { count: unlocked.length, game: gameName(ctx) })]
    : []
  return [...head, ...lines].join('\n')
}

// The guide's note on what comes next, when this start or these unlocks reach one of its
// milestones. It needs no model, so it goes out whatever the notices switch says.
// Missables and collectibles go apart, as the guide writes them, after whatever text comes before
// (Nexo's words or a template): Nexo would shorten them, and the trophy's name and the spot are the
// point.
export function routeFor(user: User, ctx: GameContext, unlocked: string[], started: boolean) {
  const reached = reachedMilestone(ctx.guide, unlocked, started)
  const earned = ctx.trophies.filter((t) => t.earned).map((t) => t.name)
  const open = reached && stillOpen(reached, earned)
  if (!open) return undefined
  const milestone = { ...open, tips: readable(user, ctx, asMissables(ctx, open.tips)) }
  const apart = (tip: RouteTip) => tip.kind === 'collectible' || tip.kind === 'missable'
  const common = milestone.tips.filter((tip) => !apart(tip))
  const kept = milestone.tips.filter(apart)
  if (!common.length && !kept.length) return undefined
  return {
    text: common.length ? routeNotice({ ...milestone, tips: common }, userLocale(user)) : undefined,
    collectibles: kept.length ? stretchBlock(user, kept) : undefined,
  }
}

// The session's focus after these unlocks, for the plain notice: the same target the session notice
// named, or the next one when the player just earned it. Every notice names it.
export const focusNotice = (user: User, ctx: GameContext, unlocked: GameContext['trophies']) => {
  const t = translator(messages, user)
  const focus = focusAfter(ctx, unlocked)
  const closed = focus.completed ?? []
  const done = closed.length
    ? t('phaseDone', { phase: listOf(user, closed), count: closed.length })
    : undefined
  if (!focus.trophy) return done
  const trophy = nameFor(user, focus.trophy)
  const detail = detailFor(user, focus.trophy)
  const next = !focus.changed
    ? t('focusStill', { trophy })
    : t(focus.behind ? 'focusNewBehind' : 'focusNew', { trophy, detail })
  return together(done, next)
}

const listOf = (user: User, items: string[]) =>
  new Intl.ListFormat(userLocale(user), { type: 'conjunction' }).format(items)

// The first trophy, halfway, the final stretch or the platinum, for the plain notice.
export const markNotice = (user: User, ctx: GameContext, unlocked: GameContext['trophies']) => {
  const mark = progressMark(ctx.trophies, unlocked)
  if (!mark) return undefined
  const line = translator(messages, user)(`mark.${mark.kind}`, {
    game: gameName(ctx),
    earned: mark.earned,
    total: mark.total,
    count: mark.remaining.length,
    remaining: mark.remaining.map((n) => guideName(user, ctx, n)).join(', '),
  })
  return `${markCheer(user, mark.kind)} ${line}`
}

export const together = (...parts: (string | undefined)[]) => parts.filter(Boolean).join('\n\n')

// The session-start notice: the game and what is left, then what to do today, from the guide and the PSN
// list, so it costs no model and gets no count wrong. Lines with nothing to say are left out.
// With `again`, the player already got the full notice for this game and earned nothing since:
// only the suggestion, in one line, and the collectibles of the stretch they are in.
// Names and descriptions are PSN's in the player's language; the guide's own words (a trick, when a
// missable closes) are pt-BR and stay out of a notice in English.
export function sessionNotice(user: User, game: string, ctx?: GameContext, again = false): string {
  const t = translator(messages, user)
  if (!ctx) return `${t('playing', { game })} ${t('goodSession')}`
  const missing = ctx.trophies.filter(
    (x) => !x.earned && x.groupId === 'default' && x.type !== 'platinum',
  )
  const focus = todaysFocus(ctx)
  if (again) return againNotice(user, ctx, focus.trophy && nameFor(user, focus.trophy))

  const stretch = hereTips(user, ctx)
  const blocks = [
    missing.length
      ? t('heading', { game: gameName(ctx), left: t('left', { count: missing.length }) })
      : t('playing', { game: gameName(ctx) }),
    ...focusBlocks(user, focus),
    stretch,
    missableLine(user, ctx, focus.missable, stretch),
    almostLine(user, missing, focus.trophy?.id),
    t('goodSession'),
  ]
  return blocks.filter(Boolean).join('\n\n')
}

// The session's suggestion with PSN's description, and the guide's trick for it (pt-BR only).
function focusBlocks(user: User, focus: ReturnType<typeof todaysFocus>): string[] {
  const t = translator(messages, user)
  if (!focus.trophy) return []
  const trophy = nameFor(user, focus.trophy)
  const line = t(focus.behind ? 'focusBehind' : 'focus', { trophy })
  const trick = focus.trick && !english(user) ? t('tip', { tip: focus.trick }) : ''
  return [`${line}\n${detailFor(user, focus.trophy)}`, trick]
}

// The missable of the focus's phase, unless the stretch's checklist already names it.
function missableLine(
  user: User,
  ctx: GameContext,
  missable: ReturnType<typeof todaysFocus>['missable'],
  stretch: string,
): string {
  if (!missable) return ''
  const t = translator(messages, user)
  const trophy = guideName(user, ctx, missable.trophy)
  if (stretch.includes(`**${trophy}**`)) return ''
  return english(user)
    ? t('missableBare', { trophy })
    : t('missable', { trophy, when: missable.when })
}

// The tracked trophy closest to done, past halfway.
function almostLine(user: User, missing: Trophy[], focus?: number): string {
  const fill = (x: Trophy) => (x.progressValue ?? 0) / (x.progressTarget ?? 1)
  const almost = missing
    .filter((x) => x.progressTarget && x.id !== focus && fill(x) >= 0.5)
    .sort((a, b) => fill(b) - fill(a))[0]
  if (!almost) return ''
  return translator(messages, user)('almost', {
    trophy: nameFor(user, almost),
    value: almost.progressValue ?? 0,
    target: almost.progressTarget ?? 0,
  })
}

// The guide's tips for the stretch the player is in, without those about trophies they have.
function againNotice(user: User, ctx: GameContext, focus?: string): string {
  const t = translator(messages, user)
  const still = focus ? t('focusStill', { trophy: focus }) : undefined
  const line = [t('again', { game: gameName(ctx) }), still, t('goodSession')]
    .filter(Boolean)
    .join(' ')
  const stretch = hereTips(user, ctx, ['missable', 'collectible'])
  return stretch ? `${line}\n\n${stretch}` : line
}

function hereTips(user: User, ctx: GameContext, kinds?: string[]): string {
  const earned = ctx.trophies.filter((x) => x.earned).map((x) => x.name)
  const current = currentMilestone(ctx.guide, earned)
  const open = current && stillOpen(current, earned)
  const tips = asMissables(ctx, open?.tips ?? []).filter(
    (tip) => !kinds || kinds.includes(tip.kind),
  )
  const shown = readable(user, ctx, tips)
  return shown.length ? stretchBlock(user, shown) : ''
}

// A tip about a trophy the guide lists as missable is a missable tip, whatever kind the milestone
// gave it: many guides wrote "trophy" for a missable there.
function asMissables(ctx: GameContext, tips: RouteTip[]): RouteTip[] {
  const missables = new Set((ctx.guide?.missables ?? []).map((m) => tidy(m.trophy).toLowerCase()))
  return tips.map((tip) =>
    tip.trophy && tip.kind !== 'collectible' && missables.has(tidy(tip.trophy).toLowerCase())
      ? { ...tip, kind: 'missable' }
      : tip,
  )
}

// "Where you are in the game": the checklist summed up (what to pick up, the missables by name),
// then each item in the order the player meets it, several tips about one trophy under one heading.
function stretchBlock(user: User, tips: RouteTip[]): string {
  const locale = userLocale(user)
  const head = [translator(messages, user)('here'), collectibleSummary(tips, locale)]
    .filter(Boolean)
    .join('\n')
  const items = byTrophy(tips)
  return `${head}\n\n${items.map((tip, i) => tipLine(tip, locale, i + 1)).join('\n\n')}`
}
