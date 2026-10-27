import { config } from './config.ts'
import { tagged } from './costs.ts'
import { isDemo } from './demo.ts'
import { demoContext, dropChat, getChat, getCurrent, setCurrent } from './game-context.ts'
import { library } from './library.ts'
import { type GameContext, proactiveTip, unlockReaction } from './nexo.ts'
import {
  focusNotice,
  followedNotice,
  followedRecommendation,
  markNotice,
  missableCheer,
  routeFor,
  sessionNotice,
  startNotice,
  together,
  unlockNotice,
} from './notices.ts'
import { deliver } from './notify.ts'
import { Refused } from './plugins.ts'
import { nowPlaying, PrivateProfile, recentTitles, type TitleProgress } from './psn.ts'
import { lastTip, logTip, type TipKind } from './repository/activity.ts'
import { pruneExpired } from './repository/auth.ts'
import { pruneOauth } from './repository/oauth.ts'
import { getTitle, markTipSent, saveEarnedIds, upsertTitle } from './repository/title.ts'
import { getUser, listUsers, type User, updateUser } from './repository/user.ts'
import { checkServers } from './servers.ts'

// Proactive messages go to Telegram when the user linked it; they are always in
// the web history through the tip log. Plain notices are written in the player's language.
// A notice without the model: logged like any tip (so it reaches the bell) and sent to Telegram.
async function plainNotice(user: User, kind: TipKind, text: string, game?: string) {
  await logTip(user.id, kind, text, game)
  await notify(user, text)
}

// Nexo writes the notices when the instance allows it (AI_NOTICES) and the player wants it
// (the profile's switch); otherwise they come from plain templates, free.
const nexoNotices = (user: User) => config.automatic.notices && user.ai_notices !== false

// A send that fails (the player blocked the bot, Telegram is down, a push service errs) must not
// stop the sweep: the notice is already in the web history, and the trophies still get saved as
// seen, or the next sweep would write and pay for the same notice again.
async function notify(user: User, text: string): Promise<void> {
  await deliver(user, text)
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

// One message per sweep: what happened, then the guide's note on what comes next.
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
        route?.text,
        route?.collectibles,
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
        missableCheer(user, ctx, unlocked),
        markNotice(user, ctx, unlocked),
        focusNotice(user, ctx, unlocked, !!route?.collectibles),
        route?.text,
        route?.collectibles,
      ),
      ctx.game.id,
    )
  else if (route)
    await plainNotice(user, 'route', together(route.text, route.collectibles), ctx.game.id)
}

async function nexoNews({ user, ctx, latest, justStarted, unlocked, route }: News): Promise<void> {
  if (justStarted) {
    console.log(`${user.psn_online_id}: new game ${latest.name}`)
    const followed = await followedRecommendation(user, ctx.game.id)
    await notify(
      user,
      await proactiveTip(user, ctx, route?.text, followed ?? undefined, route?.collectibles),
    )
    await markTipSent(user.id, latest.npCommunicationId)
  } else if (unlocked.length > 0) {
    console.log(`${user.psn_online_id}: unlocked ${unlocked.map((t) => t.name).join(', ')}`)
    await notify(
      user,
      await unlockReaction(
        user,
        ctx,
        unlocked,
        route?.text,
        route?.collectibles,
        missableCheer(user, ctx, unlocked),
      ),
    )
  } else if (route)
    await plainNotice(user, 'route', together(route.text, route.collectibles), ctx.game.id)
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
  const current = getCurrent(user)
  const switched = current?.title.npCommunicationId !== latest.npCommunicationId
  const prev = await getTitle(user.id, latest.npCommunicationId)
  const ctx =
    switched || titleChanged(prev, latest) || listStale(current, latest) || !current
      ? await setCurrent(user, latest)
      : current
  // Playing another game brings the chat to it too.
  if (switched && current) dropChat(user.id)

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

function recentNotice(user: User): boolean {
  const last = user.session_notice_at ? new Date(user.session_notice_at).getTime() : 0
  return Date.now() - last < SESSION_NOTICE_HOURS * 3_600_000
}

// Tells the player once when they open a game, from PSN presence (players who hide their online
// status never get it). The game they play is the one in context when the names match.
async function sessionStart(user: User, ctx: GameContext, noticed: boolean): Promise<void> {
  if (recentNotice(user)) return
  // Checks queued behind each other (sign-up and the first home load) carry the user as it was
  // read before the first one ran: the stored stamp is the one that counts.
  if (recentNotice((await getUser(user.id)) ?? user)) return
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
