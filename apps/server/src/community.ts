/**
 * The community: a feed, rankings and the games players are on, all read from what PSN already
 * gave us (unlock times, platinums, every trophy's rarity) for the players who show up in it.
 * Nothing here is written by players except follows, reactions and the medals the server awards.
 */

import type { TrophyStatus } from './psn.ts'
import {
  awardMedal,
  firstUnlocks,
  type GameOn,
  gamesOn,
  goalTargets,
  type InterestCount,
  type MedalKind,
  type Member,
  medalsOf,
  members,
  mostWanted,
  platinumsSince,
  raritiesOn,
  saveRarities,
  unlocksSince,
} from './repository/community.ts'

const DAY = 86_400_000
/** A trophy fewer players than this share (in %) counts as rare. */
const RARE = 5
const FEED_DAYS = 30

interface FeedGame {
  np: string
  name: string
  iconUrl: string | null
  id: string | null
  /** The catalog's box art and wide art, when the catalog knows the game. */
  coverUrl: string | null
  artUrl: string | null
}

const feedGame = (np: string, g: GameOn): FeedGame => ({
  np,
  name: g.name,
  iconUrl: g.iconUrl,
  id: g.game,
  coverUrl: g.coverUrl,
  artUrl: g.artUrl,
})

type FeedEvent = {
  key: string
  user: string
  at: string
  game: FeedGame | null
} & (
  | { kind: 'platinum'; rate: number }
  | { kind: 'rare'; trophy: string; trophyEn: string; type: string; rate: number }
  | { kind: 'start' }
  | { kind: 'medal'; medal: MedalKind }
)

// Rarities are kept at most once every six hours per list: they move slowly.
const rarityAt = new Map<string, number>()

/** Keeps the share of players of every trophy on a list a player who owns the game opened. */
export function keepRarities(np: string, trophies: TrophyStatus[]): void {
  // A catalog list (nobody's) has no rates: only a player's list says how rare a trophy is.
  if (!trophies.some((t) => t.rarityTier !== undefined)) return
  const last = rarityAt.get(np) ?? 0
  if (Date.now() - last < 6 * 3600_000) return
  if (rarityAt.size > 20_000) rarityAt.clear()
  rarityAt.set(np, Date.now())
  saveRarities(
    np,
    trophies.map((t) => ({
      trophyId: t.id,
      type: t.type,
      name: t.name,
      nameEn: t.nameEn,
      rate: t.earnedRate,
    })),
  ).catch((e) => {
    rarityAt.delete(np)
    console.error('rarities not kept:', (e as Error).message)
  })
}

/** The local day of a moment, as "YYYY-MM-DD" in Brasília time, where most players are. */
const dayOf = (iso: string) =>
  new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10)

/** The medals a player's history earns, with when each was earned. */
export function medalsEarned(
  unlocks: { np: string; trophyId: number; at: string }[],
  rarities: Map<string, { rate: number; type: string }>,
  platinums: { np: string; at: string }[],
  firsts: Map<string, string>,
  target: number | null,
  year: number,
): { kind: MedalKind; at: string }[] {
  const out: { kind: MedalKind; at: string }[] = []
  const sorted = [...unlocks].sort((a, b) => a.at.localeCompare(b.at))

  // Five trophies fewer than RARE% of players have.
  const rare = sorted.filter((u) => {
    const r = rarities.get(`${u.np}|${u.trophyId}`)
    return r && r.type !== 'platinum' && r.rate > 0 && r.rate < RARE
  })
  if (rare.length >= 5) out.push({ kind: 'rare_hunter', at: rare[4].at })

  // A platinum within seven days of the game's first trophy.
  const quick = platinums
    .filter((p) => {
      const first = firsts.get(p.np)
      return first && new Date(p.at).getTime() - new Date(first).getTime() <= 7 * DAY
    })
    .sort((a, b) => a.at.localeCompare(b.at))
  if (quick.length) out.push({ kind: 'quick_platinum', at: quick[0].at })

  // Trophies on seven days in a row.
  const days = [...new Set(sorted.map((u) => dayOf(u.at)))].sort()
  let run = 1
  for (let i = 1; i < days.length; i++) {
    const gap = (Date.parse(days[i]) - Date.parse(days[i - 1])) / DAY
    run = gap === 1 ? run + 1 : 1
    if (run === 7) {
      const last = sorted.find((u) => dayOf(u.at) === days[i])
      if (last) out.push({ kind: 'no_day_off', at: last.at })
      break
    }
  }

  // The year's platinum goal reached.
  if (target && target > 0) {
    const ofYear = platinums
      .filter((p) => new Date(p.at).getFullYear() === year)
      .sort((a, b) => a.at.localeCompare(b.at))
    if (ofYear.length >= target) out.push({ kind: 'year_goal', at: ofYear[target - 1].at })
  }
  return out
}

