/** Nexo picks the next platinum among the games the player saved in their interests: what each
 * guide says, where the player is in it, and the pace of their last platinums go to the service,
 * which answers with one game, why it fits now and what to do first. */
import { ai } from './ai.ts'
import { tagged } from './costs.ts'
import type { Locale } from './i18n.ts'
import { aroundModel } from './plugins.ts'
import type { TitleProgress } from './psn.ts'
import { loadGroups } from './ranking.ts'
import { gamesForTitles } from './repository/game.ts'
import { getGuide } from './repository/guide.ts'
import { listInterests, markNextPick } from './repository/interest.ts'
import type { User } from './repository/user.ts'

interface GuideFacts {
  difficulty?: number
  hours?: number
  playthroughs?: number
  hasMissables?: boolean
  hasOnline?: boolean
}

export interface NextPick {
  game: { id: string; name: string; cover_url?: string | null }
  why: string
  firstStep: string
}

// Enough of the last platinums to read a pace; more only makes the prompt longer.
const RECENT = 5
// A saved game with a trophy this recent is the one being played: the pick is what comes after it.
const PLAYING_DAYS = 7

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** The pick, or null when nothing is saved for the year. */
export async function nextPick(
  user: User,
  library: TitleProgress[],
  locale: Locale,
  year = new Date().getFullYear(),
): Promise<NextPick | null> {
  const interests = await listInterests(user.id, year)
  if (!interests.length) return null
  const games = await gamesForTitles(library, false)
  // Where the player is in each saved game they already own.
  const owned = new Map<string, TitleProgress>()
  for (const t of library) {
    const g = games.get(t.npCommunicationId)
    if (g) owned.set(g.id, t)
  }
  const withDlc = user.include_dlc_progress === true
  /** Where the player is in a game they own, counted as their profile says: the base game alone
   * (what the platinum needs) unless they chose to count DLC. Null once platinumed: what is left
   * then is DLC for the 100%, and this picks the next platinum. */
  const progressIn = async (t: TitleProgress): Promise<number | null> => {
    if (t.earnedByType.platinum > 0) return null
    if (withDlc) return t.progress
    const groups = await loadGroups(t, user)
    return groups?.base.total
      ? Math.round((groups.base.earned / groups.base.total) * 100)
      : t.progress
  }
  const all = await Promise.all(
    interests.map(async (i) => {
      const guide = await getGuide<GuideFacts>(i.game.id)
      const mine = owned.get(i.game.id)
      const progress = mine ? await progressIn(mine) : null
      // A saved game already finished is no next platinum.
      if (mine && progress === null) return null
      return {
        game: i.game.id,
        name: i.game.name,
        owned: !!mine,
        progress,
        difficulty: num(guide?.difficulty),
        hours: num(guide?.hours),
        playthroughs: num(guide?.playthroughs),
        hasMissables: guide?.hasMissables ?? null,
        hasOnline: guide?.hasOnline ?? null,
      }
    }),
  )
  const open = all.filter((c) => c !== null)
  if (!open.length) return null
  const since = Date.now() - PLAYING_DAYS * 86_400_000
  const isPlaying = (game: string) => {
    const t = owned.get(game)
    return !!t && new Date(t.lastUpdated).getTime() >= since
  }
  // Only games being played left: the pick is among them, which tells the player to finish first.
  const rest = open.filter((c) => !isPlaying(c.game))
  const choices = rest.length ? rest : open
  const playing = rest.length
    ? open.filter((c) => isPlaying(c.game)).map((c) => ({ name: c.name, progress: c.progress }))
    : []
  const recent = await Promise.all(
    library
      .filter((t) => t.earnedByType.platinum > 0)
      .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
      .slice(0, RECENT)
      .map(async (t) => {
        const game = games.get(t.npCommunicationId)
        const guide = game ? await getGuide<GuideFacts>(game.id) : undefined
        return { name: t.name, hours: num(guide?.hours), difficulty: num(guide?.difficulty) }
      }),
  )
  const profile = (user.taste_profile as { summary?: string } | null)?.summary ?? null
  const answer = await aroundModel({ user, action: 'next_pick' }, () =>
    tagged({ user: user.id, action: 'next_pick' }, () =>
      ai<{ game: string; why: string; firstStep: string } | null>('/interests/next', {
        choices,
        playing,
        recent,
        profile,
        locale,
      }),
    ),
  )
  if (!answer) return null
  const chosen =
    interests.find((i) => i.game.id === answer.game) ??
    (interests.find((i) => i.game.id === choices[0].game) as (typeof interests)[number])
  await markNextPick(user.id, chosen.game.id)
  return {
    game: { id: chosen.game.id, name: chosen.game.name, cover_url: chosen.game.cover_url ?? null },
    why: answer.why,
    firstStep: answer.firstStep,
  }
}
