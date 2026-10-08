import { config } from './config.ts'
import { tagged } from './costs.ts'
import { ensureDeepGuide } from './deepguide.ts'
import { isDemo, trophiesFor } from './demo.ts'
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
import { type GameContext, proactiveTip, unlockReaction } from './nexo.ts'
import { hours, playtimes } from './playtime.ts'
import { Refused } from './plugins.ts'
import { nowPlaying, PrivateProfile, recentTitles, type TitleProgress } from './psn.ts'
import { loadGroups } from './ranking.ts'
import { logTip, type TipKind } from './repository/activity.ts'
import { pruneExpired } from './repository/auth.ts'
import { gameForTitle } from './repository/game.ts'
import { getGuide } from './repository/guide.ts'
import { requestGuide } from './repository/guide-request.ts'
import { getTitle, markTipSent, saveEarnedIds, upsertTitle } from './repository/title.ts'
import { listUsers, type User, updateUser } from './repository/user.ts'
import { reachedMilestone, routeNotice, stillOpen } from './route.ts'
import { checkServers } from './servers.ts'
import { sendMessage } from './telegram.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    started: 'Você começou {game}. O guia da platina está no PlatJourney.',
    sessionOpen: '🎮 {game} aberto. Bom jogo!',
    sessionLeft: {
      one: 'Falta 1 troféu do jogo base para a platina.',
      other: 'Faltam {count} troféus do jogo base para a platina.',
    },
    sessionNext: 'Próximo no roteiro ({phase}): {trophies}.',
    unlocked: '🏆 {trophy} ({type}) em {game}',
    unlockedRate: '🏆 {trophy} ({type}, {rate}% de quem joga) em {game}',
    types: {
      platinum: 'platina',
      gold: 'ouro',
      silver: 'prata',
      bronze: 'bronze',
    },
  },
  [Language.En]: {
    started: 'You started {game}. The platinum guide is on PlatJourney.',
    sessionOpen: '🎮 {game} is on. Have a good session!',
    sessionLeft: {
      one: '1 base-game trophy left for the platinum.',
      other: '{count} base-game trophies left for the platinum.',
    },
    sessionNext: 'Next on the roadmap ({phase}): {trophies}.',
    unlocked: '🏆 {trophy} ({type}) in {game}',
    unlockedRate: '🏆 {trophy} ({type}, {rate}% of players) in {game}',
    types: {
      platinum: 'platinum',
      gold: 'gold',
      silver: 'silver',
      bronze: 'bronze',
    },
  },
})

// The game each user is talking about: the last one they played, or the one they
// picked with /game.
const contexts = new Map<string, GameContext>()
export const getCurrent = (user: User) => contexts.get(user.id)
export const forgetUser = (id: string) => contexts.delete(id)

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