/** Works out every member's medals from their last year and writes the new ones. */
async function refreshMedals(people: Member[]): Promise<void> {
  const users = people.map((m) => m.id)
  const since = new Date(Date.now() - 365 * DAY)
  const [unlocks, plats, targets] = await Promise.all([
    unlocksSince(users, since),
    platinumsSince(users, new Date(`${new Date().getFullYear() - 1}-01-01`)),
    goalTargets(users),
  ])
  const nps = [...new Set([...unlocks.map((u) => u.np), ...plats.map((p) => p.np)])]
  const [rarities, firsts] = await Promise.all([raritiesOn(nps), firstUnlocks(users, nps)])
  const year = new Date().getFullYear()
  for (const user of users) {
    const firstOf = new Map<string, string>()
    for (const [k, v] of firsts)
      if (k.startsWith(`${user}|`)) firstOf.set(k.slice(user.length + 1), v)
    const earned = medalsEarned(
      unlocks.filter((u) => u.user === user),
      rarities,
      plats.filter((p) => p.user === user),
      firstOf,
      targets.get(user)?.[String(year)] ?? null,
      year,
    )
    for (const m of earned) await awardMedal(user, m.kind, m.at)
  }
}

let medalsAt = 0

export interface Community {
  members: Member[]
  feed: FeedEvent[]
}

let cached: { at: number; data: Community } | undefined
let building: Promise<Community> | undefined
// Bumped when the community is forgotten: a build started before that is not kept.
let generation = 0
const TTL = 3 * 60_000

/** The last 30 days of the community, newest first; kept for a few minutes. Building it reads a
 * month of everyone's trophies and takes seconds: once there is one, a stale copy is answered at
 * once while a fresh one is built behind it, and only the very first visit waits. */
export async function community(): Promise<Community> {
  if (cached && Date.now() - cached.at < TTL) return cached.data
  building ??= buildCommunity().finally(() => {
    building = undefined
  })
  if (!cached) return building
  building.catch((e) => console.error('community:', (e as Error).message))
  return cached.data
}

async function buildCommunity(): Promise<Community> {
  const started = generation
  const people = await members()
  // Medals look back a whole year: worked out behind the feed, never in front of it. The feed
  // shows them on its next build.
  if (Date.now() - medalsAt > 60 * 60_000) {
    medalsAt = Date.now()
    refreshMedals(people)
      .then(() => {
        if (cached) cached.at = 0
      })
      .catch((e) => console.error('medals:', (e as Error).message))
  }
  const users = people.map((m) => m.id)
  const since = new Date(Date.now() - FEED_DAYS * DAY)
  const [plats, unlocks, medals] = await Promise.all([
    platinumsSince(users, since),
    unlocksSince(users, since),
    medalsOf(users),
  ])
  const nps = [...new Set([...plats.map((p) => p.np), ...unlocks.map((u) => u.np)])]
  const [rarities, firsts, games] = await Promise.all([
    raritiesOn(nps),
    firstUnlocks(users, nps),
    gamesOn(nps),
  ])
  const gameOf = (np: string): FeedGame | null => {
    const g = games.get(np)
    return g ? feedGame(np, g) : null
  }
  const feed: FeedEvent[] = []
  for (const p of plats)
    feed.push({
      key: `plat:${p.user}:${p.np}`,
      kind: 'platinum',
      user: p.user,
      at: p.at,
      game: gameOf(p.np),
      rate: p.rate,
    })
  for (const u of unlocks) {
    const r = rarities.get(`${u.np}|${u.trophyId}`)
    if (!r || r.type === 'platinum' || !(r.rate > 0 && r.rate < RARE)) continue
    feed.push({
      key: `rare:${u.user}:${u.np}:${u.trophyId}`,
      kind: 'rare',
      user: u.user,
      at: u.at,
      game: gameOf(u.np),
      trophy: r.name,
      trophyEn: r.nameEn,
      type: r.type,
      rate: r.rate,
    })
  }
  for (const [k, first] of firsts) {
    if (new Date(first) <= since) continue
    const [user, np] = k.split('|')
    feed.push({ key: `start:${user}:${np}`, kind: 'start', user, at: first, game: gameOf(np) })
  }
  for (const m of medals) {
    if (new Date(m.at) <= since) continue
    feed.push({
      key: `medal:${m.user}:${m.kind}`,
      kind: 'medal',
      user: m.user,
      at: m.at,
      game: null,
      medal: m.kind,
    })
  }
  feed.sort((a, b) => b.at.localeCompare(a.at))
  const data = { members: people, feed }
  if (started === generation) cached = { at: Date.now(), data }
  return data
}

/** Forgets the kept community, as when a player leaves it: nobody sees them again, not even for
 * the moment a stale copy would last. */
export const forgetCommunity = () => {
  generation++
  cached = undefined
  rankingsCache.clear()
}

/** Builds the community and the month's and year's boards before anyone asks, so the first visit
 * after a start does not wait. */
