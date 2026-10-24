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
    missable: '⚠️ **{trophy}** é perdível: {when}',
    almost: '**Quase lá**: {trophy}, {value} de {target}.',
    focusStill: 'A sugestão de próximo troféu continua sendo **{trophy}**.',
    mark: {
      first: 'Primeiro troféu de {game}: a jornada começou.',
      half: 'Metade do jogo base: {earned} de {total} troféus.',
      final: 'Reta final: faltam {count} para a platina: {remaining}.',
      platinum: 'Platina de {game}! Parabéns.',
    },
    focusNew:
      '**Sugestão de próximo troféu**\nSeguindo o roteiro, o próximo a pipocar deve ser **{trophy}**.\n{detail}',
    focusNewBehind:
      '**Sugestão de próximo troféu**\nPelo momento em que você está, vale buscar **{trophy}**, que ficou para trás.\n{detail}',
    phaseDone: '🎉 Fechou a {phase} do roteiro!',
    // A missable just earned: one of these, the same per trophy.
    missableEarned: {
      a: '🔒 **{trophy}** era perdível e agora é seu para sempre. Esse não escapou!',
      b: '🎯 Perdível no bolso: **{trophy}**. Um susto a menos no caminho da platina.',
      c: '😮‍💨 Ufa! **{trophy}** era perdível e você não deixou passar.',
      d: '🛟 **{trophy}** resgatado na hora certa. Menos um perdível tirando o sono.',
    },
    unlocked: '🏆 **{trophy}** ({type}) em **{game}**',
    unlockedRate: '🏆 **{trophy}** ({type}, {rate}% de quem joga) em **{game}**',
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
    missable: '⚠️ **{trophy}** is missable: {when}',
    almost: '**Almost there**: {trophy}, {value} of {target}.',
    focusStill: 'The suggested next trophy is still **{trophy}**.',
    mark: {
      first: 'First trophy in {game}: the journey has begun.',
      half: 'Halfway through the base game: {earned} of {total} trophies.',
      final: 'Final stretch: {count} left to the platinum: {remaining}.',
      platinum: 'Platinum in {game}! Congratulations.',
    },
    focusNew:
      '**Suggested next trophy**\nFollowing the roadmap, the next one to pop should be **{trophy}**.\n{detail}',
    focusNewBehind:
      '**Suggested next trophy**\nWhere you are now, **{trophy}** is worth going after: it was left behind.\n{detail}',
    phaseDone: '🎉 You closed {phase} of the roadmap!',
    missableEarned: {
      a: "🔒 **{trophy}** was missable and now it's yours for good. That one didn't get away!",
      b: '🎯 Missable in the bag: **{trophy}**. One less scare on the way to the platinum.',
      c: "😮‍💨 Phew! **{trophy}** was missable and you didn't let it slip.",
      d: '🛟 **{trophy}** rescued right on time. One less missable keeping you up at night.',
    },
    unlocked: '🏆 **{trophy}** ({type}) in **{game}**',
    unlockedRate: '🏆 **{trophy}** ({type}, {rate}% of players) in **{game}**',
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

export const startNotice = (user: User, ctx: Named) =>
  translator(messages, user)('started', { game: gameName(ctx) })

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
  const missables = new Set((ctx.guide?.missables ?? []).map((m) => tidy(m.trophy).toLowerCase()))
  const lines = unlocked
    .filter((x) => missables.has(tidy(x.name).toLowerCase()))
    .map((x) => {
      const sum = [...x.name].reduce((n, c) => n + c.charCodeAt(0), 0)
      return t(`missableEarned.${FOLLOWED[sum % FOLLOWED.length]}`, { trophy: tidy(x.name) })
    })
  return lines.length ? lines.join('\n') : undefined
}

export const unlockNotice = (user: User, ctx: Named, unlocked: GameContext['trophies']) => {
  const t = translator(messages, user)
  return unlocked
    .map((trophy) => {
      const params = {
        trophy: tidy(trophy.name),
        type: TYPES.has(trophy.type)
          ? t(`types.${trophy.type}` as MessageKey<typeof messages>)
          : trophy.type,
        rate: fmtRate(userLocale(user), trophy.earnedRate),
        game: gameName(ctx),
      }
      return trophy.earnedRate ? t('unlockedRate', params) : t('unlocked', params)
    })
    .join('\n')
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
  const milestone = { ...open, tips: asMissables(ctx, open.tips) }
  const apart = (tip: RouteTip) => tip.kind === 'collectible' || tip.kind === 'missable'
  const common = milestone.tips.filter((tip) => !apart(tip))
  const kept = milestone.tips.filter(apart)
  return {
    text: common.length ? routeNotice({ ...milestone, tips: common }, userLocale(user)) : undefined,
    collectibles: kept.length ? stretchBlock(user, kept) : undefined,
  }
}