export const unlockNotice = (user: User, ctx: Named, unlocked: GameContext['trophies']) => {
  const t = translator(messages, user)
  return unlocked
    .map((trophy) => {
      const params = {
        trophy: trophy.name,
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
export const together = (...parts: (string | undefined)[]) => parts.filter(Boolean).join('\n\n')

// A send that fails (the player blocked the bot, Telegram is down) must not stop the sweep: the
// notice is already in the web history, and the trophies still get saved as seen, or the next
// sweep would write and pay for the same notice again.
async function notify(user: User, text: string): Promise<void> {
  if (!user.telegram_chat_id) return
  await sendMessage(user.telegram_chat_id, text).catch((e) =>
    console.warn(`${user.psn_online_id}: telegram send failed:`, (e as Error).message.slice(0, 80)),
  )
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

// Switches the chat context to another title (used by /game and the detail page).
export async function setCurrent(user: User, title: TitleProgress): Promise<GameContext> {
  const game = await gameForTitle(title)
  const [trophies, groups] = await Promise.all([trophiesFor(title, user), loadGroups(title, user)])
  const guide = await guideFor(user, title, trophies).catch((e) => {
    console.error('guide failed:', e.message)
    return undefined
  })
  if (guide && !isDemo(user))
    ensureDeepGuide(game, title.total).catch((e) => console.error('deep guide failed:', e.message))
  const played = await playtimes(user).catch(() => new Map())
  const ctx = { game, title, trophies, guide, groups, hoursPlayed: hours(played.get(game.id)) }
  contexts.set(user.id, ctx)
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
  const changed =
    !prev ||
    prev.earned !== latest.earned ||
    new Date(prev.last_updated_at).getTime() !== new Date(latest.lastUpdated).getTime()
  const ctx = switched || changed || !current ? await setCurrent(user, latest) : current

  for (const t of titles) await upsertTitle(user.id, t)

  const earnedIds = ctx.trophies.filter((t) => t.earned).map((t) => t.id)
  const knownIds = new Set<number>(prev?.earned_ids ?? [])
  // A first sync of an account must not greet every old game as new.
  const firstSync = !prev && latest.earned > 0 && latest.progress >= 10
  const justStarted = !firstSync && !prev?.last_tip_at && latest.progress < 10
  const unlocked =
    knownIds.size > 0 ? ctx.trophies.filter((t) => t.earned && !knownIds.has(t.id)) : []

  const route = routeFor(
    user,
    ctx,
    unlocked.map((t) => t.name),
    justStarted,
  )
  // Without Nexo's notices the player still hears about it, from a plain template.
  const plain = async () => {
    if (justStarted) {
      await plainNotice(user, 'start', together(startNotice(user, ctx), route), ctx.game.id)
      await markTipSent(user.id, latest.npCommunicationId)
    } else if (unlocked.length > 0)
      await plainNotice(
        user,
        'unlock',
        together(unlockNotice(user, ctx, unlocked), route),
        ctx.game.id,
      )
    else if (route) await plainNotice(user, 'route', route, ctx.game.id)
  }
  if (!nexoNotices(user)) await plain()
  else
    try {
      if (justStarted) {
        console.log(`${user.psn_online_id}: new game ${latest.name}`)
        await notify(user, await proactiveTip(user, ctx, route))
        await markTipSent(user.id, latest.npCommunicationId)
      } else if (unlocked.length > 0) {
        console.log(`${user.psn_online_id}: unlocked ${unlocked.map((t) => t.name).join(', ')}`)
        await notify(user, await unlockReaction(user, ctx, unlocked, route))
      } else if (route) await plainNotice(user, 'route', route, ctx.game.id)
    } catch (e) {
      if (e instanceof Refused) {
        // A plugin refused Nexo's words (see plugins.ts): the plain notice needs no model.
        console.log(`${user.psn_online_id}: ${e.code}, plain notice`)
        await plain()
      } else {
        // The model is down (provider quota, outage): still tell the player,
        // without Nexo's comment, and let the sweep record what it saw.
        console.warn(
          `${user.psn_online_id}: Nexo unavailable, plain notice:`,
          (e as Error).message.slice(0, 80),
        )
        await plain()
      }
    }
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

// What a session-start notice says about the game: what is left for the platinum and the
// roadmap phase the player is in, with up to three of its trophies still missing.
export function sessionNotice(user: User, game: string, ctx?: GameContext): string {
  const t = translator(messages, user)
  if (!ctx) return t('sessionOpen', { game })
  const missing = ctx.trophies.filter(
    (x) => !x.earned && x.groupId === 'default' && x.type !== 'platinum',
  )
  const parts = [t('sessionOpen', { game: gameName(ctx) })]
  if (missing.length) parts.push(t('sessionLeft', { count: missing.length }))
  const names = new Set(missing.map((x) => x.name))
  const phase = ctx.guide?.roadmap?.find((r) => r.trophies?.some((n) => names.has(n)))
  if (phase) {
    const trophies = phase.trophies.filter((n) => names.has(n)).slice(0, 3)
    parts.push(t('sessionNext', { phase: phase.phase, trophies: trophies.join(', ') }))
  }
  return parts.join('\n')
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
    const text = sessionNotice(user, playing, same ? ctx : undefined)
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
  const prune = () => pruneExpired().catch((e) => console.error('prune failed:', e.message))
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