export function warmCommunity(now = new Date()): void {
  const warm = (p: Promise<unknown>) =>
    p.catch((e) => console.error('community warm-up:', (e as Error).message))
  warm(community())
  warm(rankings(new Date(now.getFullYear(), now.getMonth(), 1)))
  warm(rankings(new Date(now.getFullYear(), 0, 1)))
}

export interface RankRow {
  user: string
  value: number
  game?: FeedGame | null
}

/** Who platinumed most, earned the most rare trophies and platinumed fastest since a date. */
type Rankings = { platinums: RankRow[]; rare: RankRow[]; fastest: RankRow[] }

// Each period's boards, kept like the feed: a stale copy answers while a fresh one is built.
const rankingsCache = new Map<string, { at: number; data: Rankings }>()
const rankingsBuilding = new Map<string, Promise<Rankings>>()

/** The boards since a date (the month's or the year's start), kept for a few minutes. */
export async function rankings(since: Date): Promise<Rankings> {
  const key = since.toISOString()
  const kept = rankingsCache.get(key)
  if (kept && Date.now() - kept.at < TTL) return kept.data
  let run = rankingsBuilding.get(key)
  if (!run) {
    run = buildRankings(since)
      .then((data) => {
        rankingsCache.set(key, { at: Date.now(), data })
        return data
      })
      .finally(() => rankingsBuilding.delete(key))
    rankingsBuilding.set(key, run)
  }
  if (!kept) return run
  run.catch((e) => console.error('rankings:', (e as Error).message))
  return kept.data
}

async function buildRankings(since: Date): Promise<Rankings> {
  // Only players who show up: rankings are what everyone sees.
  const people = (await members()).filter((m) => m.visible)
  const users = people.map((m) => m.id)
  const [plats, unlocks] = await Promise.all([
    platinumsSince(users, since),
    unlocksSince(users, since),
  ])
  const nps = [...new Set([...plats.map((p) => p.np), ...unlocks.map((u) => u.np)])]
  const [rarities, firsts, games] = await Promise.all([
    raritiesOn(nps),
    firstUnlocks(users, [...new Set(plats.map((p) => p.np))]),
    gamesOn(nps),
  ])
  const count = (rows: { user: string }[]) => {
    const by = new Map<string, number>()
    for (const r of rows) by.set(r.user, (by.get(r.user) ?? 0) + 1)
    return [...by].map(([user, value]) => ({ user, value })).sort((a, b) => b.value - a.value)
  }
  const rare = unlocks.filter((u) => {
    const r = rarities.get(`${u.np}|${u.trophyId}`)
    return r && r.type !== 'platinum' && r.rate > 0 && r.rate < RARE
  })
  // Fastest: days from the game's first trophy to its platinum, each player's best.
  const best = new Map<string, RankRow>()
  for (const p of plats) {
    const first = firsts.get(`${p.user}|${p.np}`)
    if (!first) continue
    const days = Math.max(0, (new Date(p.at).getTime() - new Date(first).getTime()) / DAY)
    const value = Math.round(days * 10) / 10
    const now = best.get(p.user)
    if (!now || value < now.value) {
      const g = games.get(p.np)
      best.set(p.user, {
        user: p.user,
        value,
        game: g ? feedGame(p.np, g) : null,
      })
    }
  }
  // Whole lists: the route keeps the top and finds the reader's own place in them.
  return {
    platinums: count(plats),
    rare: count(rare),
    fastest: [...best.values()].sort((a, b) => a.value - b.value),
  }
}

export interface GameCount {
  game: FeedGame
  players: number
}

/** What the community is on: games with trophies this week, platinums this month, interests. */
export async function communityGames(): Promise<{
  playing: GameCount[]
  platinumed: GameCount[]
  wanted: InterestCount[]
}> {
  const people = (await members()).filter((m) => m.visible)
  const users = people.map((m) => m.id)
  const now = Date.now()
  const month = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const [week, plats, wanted] = await Promise.all([
    unlocksSince(users, new Date(now - 7 * DAY)),
    platinumsSince(users, month),
    mostWanted(users, new Date().getFullYear()),
  ])
  const nps = [...new Set([...week.map((u) => u.np), ...plats.map((p) => p.np)])]
  const games = await gamesOn(nps)
  const tally = (rows: { user: string; np: string }[]) => {
    const by = new Map<string, Set<string>>()
    for (const r of rows) by.set(r.np, (by.get(r.np) ?? new Set()).add(r.user))
    return [...by]
      .flatMap(([np, who]) => {
        const g = games.get(np)
        return g ? [{ game: feedGame(np, g), players: who.size }] : []
      })
      .sort((a, b) => b.players - a.players || a.game.name.localeCompare(b.game.name))
      .slice(0, 10)
  }
  return { playing: tally(week), platinumed: tally(plats), wanted: wanted.slice(0, 10) }
}
