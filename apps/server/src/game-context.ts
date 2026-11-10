import { config } from './config.ts'
import { tagged } from './costs.ts'
import { ensureDeepGuide } from './deepguide.ts'
import { isDemo, storedProgress, trophiesFor } from './demo.ts'
import { ensureGuide, type Guide } from './guide.ts'
import { library } from './library.ts'
import type { GameContext } from './nexo.ts'
import { withPlayerSteps } from './player-steps.ts'
import { hours, playtimes } from './playtime.ts'
import { catalogTrophies, type TitleProgress, titleCounters } from './psn.ts'
import { loadGroups } from './ranking.ts'
import { type Game, gameForTitle } from './repository/game.ts'
import { getGuide } from './repository/guide.ts'
import { requestGuide } from './repository/guide-request.ts'
import { titleOfGame } from './repository/title.ts'
import type { User } from './repository/user.ts'

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
export const dropChat = (id: string) => chatContexts.delete(id)

// With automatic research off, the stored guide is used as it is and a missing one is only listed.
async function guideFor(user: User, title: TitleProgress, ctxTrophies: GameContext['trophies']) {
  const game = await gameForTitle(title)
  const cached = await getGuide<Guide>(game.id)
  // The demo player reads the stored guide and never asks for one.
  if (isDemo(user)) return cached
  if (!config.automatic.research) {
    if (!cached) await requestGuide(game.id, user.id)
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
  const placed =
    (await withPlayerSteps(guide, trophies, title.npCommunicationId, game)) ?? undefined
  return { game, title, trophies, guide: placed, groups, hoursPlayed: hours(played.get(game.id)) }
}

// The game being played changes: the watcher's own switch.
export async function setCurrent(user: User, title: TitleProgress): Promise<GameContext> {
  const ctx = await loadContext(user, title)
  contexts.set(user.id, ctx)
  return ctx
}

// A counter (50 headshots) moves without a new trophy, and PSN's summary of the title stays the
// same, so the loaded list would keep the old count. The counters still open on the game being
// played are read again on each check; the rest of the context stays as it is.
export async function refreshCounters(user: User, ctx: GameContext): Promise<GameContext> {
  const open = (t: GameContext['trophies'][number]) => !!t.progressTarget && !t.earned
  if (isDemo(user) || ctx.unlisted || !ctx.trophies.some(open)) return ctx
  const counters = await titleCounters(ctx.title, user.psn_account_id)
  let changed = false
  const trophies = ctx.trophies.map((t) => {
    const now = open(t) ? counters.get(t.id) : undefined
    if (now?.progressValue === undefined || now.progressValue === t.progressValue) return t
    changed = true
    return { ...t, progressValue: now.progressValue, progressRate: now.progressRate }
  })
  // Another check may have loaded a new context meanwhile: that one is newer.
  if (!changed || contexts.get(user.id) !== ctx) return ctx
  const next = { ...ctx, trophies }
  contexts.set(user.id, next)
  return next
}

// The game PSN presence shows the player in before its trophy list reaches their profile (a new
// game, before its first trophy): the catalog's list with nothing earned, as the current game.
// The player has it, so it is owned. Null when the catalog has no list for it.
export async function setCurrentFromPresence(user: User, game: Game): Promise<GameContext | null> {
  const found = await catalogContext(user, game)
  if (!found) return null
  const ctx: GameContext = { ...found, owned: undefined, unlisted: true }
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
  const ctx = await catalogContext(user, game)
  if (ctx) chatContexts.set(user.id, ctx)
  return ctx
}

// A game's context for a player away from the chat (an answer Nexo owed them): their own title
// when they have one, else the catalog list with nothing earned. Neither the current nor the chat
// game changes.
export async function contextForGame(user: User, game: Game): Promise<GameContext | null> {
  const row = await titleOfGame(user.id, game.id)
  if (row) return loadContext(user, storedProgress(row))
  return catalogContext(user, game)
}

async function catalogContext(user: User, game: Game): Promise<GameContext | null> {
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
  if (!guide && !isDemo(user)) await requestGuide(game.id, user.id)
  const ctx: GameContext = {
    game,
    title,
    trophies: list.trophies,
    guide,
    groups: null,
    owned: false,
  }
  return ctx
}

// The demo player's current game is its stored title played last that has no platinum yet.
export async function demoContext(user: User): Promise<GameContext | undefined> {
  return tagged({ user: user.id, demo: true }, async () => {
    const titles = await library(user.psn_account_id)
    const latest = titles.find((t) => t.earnedByType.platinum === 0) ?? titles[0]
    return latest && setCurrent(user, latest)
  })
}
