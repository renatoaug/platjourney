/** What a platinum's share card shows: the game, the player, which platinum it was, how long it
 * took and the day-by-day climb from the first trophy to the platinum. The browser draws the card;
 * this only gathers the facts. */
import type { TitleProgress, TrophyStatus } from './psn.ts'
import type { Game } from './repository/game.ts'

export interface PlatinumCard {
  game: { id: string; name: string; artUrl: string | null; coverUrl: string | null }
  player: { onlineId: string; avatarUrl: string | null }
  platform: string
  earnedAt: string
  /** Which platinum of the player's this was, in the order they were earned (1 is the first). */
  number: number
  trophy: { name: string; detail: string }
  /** The day of the game's first trophy; null when PSN has no date for it. */
  firstAt: string | null
  hours: number | null
  trophies: { earned: number; total: number; gold: number; silver: number; bronze: number }
  /** Share of the players who have this platinum, in percent. */
  rarity: number
  /** Where the shared card's link opens: the player's public profile. */
  link: string
  /** Base-game trophies earned by the end of each day, from the first trophy's day to the
   * platinum's; at most JOURNEY_POINTS points, a long hunt sampled evenly. */
  journey: number[]
}

/** The player's public profile, where a shared card's link opens, marked as coming from a share. */
const profileLink = (base: string, onlineId: string) =>
  `${base}/profiles/${encodeURIComponent(onlineId)}?ref=share`

export const JOURNEY_POINTS = 40
const DAY = 86_400_000

const dayOf = (iso: string) => Math.floor(Date.parse(iso) / DAY)

/** The cumulative count per day between two days, both included, sampled down to `max` points. */
export function journeyOf(dates: string[], untilIso: string, max = JOURNEY_POINTS): number[] {
  const days = dates.map(dayOf).sort((a, b) => a - b)
  if (!days.length) return []
  const first = days[0] as number
  const last = Math.max(dayOf(untilIso), days[days.length - 1] as number)
  const span = last - first + 1
  const step = span > max ? (span - 1) / (max - 1) : 1
  const points = Math.min(span, max)
  const out: number[] = []
  for (let i = 0; i < points; i++) {
    const day = i === points - 1 ? last : first + Math.round(i * step)
    out.push(days.filter((d) => d <= day).length)
  }
  return out
}

/** The card for one platinum, from the player's platinums (any order), the game's title on PSN
 * and its trophy list. Null when the game is not among the player's platinums. */
export function platinumCard(args: {
  gameId: string
  platinums: { game: Game; earnedAt: string; rarity: number; hours: number | null }[]
  title: TitleProgress
  trophies: TrophyStatus[]
  player: { onlineId: string; avatarUrl: string | null }
  /** The app's address, the base of the card's link. */
  base: string
}): PlatinumCard | null {
  const ordered = [...args.platinums].sort((a, b) => a.earnedAt.localeCompare(b.earnedAt))
  const index = ordered.findIndex((p) => p.game.id === args.gameId)
  const entry = ordered[index]
  if (!entry) return null
  // The base game only: DLC trophies are not part of the platinum.
  const base = args.trophies.filter((t) => t.groupId === 'default')
  const earned = base.filter((t) => t.earned)
  const dates = earned.flatMap((t) => (t.earnedAt ? [t.earnedAt] : []))
  const platinum = base.find((t) => t.type === 'platinum')
  const count = (type: string) => earned.filter((t) => t.type === type).length
  return {
    game: {
      id: entry.game.id,
      name: entry.game.name,
      artUrl: entry.game.art_url ?? null,
      coverUrl: entry.game.cover_url ?? null,
    },
    player: args.player,
    link: profileLink(args.base, args.player.onlineId),
    platform: args.title.platform,
    earnedAt: entry.earnedAt,
    number: index + 1,
    trophy: { name: platinum?.name ?? '', detail: platinum?.detail ?? '' },
    firstAt: dates.length ? (dates.sort()[0] as string) : null,
    hours: entry.hours,
    trophies: {
      earned: earned.length,
      total: base.length,
      gold: count('gold'),
      silver: count('silver'),
      bronze: count('bronze'),
    },
    rarity: entry.rarity,
    journey: journeyOf(dates, entry.earnedAt),
  }
}

// Only the hosts the app's own art comes from, over https: the proxy is not an open relay.
const IMAGE_HOSTS = [/^images\.igdb\.com$/, /\.playstation\.(net|com)$/]

export const shareableImage = (raw: string | null): URL | null => {
  if (!raw) return null
  try {
    const url = new URL(raw.replace(/^http:/, 'https:'))
    return url.protocol === 'https:' && IMAGE_HOSTS.some((h) => h.test(url.hostname)) ? url : null
  } catch {
    return null
  }
}

export type Period = 'month' | 'year' | 'all'

export const isPeriod = (v: string | null): v is Period =>
  v === 'month' || v === 'year' || v === 'all'

export interface CollectionCard {
  player: { onlineId: string; avatarUrl: string | null }
  /** Where the shared card's link opens: the player's public profile. */
  link: string
  period: Period
  /** The month (1 to 12) and year the card covers; null on the whole collection. */
  month: number | null
  year: number | null
  /** How many platinums the period has; `platinums` lists at most MAX_COLLECTION of them. */
  total: number
  /** Every platinum the player has, whatever the period. */
  overall: number
  hours: number | null
  platinums: {
    game: { id: string; name: string; coverUrl: string | null }
    platform: string
    earnedAt: string
    rarity: number
  }[]
}

const MAX_COLLECTION = 120

/** The platinums of the month or year of `now` (UTC), or all of them, the latest first. */
export function collectionCard(args: {
  period: Period
  now: Date
  platinums: {
    game: Game
    platform: string
    earnedAt: string
    rarity: number
    hours: number | null
  }[]
  player: { onlineId: string; avatarUrl: string | null }
  /** The app's address, the base of the card's link. */
  base: string
}): CollectionCard {
  const year = args.now.getUTCFullYear()
  const month = args.now.getUTCMonth()
  const inPeriod = (iso: string) => {
    const d = new Date(iso)
    if (args.period === 'all') return true
    if (d.getUTCFullYear() !== year) return false
    return args.period === 'year' || d.getUTCMonth() === month
  }
  const chosen = args.platinums
    .filter((p) => inPeriod(p.earnedAt))
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
  const timed = chosen.filter((p) => p.hours != null)
  return {
    player: args.player,
    link: profileLink(args.base, args.player.onlineId),
    period: args.period,
    month: args.period === 'month' ? month + 1 : null,
    year: args.period === 'all' ? null : year,
    total: chosen.length,
    overall: args.platinums.length,
    hours: timed.length ? Math.round(timed.reduce((n, p) => n + (p.hours ?? 0), 0)) : null,
    platinums: chosen.slice(0, MAX_COLLECTION).map((p) => ({
      game: { id: p.game.id, name: p.game.name, coverUrl: p.game.cover_url ?? null },
      platform: p.platform,
      earnedAt: p.earnedAt,
      rarity: p.rarity,
    })),
  }
}
