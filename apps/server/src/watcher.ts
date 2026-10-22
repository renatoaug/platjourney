import { config } from './config.ts'
import { tagged } from './costs.ts'
import { ensureDeepGuide } from './deepguide.ts'
import { isDemo, trophiesFor } from './demo.ts'
import { focusAfter, tidy, todaysFocus } from './focus.ts'
import { ensureGuide, type Guide } from './guide.ts'
import {
  defineMessages,
  fmtRate,
  Language,
  type MessageKey,
  translator,
  userLocale,
} from './i18n.ts'
import { library } from './library.ts'
import { markCheer, progressMark } from './marks.ts'
import { type GameContext, proactiveTip, unlockReaction } from './nexo.ts'
import { deliver } from './notify.ts'
import { hours, playtimes } from './playtime.ts'
import { Refused } from './plugins.ts'
import {
  catalogTrophies,
  nowPlaying,
  PrivateProfile,
  recentTitles,
  type TitleProgress,
} from './psn.ts'
import { loadGroups } from './ranking.ts'
import { lastTip, logTip, type TipKind } from './repository/activity.ts'
import { pruneExpired } from './repository/auth.ts'
import { type Game, gameForTitle } from './repository/game.ts'
import { getGuide } from './repository/guide.ts'
import { requestGuide } from './repository/guide-request.ts'
import { pruneOauth } from './repository/oauth.ts'
import { lastRecommended } from './repository/recommendation.ts'
import { getTitle, markTipSent, saveEarnedIds, upsertTitle } from './repository/title.ts'
import { listUsers, type User, updateUser } from './repository/user.ts'
import { currentMilestone, reachedMilestone, routeNotice, stillOpen } from './route.ts'
import { checkServers } from './servers.ts'

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

// The game each user is playing: the last one PSN shows. It drives the notices, the session plan
// and the current game page.
const contexts = new Map<string, GameContext>()
export const getCurrent = (user: User) => contexts.get(user.id)
// The game the chat talks about when the player picked another with /game or a link: only the chat
// follows it. Starting to play another game brings the chat back to that game.
const chatContexts = new Map<string, GameContext>()
export const getChat = (user: User) => chatContexts.get(user.id) ?? contexts.get(user.id)
export const forgetUser = (id: string) => {
  contexts.delete(id)
  chatContexts.delete(id)
}

// Proactive messages go to Telegram when the user linked it; they are always in
// the web history through the tip log. Plain notices are written in the player's language.
const TYPES = new Set(['platinum', 'gold', 'silver', 'bronze'])

// A notice without the model: logged like any tip (so it reaches the bell) and sent to Telegram.
async function plainNotice(user: User, kind: TipKind, text: string, game?: string) {
  await logTip(user.id, kind, text, game)
  await notify(user, text)
}

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

// Nexo writes the notices when the instance allows it (AI_NOTICES) and the player wants it
// (the profile's switch); otherwise they come from plain templates, free.
const nexoNotices = (user: User) => config.automatic.notices && user.ai_notices !== false

// The guide's note on what comes next, when this start or these unlocks reach one of its
// milestones. It needs no model, so it goes out whatever the notices switch says.
function routeFor(user: User, ctx: GameContext, unlocked: string[], started: boolean) {
  const reached = reachedMilestone(ctx.guide, unlocked, started)
  const earned = ctx.trophies.filter((t) => t.earned).map((t) => t.name)
  const milestone = reached && stillOpen(reached, earned)
  return milestone ? routeNotice(milestone, userLocale(user)) : undefined
}

