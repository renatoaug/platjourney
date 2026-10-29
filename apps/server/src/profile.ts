import { isDemo, storedSummary } from './demo.ts'
import { hours, playtimes } from './playtime.ts'
import { type ProfileSummary, profileSummary, type TitleProgress, titleTrophies } from './psn.ts'
import { type Game, gamesForTitles, getGame } from './repository/game.ts'
import { listPlatinums, savePlatinum } from './repository/platinum.ts'
import type { User } from './repository/user.ts'
import { tints } from './tint.ts'

export interface PlatinumEntry {
  game: Game
  platform: string
  earnedAt: string
  rarity: number
  trophyName: string
  hours: number | null
}

export interface ProfilePage {
  summary: ProfileSummary
  platinums: PlatinumEntry[]
  pendingPlatinums: number
  byYear: { year: number; count: number }[]
  byPlatform: { platform: string; count: number }[]
  rarest: PlatinumEntry | null
  fastestStreak: { from: string; to: string; count: number } | null
  totalHours: number
  mostPlayed: { game: Game; hours: number }[]
}

// The platinum's own unlock date and rarity live on the trophy, not on the title
// summary: one PSN call per platinumed game, stored forever since it never
// changes. A new account can have hundreds, so they are fetched in the
// background, a few at a time, and the page shows what is ready.
const backfilling = new Set<string>()
// Collectors can have thousands of platinums; the service account is not going
// to make thousands of calls for one page. The most recent ones are fetched.
const MAX_PLATINUM_DATES = 500
async function backfill(user: User, missing: TitleProgress[]): Promise<void> {
  const games = await gamesForTitles(missing)
  const queue = [...missing]
  const worker = async () => {
    for (let title = queue.shift(); title; title = queue.shift()) {
      try {
        const trophies = await titleTrophies(title, user.psn_account_id)
        const plat = trophies.find((t) => t.type === 'platinum' && t.earned)
        if (!plat?.earnedAt) continue
        await savePlatinum(user.id, {
          game: (games.get(title.npCommunicationId) as Game).id,
          np_communication_id: title.npCommunicationId,
          trophy_name: plat.name,
          earned_at: plat.earnedAt,
          rarity_rate: plat.earnedRate,
        })
      } catch (e) {
        console.error(`platinum lookup failed for ${title.name}:`, (e as Error).message)
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
}

async function platinumList(
  library: TitleProgress[],
  user: User,
): Promise<{ list: PlatinumEntry[]; pending: number }> {
  const cached = new Set((await listPlatinums(user.id)).map((r) => r.np_communication_id))
  const missing = library
    .filter((t) => t.earnedByType.platinum === 1)
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
    .slice(0, MAX_PLATINUM_DATES)
    .filter((t) => !cached.has(t.npCommunicationId))
  // The demo player's platinums are all stored; there is no PSN account to ask.
  if (missing.length && !isDemo(user) && !backfilling.has(user.id)) {
    backfilling.add(user.id)
    backfill(user, missing)
      .catch((e) => console.error('platinum backfill failed:', (e as Error).message))
      .finally(() => backfilling.delete(user.id))
  }
  const played = await playtimes(user)
  const platformOf = new Map(library.map((t) => [t.npCommunicationId, t.platform]))
  const rows = await listPlatinums(user.id)
  const tinted = await tints(rows.map((r) => r.game))
  const list = rows.map((r) => ({
    game: tinted.has(r.game.id) ? { ...r.game, tint: tinted.get(r.game.id) } : r.game,
    platform: platformOf.get(r.np_communication_id) ?? '',
    earnedAt: r.earned_at,
    rarity: r.rarity_rate,
    trophyName: r.trophy_name,
    hours: hours(played.get(r.game.id)),
  }))
  return { list, pending: missing.length }
}

export async function profilePage(library: TitleProgress[], user: User): Promise<ProfilePage> {
  const [summary, { list: platinums, pending }] = await Promise.all([
    isDemo(user)
      ? storedSummary(user, library)
      : profileSummary(user.psn_account_id, user.psn_online_id),
    platinumList(library, user),
  ])
  const years = new Map<number, number>()
  const platforms = new Map<string, number>()
  for (const p of platinums) {
    const y = new Date(p.earnedAt).getFullYear()
    years.set(y, (years.get(y) ?? 0) + 1)
    platforms.set(p.platform, (platforms.get(p.platform) ?? 0) + 1)
  }
  const played = await playtimes(user)
  const mostPlayed = []
  for (const p of [...played.values()].sort((a, b) => b.seconds - a.seconds).slice(0, 5)) {
    const game = await getGame(p.game)
    if (game) mostPlayed.push({ game, hours: hours(p) as number })
  }
  const rarest = platinums.reduce<PlatinumEntry | null>(
    (best, p) => (best === null || p.rarity < best.rarity ? p : best),
    null,
  )
  return {
    summary,
    platinums,
    // Platinums whose date is still being fetched from PSN.
    pendingPlatinums: pending,
    byYear: [...years].map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year),
    byPlatform: [...platforms]
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count),
    rarest,
    fastestStreak: bestMonth(platinums),
    totalHours: Math.round([...played.values()].reduce((sum, p) => sum + p.seconds, 0) / 3600),
    mostPlayed,
  }
}

// The 30-day window with the most platinums.
function bestMonth(platinums: PlatinumEntry[]): ProfilePage['fastestStreak'] {
  const dates = platinums.map((p) => p.earnedAt).sort()
  let best: ProfilePage['fastestStreak'] = null
  for (let i = 0; i < dates.length; i++) {
    const end = new Date(dates[i]).getTime() + 30 * 86_400_000
    let j = i
    while (j + 1 < dates.length && new Date(dates[j + 1]).getTime() <= end) j++
    const count = j - i + 1
    if (count >= 2 && (!best || count > best.count)) best = { from: dates[i], to: dates[j], count }
  }
  return best
}