// The session's focus after these unlocks, for the plain notice: the same target the session notice
// named, or the next one when the player just earned it.
export const focusNotice = (user: User, ctx: GameContext, unlocked: GameContext['trophies']) => {
  const t = translator(messages, user)
  const focus = focusAfter(ctx, unlocked)
  const done = focus.completed ? t('phaseDone', { phase: focus.completed }) : undefined
  if (!focus.trophy) return done
  const next = !focus.changed
    ? t('focusStill', { trophy: focus.trophy.name })
    : focus.behind
      ? t('focusNewBehind', { trophy: focus.trophy.name, detail: focus.trophy.detail })
      : t('focusNew', { trophy: focus.trophy.name, detail: focus.trophy.detail })
  return together(done, next)
}

// The first trophy, halfway, the final stretch or the platinum, for the plain notice.
export const markNotice = (user: User, ctx: GameContext, unlocked: GameContext['trophies']) => {
  const mark = progressMark(ctx.trophies, unlocked)
  if (!mark) return undefined
  const line = translator(messages, user)(`mark.${mark.kind}`, {
    game: gameName(ctx),
    earned: mark.earned,
    total: mark.total,
    count: mark.remaining.length,
    remaining: mark.remaining.join(', '),
  })
  return `${markCheer(user, mark.kind)} ${line}`
}

export const together = (...parts: (string | undefined)[]) => parts.filter(Boolean).join('\n\n')

// The session-start notice: the game and what is left, then what to do today, from the guide and the PSN
// list, so it costs no model and gets no count wrong. Lines with nothing to say are left out.
// With `again`, the player already got the full notice for this game and earned nothing since:
// only the suggestion, in one line, and the collectibles of the stretch they are in.
export function sessionNotice(user: User, game: string, ctx?: GameContext, again = false): string {
  const t = translator(messages, user)
  if (!ctx) return `${t('playing', { game })} ${t('goodSession')}`
  const opening = t('playing', { game: gameName(ctx) })
  const missing = ctx.trophies.filter(
    (x) => !x.earned && x.groupId === 'default' && x.type !== 'platinum',
  )
  const { trophy: focus, trick, missable, behind } = todaysFocus(ctx)
  if (again) return againNotice(user, ctx, focus?.name)

  const blocks = [
    missing.length
      ? t('heading', { game: gameName(ctx), left: t('left', { count: missing.length }) })
      : opening,
  ]
  if (focus) {
    const line = behind
      ? t('focusBehind', { trophy: focus.name })
      : t('focus', { trophy: focus.name })
    blocks.push(`${line}\n${focus.detail}`)
    if (trick) blocks.push(t('tip', { tip: trick }))
  }
  const stretch = hereTips(user, ctx)
  if (stretch) blocks.push(stretch)
  if (missable && !stretch.includes(`**${missable.trophy}**`))
    blocks.push(t('missable', { trophy: missable.trophy, when: missable.when }))
  // The tracked trophy closest to done, past halfway.
  const almost = missing
    .filter(
      (x) => x.progressTarget && x !== focus && (x.progressValue ?? 0) / x.progressTarget >= 0.5,
    )
    .sort(
      (a, b) =>
        (b.progressValue ?? 0) / (b.progressTarget ?? 1) -
        (a.progressValue ?? 0) / (a.progressTarget ?? 1),
    )[0]
  if (almost)
    blocks.push(
      t('almost', {
        trophy: almost.name,
        value: almost.progressValue ?? 0,
        target: almost.progressTarget ?? 0,
      }),
    )
  blocks.push(t('goodSession'))
  return blocks.join('\n\n')
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
  return tips.length ? stretchBlock(user, tips) : ''
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
// then each item in the order the player meets it.
function stretchBlock(user: User, tips: RouteTip[]): string {
  const locale = userLocale(user)
  const head = [translator(messages, user)('here'), collectibleSummary(tips, locale)]
    .filter(Boolean)
    .join('\n')
  return `${head}\n${tips.map((tip) => tipLine(tip, locale)).join('\n\n')}`
}