// One message per sweep: what happened, then the guide's note on what comes next.
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
const markNotice = (user: User, ctx: GameContext, unlocked: GameContext['trophies']) => {
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

// A send that fails (the player blocked the bot, Telegram is down, a push service errs) must not
// stop the sweep: the notice is already in the web history, and the trophies still get saved as
// seen, or the next sweep would write and pay for the same notice again.
async function notify(user: User, text: string): Promise<void> {
  await deliver(user, text)
}

// With automatic research off, the stored guide is used as it is and a missing one is only listed.
async function guideFor(user: User, title: TitleProgress, ctxTrophies: GameContext['trophies']) {
  const game = await gameForTitle(title)
  const cached = await getGuide<Guide>(game.id)
  // The demo player reads the stored guide and never asks for one.
  if (isDemo(user)) return cached
  if (!config.automatic.research) {
    if (!cached) await requestGuide(game.id)
    return cached
  }
  return ensureGuide(game, ctxTrophies, { name: title.name, platform: title.platform })
}

// Loads a title's context: its game, trophies, groups, guide and hours played.
async function loadContext(user: User, title: TitleProgress): Promise<GameContext> {
  const game = await gameForTitle(title)
  const [trophies, groups] = await Promise.all([trophiesFor(title, user), loadGroups(title, user)])
  const guide = await guideFor(user, title, trophies).catch((e) => {
    console.error('guide failed:', e.message)
    return undefined
  })
  if (guide && !isDemo(user))
    ensureDeepGuide(game, title.total).catch((e) => console.error('deep guide failed:', e.message))
  const played = await playtimes(user).catch(() => new Map())
  return { game, title, trophies, guide, groups, hoursPlayed: hours(played.get(game.id)) }
}

// The game being played changes: the watcher's own switch.
export async function setCurrent(user: User, title: TitleProgress): Promise<GameContext> {
  const ctx = await loadContext(user, title)
  contexts.set(user.id, ctx)
  return ctx
}

// The chat's game, picked with /game or a link: the game being played stays as it is. Picking the
// game being played again just drops the chat's own pick.
export async function setChat(user: User, title: TitleProgress): Promise<GameContext> {
  const playing = contexts.get(user.id)
  if (playing?.title.npCommunicationId === title.npCommunicationId) {
    chatContexts.delete(user.id)
    return playing
  }
  const ctx = await loadContext(user, title)
  chatContexts.set(user.id, ctx)
  return ctx
}

// A game the player does not own, for the chat: its official list with nothing earned and the
// stored guide (asked for, not researched, when there is none). Null when it has no trophy list.
export async function setChatFromCatalog(user: User, game: Game): Promise<GameContext | null> {
  const list = await catalogTrophies(game.np_communication_ids ?? [])
  if (!list) return null
  const count = (type: string) => list.trophies.filter((t) => t.type === type).length
  const title: TitleProgress = {
    npCommunicationId: list.np,
    name: game.name,
    platform: list.platform,
    iconUrl: game.cover_url ?? '',
    progress: 0,
    earned: 0,
    total: list.trophies.length,
    earnedByType: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
    definedByType: {
      bronze: count('bronze'),
      silver: count('silver'),
      gold: count('gold'),
      platinum: count('platinum') ? 1 : 0,
    },
    lastUpdated: '',
  }
  const guide = await getGuide<Guide>(game.id)
  if (!guide && !isDemo(user)) await requestGuide(game.id)
  const ctx: GameContext = {
    game,
    title,
    trophies: list.trophies,
    guide,
    groups: null,
    owned: false,
  }
  chatContexts.set(user.id, ctx)
  return ctx
}

// One check per player at a time: the sweep and a sign-in (watchNow) running together would both
// see the same trophies as new, before either saves them, and send the notice twice.
const checks = new Map<string, Promise<void>>()
export function checkUser(user: User): Promise<void> {
  const next = (checks.get(user.id) ?? Promise.resolve())
    .catch(() => {})
    .then(() => check(user))
    .finally(() => {
      if (checks.get(user.id) === next) checks.delete(user.id)
    })
  checks.set(user.id, next)
  return next
}

// The stored snapshot is behind PSN's summary of the title, or there is none yet.
function titleChanged(prev: Awaited<ReturnType<typeof getTitle>>, latest: TitleProgress): boolean {
  return (
    !prev ||
    prev.earned !== latest.earned ||
    new Date(prev.last_updated_at).getTime() !== new Date(latest.lastUpdated).getTime()
  )
}

// PSN updates a title's summary before its trophy list: a list read in between has fewer
// earned trophies than the summary, and once the summary stops changing it would be reused
// forever, missing those trophies. Such a list is read again until the two agree.
function listStale(current: GameContext | undefined, latest: TitleProgress): boolean {
  return !!current && current.trophies.filter((t) => t.earned).length < latest.earned
}

// What one check found to tell the player.
interface News {
  user: User
  ctx: GameContext
  latest: TitleProgress
  justStarted: boolean
  unlocked: GameContext['trophies']
  route: ReturnType<typeof routeFor>
}

// Without Nexo's notices the player still hears about it, from a plain template.
async function plainNews({ user, ctx, latest, justStarted, unlocked, route }: News): Promise<void> {
  if (justStarted) {
    const followed = await followedRecommendation(user, ctx.game.id)
    await plainNotice(
      user,
      'start',
      together(
        followed ? followedNotice(user, ctx.game.id) : undefined,
        startNotice(user, ctx),
        route,
      ),
      ctx.game.id,
    )
    await markTipSent(user.id, latest.npCommunicationId)
  } else if (unlocked.length > 0)
    await plainNotice(
      user,
      'unlock',
      together(
        unlockNotice(user, ctx, unlocked),
        markNotice(user, ctx, unlocked),
        focusNotice(user, ctx, unlocked),
        route,
      ),
      ctx.game.id,
    )
  else if (route) await plainNotice(user, 'route', route, ctx.game.id)
}

async function nexoNews({ user, ctx, latest, justStarted, unlocked, route }: News): Promise<void> {
  if (justStarted) {
    console.log(`${user.psn_online_id}: new game ${latest.name}`)
    const followed = await followedRecommendation(user, ctx.game.id)
    await notify(user, await proactiveTip(user, ctx, route, followed ?? undefined))
    await markTipSent(user.id, latest.npCommunicationId)
  } else if (unlocked.length > 0) {
    console.log(`${user.psn_online_id}: unlocked ${unlocked.map((t) => t.name).join(', ')}`)
    await notify(user, await unlockReaction(user, ctx, unlocked, route))
  } else if (route) await plainNotice(user, 'route', route, ctx.game.id)
}

async function tellNews(news: News): Promise<void> {
  if (!nexoNotices(news.user)) return plainNews(news)
  try {
    await nexoNews(news)
  } catch (e) {
    logFallback(news.user, e)
    await plainNews(news)
  }
}

// Why Nexo's words gave way to the plain notice.
function logFallback(user: User, e: unknown): void {
  if (e instanceof Refused) {
    // A plugin refused Nexo's words (see plugins.ts): the plain notice needs no model.
    console.log(`${user.psn_online_id}: ${e.code}, plain notice`)
    return
  }
  // The model is down (provider quota, outage): still tell the player,
  // without Nexo's comment, and let the sweep record what it saw.
  console.warn(
    `${user.psn_online_id}: Nexo unavailable, plain notice:`,
    (e as Error).message.slice(0, 80),
  )
}

// Compares the user's PSN title list against the stored snapshot. A title we
// have never tipped that is still early triggers the intro; newly earned trophies
// on the current title trigger a reaction.
async function check(user: User): Promise<void> {
  // The demo player has no PSN profile to watch.
  if (isDemo(user)) return
  const titles = await recentTitles(user.psn_account_id, 5)
  if (titles.length === 0) return

  const latest = titles[0]
  const current = contexts.get(user.id)
  const switched = current?.title.npCommunicationId !== latest.npCommunicationId
  const prev = await getTitle(user.id, latest.npCommunicationId)
  const ctx =
    switched || titleChanged(prev, latest) || listStale(current, latest) || !current
      ? await setCurrent(user, latest)
      : current
  // Playing another game brings the chat to it too.
  if (switched && current) chatContexts.delete(user.id)

  for (const t of titles) await upsertTitle(user.id, t)

  const earnedIds = ctx.trophies.filter((t) => t.earned).map((t) => t.id)
  const knownIds = new Set<number>(prev?.earned_ids ?? [])
  // A first sync of an account must not greet every old game as new.
  const firstSync = !prev && latest.earned > 0 && latest.progress >= 10
  const justStarted = !firstSync && !prev?.last_tip_at && latest.progress < 10
  // The ids seen are trusted when there are some, or when the stored title had none earned: the
  // first trophy of a game is news too. A title stored with trophies but no ids was never watched
  // (another game was in front then), and announcing its old trophies would be wrong.
  const watched = knownIds.size > 0 || prev?.earned === 0
  const unlocked = watched ? ctx.trophies.filter((t) => t.earned && !knownIds.has(t.id)) : []

  const route = routeFor(
    user,
    ctx,
    unlocked.map((t) => t.name),
    justStarted,
  )
  await tellNews({ user, ctx, latest, justStarted, unlocked, route })
  await saveEarnedIds(user.id, latest.npCommunicationId, earnedIds)
  await sessionStart(user, ctx, justStarted)
}

// One session-start notice every few hours at most; until then the player's presence is not
// even asked, which also spares PSN a call per sweep.
export const SESSION_NOTICE_HOURS = 6

const comparable = (name: string) =>
  name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')

// The session-start notice: the game and what is left, then what to do today, from the guide and the PSN
// list, so it costs no model and gets no count wrong. Lines with nothing to say are left out.
// With `again`, the player already got the full notice for this game and earned nothing since:
// only the suggestion, in one line.
export function sessionNotice(user: User, game: string, ctx?: GameContext, again = false): string {
  const t = translator(messages, user)
  if (!ctx) return `${t('playing', { game })} ${t('goodSession')}`
  const opening = t('playing', { game: gameName(ctx) })
  const missing = ctx.trophies.filter(
    (x) => !x.earned && x.groupId === 'default' && x.type !== 'platinum',
  )
  const { trophy: focus, trick, missable, behind } = todaysFocus(ctx)
  if (again) {
    const still = focus ? t('focusStill', { trophy: focus.name }) : undefined
    return [t('again', { game: gameName(ctx) }), still, t('goodSession')].filter(Boolean).join(' ')
  }

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
  const stretch = hereTips(ctx)
  if (stretch) blocks.push(`${t('here')}\n${stretch}`)
  if (missable) blocks.push(t('missable', { trophy: missable.trophy, when: missable.when }))
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
function hereTips(ctx: GameContext): string {
  const earned = ctx.trophies.filter((x) => x.earned).map((x) => x.name)
  const current = currentMilestone(ctx.guide, earned)
  const open = current && stillOpen(current, earned)
  return open ? open.tips.map(tipLine).join('\n\n') : ''
}

// A collectible tip opens with its name ("Souvenir 1/21, Best player: ..."): the name goes in
// bold on a line of its own, the directions below it.
function tipLine(tip: { kind: string; text: string }): string {
  const at = tip.text.indexOf(': ')
  if (tip.kind !== 'collectible' || at < 0) return `• ${tip.text}`
  const rest = tip.text.slice(at + 2)
  return `• **${tip.text.slice(0, at)}**\n${rest.charAt(0).toUpperCase()}${rest.slice(1)}`
}

// A full session notice repeats itself when the player opens the same game again the same day
// without earning anything: the last one was for this game, within a day, and nothing came since.
export const SESSION_AGAIN_HOURS = 24

async function nothingNew(user: User, ctx: GameContext): Promise<boolean> {
  const last = await lastTip(user.id, 'session')
  if (!last || last.game !== ctx.game.id) return false
  const at = new Date(last.created_at).getTime()
  if (Date.now() - at > SESSION_AGAIN_HOURS * 3_600_000) return false
  return !ctx.trophies.some((x) => x.earnedAt && new Date(x.earnedAt).getTime() > at)
}

// Tells the player once when they open a game, from PSN presence (players who hide their online
// status never get it). The game they play is the one in context when the names match.
async function sessionStart(user: User, ctx: GameContext, noticed: boolean): Promise<void> {
  const last = user.session_notice_at ? new Date(user.session_notice_at).getTime() : 0
  if (Date.now() - last < SESSION_NOTICE_HOURS * 3_600_000) return
  const playing = await nowPlaying(user.psn_account_id)
  if (!playing) return
  // The start notice of a new game already went out in this sweep: it counts as this one.
  if (!noticed) {
    const same = comparable(playing) === comparable(ctx.title.name)
    const text = sessionNotice(
      user,
      playing,
      same ? ctx : undefined,
      same && (await nothingNew(user, ctx)),
    )
    await plainNotice(user, 'session', text, same ? ctx.game.id : undefined)
  }
  await updateUser(user.id, { session_notice_at: new Date() })
}

// Users are visited one after the other so PSN sees a steady, modest stream.
async function sweep(each: (user: User) => Promise<void>, label: string): Promise<void> {
  for (const user of await listUsers()) {
    if (isDemo(user)) continue
    await tagged({ user: user.id }, () => each(user)).catch((e) => {
      // Hidden trophies are the player's choice, not a failure; the page tells them.
      if (!(e instanceof PrivateProfile))
        console.error(`${label} failed for ${user.psn_online_id}:`, e.message)
    })
    await new Promise((r) => setTimeout(r, 1500))
  }
}

// The demo player's current game is its stored title played last that has no platinum yet.
export async function demoContext(user: User): Promise<GameContext | undefined> {
  return tagged({ user: user.id, demo: true }, async () => {
    const titles = await library(user.psn_account_id)
    const latest = titles.find((t) => t.earnedByType.platinum === 0) ?? titles[0]
    return latest && setCurrent(user, latest)
  })
}

// Loads a user's context right after they sign in, without waiting for the next sweep.
// The chat's game for a message: after a restart nothing is loaded until the next sweep, and a
// message sent then would land in no game's conversation; one check picks the game being played.
export async function chatOrCheck(user: User): Promise<GameContext | undefined> {
  const ctx = getChat(user)
  if (ctx || isDemo(user)) return ctx
  await checkUser(user).catch((e) => console.error('check before chat failed:', e.message))
  return getChat(user)
}

export function watchNow(user: User): void {
  const work = async () => {
    if (isDemo(user)) await demoContext(user)
    else await checkUser(user)
  }
  tagged({ user: user.id }, work).catch((e) =>
    console.error(`watcher failed for ${user.psn_online_id}:`, e.message),
  )
}

export function startWatcher(minutes: number): void {
  const run = () => sweep(checkUser, 'watcher')
  run()
  setInterval(run, minutes * 60_000)
  const prune = () =>
    Promise.all([pruneExpired(), pruneOauth()]).catch((e) =>
      console.error('prune failed:', e.message),
    )
  prune()
  setInterval(prune, 60 * 60_000)

  // Checking servers searches the web; without automatic research it runs only by hand
  // (scripts/check-servers.ts).
  if (!config.automatic.research) return
  const servers = () =>
    sweep(async (user) => {
      const warnings = await checkServers(user, await library(user.psn_account_id))
      for (const w of warnings) await notify(user, w)
    }, 'server check')
  setTimeout(servers, 2 * 60_000)
  setInterval(servers, 24 * 60 * 60_000)
}
