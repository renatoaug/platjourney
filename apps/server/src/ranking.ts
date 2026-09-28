import { isDemo } from './demo.ts'
import { type TitleGroups, type TitleProgress, titleGroups } from './psn.ts'
import { type Game, gameForTitle } from './repository/game.ts'
import { getTitle, saveGroups, sharedGroups, upsertTitle } from './repository/title.ts'
import type { User } from './repository/user.ts'

export interface RankedTitle {
  game: Game
  title: TitleProgress
  groups: TitleGroups | null
  remaining: number
  effort: number
  // Progress of the base game alone (what the platinum needs); PSN's own
  // progress mixes DLC in.
  baseProgress: number
}

const missing = (
  defined: TitleProgress['definedByType'],
  earned: TitleProgress['earnedByType'],
) => {
  const miss = (k: 'bronze' | 'silver' | 'gold') => defined[k] - earned[k]
  return {
    remaining: miss('bronze') + miss('silver') + miss('gold'),
    effort: miss('bronze') + miss('silver') * 2 + miss('gold') * 4,
  }
}

// Cheapest platinums first. Effort is a weighted count of what is still missing.
// The first pass uses the profile summary (one PSN call for the whole library);
// the top entries are then refined with the base-game/DLC split, cached per title
// until its trophy list changes.
export async function rankNextPlatinum(
  titles: TitleProgress[],
  user: User,
  limit = 10,
  exclude: string[] = [],
): Promise<RankedTitle[]> {
  const skip = new Set(exclude)
  const rough = titles
    .filter(
      (t) => t.definedByType.platinum === 1 && t.earnedByType.platinum === 0 && t.progress > 0,
    )
    .filter((t) => !skip.has(t.npCommunicationId))
    .map((t) => ({
      title: t,
      groups: null as TitleGroups | null,
      baseProgress: t.progress,
      ...missing(t.definedByType, t.earnedByType),
    }))
    .sort((a, b) => a.effort - b.effort || b.title.progress - a.title.progress)
    .slice(0, limit * 2)

  const refined = await Promise.all(
    rough.map(async (r) => {
      const game = await gameForTitle(r.title)
      const groups = await loadGroups(r.title, user)
      if (!groups) return { ...r, game }
      const m = missing(groups.base.definedByType, groups.base.earnedByType)
      const baseProgress = Math.round((groups.base.earned / groups.base.total) * 100)
      return { ...r, game, groups, baseProgress, ...m }
    }),
  )
  return refined
    .sort((a, b) => a.effort - b.effort || b.baseProgress - a.baseProgress)
    .slice(0, limit)
}

// Base/DLC split for a title, cached on the user's title row until its trophies
// change. What each group defines is the same for everyone, so the earned side is
// the only part that needs a PSN call per user.
export async function loadGroups(title: TitleProgress, user: User): Promise<TitleGroups | null> {
  // The demo player's split is the stored one.
  if (isDemo(user)) return (await getTitle(user.id, title.npCommunicationId))?.groups ?? null
  const row =
    (await getTitle(user.id, title.npCommunicationId)) ?? (await upsertTitle(user.id, title))
  const fresh = new Date(row.last_updated_at).getTime() === new Date(title.lastUpdated).getTime()
  if (row.groups && fresh) return row.groups
  // Nothing earned yet: the definition from any other player's row is the whole answer.
  if (title.earned === 0) {
    const shared = await sharedGroups(title.npCommunicationId, title.total)
    if (shared) {
      const zero = { bronze: 0, silver: 0, gold: 0, platinum: 0 as const }
      const blank = (g: TitleGroups['base']) => ({
        ...g,
        earned: 0,
        remaining: g.definedByType.bronze + g.definedByType.silver + g.definedByType.gold,
        earnedByType: zero,
      })
      const groups = { ...shared, base: blank(shared.base), dlc: shared.dlc && blank(shared.dlc) }
      await saveGroups(user.id, title.npCommunicationId, groups)
      return groups
    }
  }
  try {
    const groups = await titleGroups(title, user.psn_account_id)
    if (!fresh) await upsertTitle(user.id, title)
    await saveGroups(user.id, title.npCommunicationId, groups)
    return groups
  } catch (e) {
    console.error(`groups failed for ${title.name}:`, (e as Error).message)
    return row.groups ?? null
  }
}
