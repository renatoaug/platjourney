import { config } from './config.ts'
import { tagged } from './costs.ts'
import { isDemo } from './demo.ts'
import {
  demoContext,
  dropChat,
  getChat,
  getCurrent,
  refreshCounters,
  setCurrent,
  setCurrentFromPresence,
} from './game-context.ts'
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
import { expirePlans } from './planner.ts'
import { aroundNotice, projectGame, Refused } from './plugins.ts'
import { nowPlaying, PrivateProfile, recentTitles, type TitleProgress } from './psn.ts'
import { lastTip, logTip, type TipKind } from './repository/activity.ts'
import { pruneExpired } from './repository/auth.ts'
import { gameByName } from './repository/game.ts'
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
// When each player was last checked, by the sweep or before a chat message.
const checkedAt = new Map<string, number>()
export function checkUser(user: User): Promise<void> {
  checkedAt.set(user.id, Date.now())
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
  /** On a game just started, the trophies it came with: PSN lists a game only once one pops. */
  firsts: GameContext['trophies']
  route: ReturnType<typeof routeFor>
}

// One message per sweep: what happened, then the guide's note on what comes next.
// Without Nexo's notices the player still hears about it, from a plain template.
async function plainNews({
  user,
  ctx,
  latest,
  justStarted,
  unlocked,
  firsts,
  route,
}: News): Promise<void> {
  if (justStarted) {
    const followed = await followedRecommendation(user, ctx.game.id)
    await plainNotice(
      user,
      'start',
      together(
        followed ? followedNotice(user, ctx.game.id) : undefined,
        startNotice(user, ctx, firsts, route?.collectibles),
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
        focusNotice(user, ctx, unlocked),
        route?.text,
        route?.collectibles,
      ),
      ctx.game.id,
    )
  else if (route)
    await plainNotice(user, 'route', together(route.text, route.collectibles), ctx.game.id)
}

async function nexoNews({
  user,
  ctx,
  latest,
  justStarted,
  unlocked,
  firsts,
  route,
}: News): Promise<void> {
  if (justStarted) {
    console.log(`${user.psn_online_id}: new game ${latest.name}`)
    const followed = await followedRecommendation(user, ctx.game.id)
    await notify(
      user,
      await proactiveTip(
        user,
        ctx,
        route?.text,
        followed ?? undefined,
        route?.collectibles,
        firsts,
      ),
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

// What a sweep's news is, as its notice's kind; nothing when there is nothing to tell.
function newsKind({ justStarted, unlocked, route }: News): TipKind | undefined {
  if (justStarted) return 'start'
  if (unlocked.length) return 'unlock'
  return route ? 'route' : undefined
}

async function tellNews(source: News): Promise<void> {
  const kind = newsKind(source)
  if (!kind) return
  const { user, ctx } = source
  // The same news prepared again (the next sweep after a failed one) gets the same key: the game,
  // its trophy list and how many trophies it had earned.
  const earned = ctx.trophies.filter((t) => t.earned).length
  const notice = {
    kind,
    key: `${kind}:${ctx.game.id}:${ctx.title.npCommunicationId ?? ''}:${earned}`,
  }
  await aroundNotice(user, ctx.game.id, notice, async () => {
    const view = await projectGame(
      { user, game: ctx.game.id, surface: 'notice', notice },
      { ctx, route: source.route },
    )
    const news = { ...source, ...view }
    if (!nexoNotices(news.user)) return plainNews(news)
    try {
      await nexoNews(news)
    } catch (e) {
      logFallback(news.user, e)
      await plainNews(news)
    }
  })
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

// When the current game was picked from presence, per player: the profile's titles played before
// then do not take it back (the player closed the new game, nothing else happened).
const pickedAt = new Map<string, number>()

// The game the player is in, from PSN presence, when the profile does not list it yet: PSN lists a
// game only once the console syncs its trophies, often with the first one. A game the profile
// lists goes the usual way. With the player offline, a game picked earlier stays until the profile
// shows something played after it.
async function playingUnlisted(
  user: User,
  titles: TitleProgress[],
  playing: string | null,
): Promise<GameContext | undefined> {
  const current = getCurrent(user)
  const listedAfter = (picked: number) =>
    titles.some((t) => new Date(t.lastUpdated).getTime() > picked)
  if (!playing) {
    const picked = pickedAt.get(user.id)
    return current?.unlisted && picked && !listedAfter(picked) ? current : undefined
  }
  if (titles.some((t) => comparable(t.name) === comparable(playing))) return undefined
  const game = await gameByName(playing)
  if (!game) return undefined
  if (current?.unlisted && current.game.id === game.id) return current
  // A game the profile already lists under another name goes the usual way.
  if (titles.some((t) => game.np_communication_ids?.includes(t.npCommunicationId))) return undefined
  const ctx = await setCurrentFromPresence(user, game)
  if (ctx) pickedAt.set(user.id, Date.now())
  return ctx ?? undefined
}

// Whether the start notice for this game already went out: one picked from presence gets it
// before PSN lists the game, so its first listing is not a start again.
async function announced(user: User, ctx: GameContext): Promise<boolean> {
  return (await lastTip(user.id, 'start'))?.game === ctx.game.id
}

// A game picked from presence: its start notice once, then the session notice. Nothing is stored
// for it: the profile's title, when PSN lists it, is the one that counts.
async function checkUnlisted(
  user: User,
  ctx: GameContext,
  before: GameContext | undefined,
  titles: TitleProgress[],
  playing: string | null,
): Promise<void> {
  for (const t of titles) await upsertTitle(user.id, t)
  const justStarted = !(await announced(user, ctx))
  if (justStarted) {
    console.log(`${user.psn_online_id}: playing ${ctx.game.name}, not listed yet`)
    const route = routeFor(user, ctx, [], true)
    await tellNews({ user, ctx, latest: ctx.title, justStarted, unlocked: [], firsts: [], route })
  }
  // Playing another game brings the chat to it too.
  if (before && before.game.id !== ctx.game.id) dropChat(user.id)
  await sessionStart(user, ctx, justStarted, playing)
}

// What this check found on the title against its stored snapshot: a start, or trophies to tell.
async function whatIsNew(
  user: User,
  ctx: GameContext,
  latest: TitleProgress,
  prev: Awaited<ReturnType<typeof getTitle>>,
) {
  const knownIds = new Set<number>(prev?.earned_ids ?? [])
  // A game picked from presence already had its start notice: its first listing brings trophies.
  const told = !prev && (await announced(user, ctx))
  // A first sync of an account must not greet every old game as new.
  const firstSync = !prev && latest.earned > 0 && latest.progress >= 10
  const justStarted = !firstSync && !told && !prev?.last_tip_at && latest.progress < 10
  // The ids seen are trusted when there are some, or when the stored title had none earned: the
  // first trophy of a game is news too. A title stored with trophies but no ids was never watched
  // (another game was in front then), and announcing its old trophies would be wrong.
  const watched = knownIds.size > 0 || prev?.earned === 0 || told
  const unlocked = watched ? ctx.trophies.filter((t) => t.earned && !knownIds.has(t.id)) : []
  // The start notice celebrates them: no trophy goes unannounced because it came with the game.
  const firsts = justStarted ? ctx.trophies.filter((t) => t.earned && !knownIds.has(t.id)) : []
  return { told, justStarted, unlocked, firsts }
}

// Compares the user's PSN title list against the stored snapshot. A title we
// have never tipped that is still early triggers the intro; newly earned trophies
// on the current title trigger a reaction.
async function check(user: User): Promise<void> {
  // The demo player has no PSN profile to watch.
  if (isDemo(user)) return
  const titles = await recentTitles(user.psn_account_id, 5)
  if (titles.length === 0) return
  const playing = await nowPlaying(user.psn_account_id)
  const before = getCurrent(user)
  const unlisted = await playingUnlisted(user, titles, playing)
  if (unlisted) return checkUnlisted(user, unlisted, before, titles, playing)
  pickedAt.delete(user.id)

  const latest = titles[0]
  const current = getCurrent(user)
  const switched = current?.title.npCommunicationId !== latest.npCommunicationId
  const prev = await getTitle(user.id, latest.npCommunicationId)
  const ctx =
    switched || titleChanged(prev, latest) || listStale(current, latest) || !current
      ? await setCurrent(user, latest)
      : // A failed read keeps the counters as they were; the next check tries again.
        await refreshCounters(user, current).catch(() => current)
  // Playing another game brings the chat to it too; one picked from presence already did.
  if (switched && current && current.game.id !== ctx.game.id) dropChat(user.id)

  for (const t of titles) await upsertTitle(user.id, t)

  const earnedIds = ctx.trophies.filter((t) => t.earned).map((t) => t.id)
  const { told, justStarted, unlocked, firsts } = await whatIsNew(user, ctx, latest, prev)

  const route = routeFor(
    user,
    ctx,
    unlocked.map((t) => t.name),
    justStarted,
  )
  await tellNews({ user, ctx, latest, justStarted, unlocked, firsts, route })
  if (told) await markTipSent(user.id, latest.npCommunicationId)
  await saveEarnedIds(user.id, latest.npCommunicationId, earnedIds)
  await sessionStart(user, ctx, justStarted, playing)
}

// One session-start notice every few hours at most.
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
// `playing`: the presence this check already read.
async function sessionStart(
  user: User,
  ctx: GameContext,
  noticed: boolean,
  playing: string | null,
): Promise<void> {
  if (!playing || recentNotice(user)) return
  // Checks queued behind each other (sign-up and the first home load) carry the user as it was
  // read before the first one ran: the stored stamp is the one that counts.
  if (recentNotice((await getUser(user.id)) ?? user)) return
  // The start notice of a new game already went out in this sweep: it counts as this one.
  if (!noticed) {
    // A game picked from presence is the one being played, whatever the catalog calls it.
    const same = !!ctx.unlisted || comparable(playing) === comparable(ctx.title.name)
    if (same) await gameSession(user, ctx, playing)
    else await plainNotice(user, 'session', sessionNotice(user, playing))
  }
  await updateUser(user.id, { session_notice_at: new Date() })
}

// The session notice for the game in context, one per window of SESSION_NOTICE_HOURS.
async function gameSession(user: User, ctx: GameContext, playing: string): Promise<void> {
  const window = Math.floor(Date.now() / (SESSION_NOTICE_HOURS * 3_600_000))
  const notice = { kind: 'session', key: `session:${ctx.game.id}:${window}` }
  await aroundNotice(user, ctx.game.id, notice, async () => {
    const view = await projectGame(
      { user, game: ctx.game.id, surface: 'notice', notice },
      { ctx, route: undefined },
    )
    const again = await nothingNew(user, ctx)
    await plainNotice(user, 'session', sessionNotice(user, playing, view.ctx, again), ctx.game.id)
  })
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
// A check this recent is fresh enough for a reply; an older one runs again first.
const FRESH_CHECK_MS = 10 * 60_000
// How long a reply waits for that check before going with the trophies already loaded.
const CHECK_WAIT_MS = 2_000

// Trophies loaded can be a sweep old, and Nexo or an agent would suggest one earned minutes ago:
// a check older than FRESH_CHECK_MS runs first, waited for up to `wait`. Past that, the answer goes
// with what is loaded and the check finishes on its own. With nothing loaded (after a restart) the
// check is waited for in full, since there is no game to answer about without it.
async function freshen(user: User, loaded: GameContext | undefined, wait: number): Promise<void> {
  if (loaded && Date.now() - (checkedAt.get(user.id) ?? 0) < FRESH_CHECK_MS) return
  const check = checkUser(user).catch((e) =>
    console.error('check before answer failed:', e.message),
  )
  if (!loaded) await check
  else await Promise.race([check, new Promise((done) => setTimeout(done, wait))])
}

// The chat's game for a message, with its trophies fresh.
export async function chatOrCheck(
  user: User,
  wait = CHECK_WAIT_MS,
): Promise<GameContext | undefined> {
  if (isDemo(user)) return getChat(user)
  await freshen(user, getChat(user), wait)
  return getChat(user)
}

// The game being played, with its trophies fresh: what an agent reads through MCP.
export async function currentOrCheck(
  user: User,
  wait = CHECK_WAIT_MS,
): Promise<GameContext | undefined> {
  if (isDemo(user)) return getCurrent(user) ?? (await demoContext(user))
  await freshen(user, getCurrent(user), wait)
  return getCurrent(user)
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
    Promise.all([pruneExpired(), pruneOauth(), expirePlans()]).catch((e) =>
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
