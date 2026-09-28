// The demo: a fixed, fictional player that anyone can open without a PSN account. Its data comes
// from the demo seed (db/demo-seed.json) and stays as it was loaded: nothing it shows calls PSN or
// the AI service, and every write is refused, since everyone who opens the demo shares it.
import { one, plain } from './db.ts'
import {
  type ProfileSummary,
  type TitleGroups,
  type TitleProgress,
  type TrophyStatus,
  titleTrophies,
} from './psn.ts'
import { getTitle, type TitleRow, titlesOfAccount } from './repository/title.ts'
import type { User } from './repository/user.ts'

// Not a PSN account id (those are numbers): the demo player's library is read from the database.
export const DEMO_ACCOUNT_ID = 'demo'

export class DemoReadOnly extends Error {
  constructor() {
    super('the demo is read-only')
  }
}

export const isDemo = (user?: Pick<User, 'demo'> | null): boolean => user?.demo === true
export const isDemoAccount = (accountId: string): boolean => accountId === DEMO_ACCOUNT_ID

export async function demoUser(): Promise<User | undefined> {
  return plain(await one<User>('SELECT * FROM user WHERE demo = true LIMIT 1'))
}

// Platinums add up across a library, so the platinum count here is any number.
type Counts = { bronze: number; silver: number; gold: number; platinum: number }
type PsnCounts = TitleProgress['earnedByType']
const zero = (): Counts => ({ bronze: 0, silver: 0, gold: 0, platinum: 0 })
const add = (a: Counts, b?: Counts | null): Counts =>
  b
    ? {
        bronze: a.bronze + b.bronze,
        silver: a.silver + b.silver,
        gold: a.gold + b.gold,
        platinum: a.platinum + b.platinum,
      }
    : a

const byType = (groups: TitleGroups, side: 'earnedByType' | 'definedByType'): PsnCounts =>
  add(add(zero(), groups.base[side]), groups.dlc?.[side]) as PsnCounts

// Counted from the stored trophy list when the title has no base/DLC split.
function fromList(trophies: TrophyStatus[], earnedOnly: boolean): Counts {
  const counts = zero()
  for (const t of trophies)
    if ((!earnedOnly || t.earned) && t.type in counts) counts[t.type as keyof Counts]++
  return counts
}

// A stored title as PSN would describe it.
export function storedProgress(row: TitleRow): TitleProgress {
  const list = row.trophies ?? []
  return {
    npCommunicationId: row.np_communication_id,
    name: row.name,
    platform: row.platform,
    iconUrl: row.icon_url,
    progress: row.progress,
    earned: row.earned,
    total: row.total,
    earnedByType: row.groups
      ? byType(row.groups, 'earnedByType')
      : (fromList(list, true) as PsnCounts),
    definedByType: row.groups
      ? byType(row.groups, 'definedByType')
      : (fromList(list, false) as PsnCounts),
    lastUpdated: new Date(row.last_updated_at).toISOString(),
  }
}

// The demo player's library, most recently played first.
export async function storedTitles(accountId: string): Promise<TitleProgress[]> {
  return (await titlesOfAccount(accountId)).map(storedProgress)
}

// A title's trophy list: from PSN for a real player, as stored for the demo one.
export async function trophiesFor(title: TitleProgress, user: User): Promise<TrophyStatus[]> {
  if (!isDemo(user)) return titleTrophies(title, user.psn_account_id)
  return (await getTitle(user.id, title.npCommunicationId))?.trophies ?? []
}

// PSN's trophy points and level steps: the level is worked out from what the library holds.
const POINTS: Counts = { bronze: 15, silver: 30, gold: 90, platinum: 300 }
const STEPS = [
  [99, 60],
  [199, 90],
  [299, 450],
  [399, 900],
  [499, 1350],
  [599, 1800],
  [699, 2250],
  [799, 2700],
  [899, 3150],
  [999, 3600],
] as const

export function trophyLevel(earned: Counts): { level: number; progress: number } {
  let points =
    earned.bronze * POINTS.bronze +
    earned.silver * POINTS.silver +
    earned.gold * POINTS.gold +
    earned.platinum * POINTS.platinum
  let level = 1
  for (const [last, cost] of STEPS) {
    while (level <= last && points >= cost) {
      points -= cost
      level++
    }
    if (level <= last) return { level, progress: Math.floor((points / cost) * 100) }
  }
  return { level: 999, progress: 100 }
}

// The profile header without PSN: the counts are the library's.
export function storedSummary(user: User, titles: TitleProgress[]): ProfileSummary {
  const earned = titles.reduce((sum, t) => add(sum, t.earnedByType), zero())
  const { level, progress } = trophyLevel(earned)
  return {
    onlineId: user.psn_online_id,
    avatarUrl: user.avatar_url ?? undefined,
    level,
    levelProgress: progress,
    earned: earned as PsnCounts,
  }
}
