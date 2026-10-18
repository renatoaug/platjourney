/** Nexo picks one game to platinum now, when the player asks: among the games saved in their
 * interests, or among any game their taste brings up. They may say what they feel like right now
 * (something short, to relax after work) and keep to games they already have: their library and
 * their PS Plus catalog. What each guide says, where the player is in each game and the pace of
 * their last platinums go to the service, which answers with one game, why it fits now and what to
 * do first. Every pick is kept with the player's recommendations, so asking again brings another
 * game and the earlier picks can be looked back at. */
import { ai } from './ai.ts'
import { tagged } from './costs.ts'
import type { Locale } from './i18n.ts'
import { aroundModel } from './plugins.ts'
import type { TitleProgress } from './psn.ts'
import { PLUS_TIERS, type PlusTier, tierCovers } from './psstore.ts'
import { loadGroups } from './ranking.ts'
import { type Game, gamesForTitles, getGame } from './repository/game.ts'
import { getGuide } from './repository/guide.ts'
import { listInterests, markNextPick } from './repository/interest.ts'
import {
  listDismissed,
  listPicks,
  type PickRow,
  type PickScope,
  recentPickGames,
  savePick,
} from './repository/recommendation.ts'
import { plusCatalog } from './repository/store-price.ts'
import type { User } from './repository/user.ts'
import { graphCandidates } from './similar.ts'

interface GuideFacts {
  difficulty?: number
  hours?: number
  playthroughs?: number
  hasMissables?: boolean
  hasOnline?: boolean
}

/** What the player asked for: their mood, where to look, and whether to keep to games they have. */
export interface PickAsk {
  mood?: string
  scope?: PickScope
  ownedOnly?: boolean
}

export interface NextPick {
  id: string
  game: { id: string; name: string; cover_url?: string | null }
  why: string
  firstStep: string
  mood: string | null
  scope: PickScope
  ownedOnly: boolean
  /** False when nothing matched the mood and Nexo chose the closest. */
  fits: boolean
  at: string
}

// Enough of the last platinums to read a pace; more only makes the prompt longer.
const RECENT = 5
// A saved game with a trophy this recent is the one being played: the pick is what comes after it.
const PLAYING_DAYS = 7
// Asking again within this long brings a game not picked yet, until every one was.
const AGAIN_HOURS = 24
// The most games the service weighs at once from the player's library and PS Plus catalog.
const MAX_CHOICES = 30
export const MAX_MOOD = 120

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

const coveredTiers = (mine: User['ps_plus']): PlusTier[] =>
  PLUS_TIERS.filter((tier) => tierCovers(mine, tier))

const view = (r: PickRow): NextPick => ({
  id: r.id,
  game: { id: r.game.id, name: r.game.name, cover_url: r.game.cover_url ?? null },
  why: r.why,
  firstStep: r.first_step,
  mood: r.mood ?? null,
  scope: r.scope,
  ownedOnly: r.owned_only === true,
  fits: r.fits !== false,
  at: r.created_at,
})

/** The player's picks, the latest first. */
export async function pickHistory(user: User): Promise<NextPick[]> {
  return (await listPicks(user.id)).map(view)
}

/** What the choices are read from: the player, their library tied to the catalog, the PS Plus games
 * they can play, and what to leave out. */
interface Player {
  user: User
  library: TitleProgress[]
  games: Map<string, Game>
  /** Where the player is in each catalog game they own. */
  owned: Map<string, TitleProgress>
  plus: Set<string>
  turnedDown: Set<string>
}

/** Where the player is in a game they own, counted as their profile says: the base game alone (what
 * the platinum needs) unless they chose to count DLC. Null once platinumed: what is left then is DLC
 * for the 100%, and this picks the next platinum. */
async function progressIn(p: Player, t: TitleProgress): Promise<number | null> {
  if (t.earnedByType.platinum > 0) return null
  if (p.user.include_dlc_progress === true) return t.progress
  const groups = await loadGroups(t, p.user)
  return groups?.base.total
    ? Math.round((groups.base.earned / groups.base.total) * 100)
    : t.progress
}

/** A game as the service weighs it, or null when the player already platinumed it. */
async function choiceFor(p: Player, game: Pick<Game, 'id' | 'name'>) {
  const guide = await getGuide<GuideFacts>(game.id)
  const mine = p.owned.get(game.id)
  const progress = mine ? await progressIn(p, mine) : null
  if (mine && progress === null) return null
  return {
    game: game.id,
    name: game.name,
    owned: !!mine,
    progress,
    difficulty: num(guide?.difficulty),
    hours: num(guide?.hours),
    playthroughs: num(guide?.playthroughs),
    hasMissables: guide?.hasMissables ?? null,
    hasOnline: guide?.hasOnline ?? null,
  }
}

type Choice = NonNullable<Awaited<ReturnType<typeof choiceFor>>>
const listed = (cs: (Choice | null)[]) => cs.filter((c): c is Choice => c !== null)

/** The saved games still open, and the ones being played, which go as what the pick comes after. */
async function fromInterests(p: Player, saved: Pick<Game, 'id' | 'name'>[], ownedOnly: boolean) {
  const has = (game: string) => p.owned.has(game) || p.plus.has(game)
  const open = listed(await Promise.all(saved.map((g) => choiceFor(p, g)))).filter(
    (c) => !ownedOnly || has(c.game),
  )
  const since = Date.now() - PLAYING_DAYS * 86_400_000
  const isPlaying = (game: string) => {
    const t = p.owned.get(game)
    return !!t && new Date(t.lastUpdated).getTime() >= since
  }
  // Only games being played left: the pick is among them, which tells the player to finish first.
  const rest = open.filter((c) => !isPlaying(c.game))
  return {
    offered: rest.length ? rest : open,
    playing: rest.length
      ? open.filter((c) => isPlaying(c.game)).map((c) => ({ name: c.name, progress: c.progress }))
      : [],
  }
}

/** The games the player has: started and not platinumed, the most recent first, then the PS Plus
 * catalog. */
async function fromWhatTheyHave(p: Player): Promise<Choice[]> {
  const started = [...p.library]
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
    .flatMap((t) => {
      const g = p.games.get(t.npCommunicationId)
      return g ? [g] : []
    })
  const fromPlus = await Promise.all(
    [...p.plus].filter((id) => !p.owned.has(id)).map((id) => getGame(id)),
  )
  const pool = [...started, ...fromPlus.filter((g): g is Game => !!g)].filter(
    (g) => !p.turnedDown.has(g.id),
  )
  return listed(await Promise.all(pool.slice(0, MAX_CHOICES).map((g) => choiceFor(p, g))))
}

/** Any game, for the service to draw by taste: past the ones owned, turned down and just picked. */
async function drawFor(p: Player, skip: string[]) {
  const exclude = new Set([...p.owned.keys(), ...p.turnedDown, ...skip])
  return {
    library: p.library.map((t) => ({
      name: t.name,
      progress: t.progress,
      lastUpdated: t.lastUpdated,
      earnedByType: t.earnedByType,
      game: p.games.get(t.npCommunicationId)?.id ?? null,
    })),
    exclude: [...exclude],
    candidates: await graphCandidates(p.user, p.library, p.games, exclude).catch(() => []),
  }
}

/** The last platinums with what their guides say: the player's pace. */
function recentPlatinums(p: Player) {
  return Promise.all(
    p.library
      .filter((t) => t.earnedByType.platinum > 0)
      .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
      .slice(0, RECENT)
      .map(async (t) => {
        const game = p.games.get(t.npCommunicationId)
        const guide = game ? await getGuide<GuideFacts>(game.id) : undefined
        return { name: t.name, hours: num(guide?.hours), difficulty: num(guide?.difficulty) }
      }),
  )
}

/** What the service chooses from: the listed games (not the ones just picked, while others are
 * left), the ones being played, and for any game the draw by taste. */
async function optionsFor(
  p: Player,
  scope: PickScope,
  ownedOnly: boolean,
  saved: Pick<Game, 'id' | 'name'>[],
  skip: string[],
) {
  if (scope === 'any' && !ownedOnly)
    return { choices: [], playing: [], draw: await drawFor(p, skip) }
  const { offered, playing } =
    scope === 'interests'
      ? await fromInterests(p, saved, ownedOnly)
      : { offered: await fromWhatTheyHave(p), playing: [] }
  // Asked again: another game, until every one has been picked and the round starts over.
  const unseen = offered.filter((c) => !skip.includes(c.game))
  return { choices: unseen.length ? unseen : offered, playing, draw: undefined }
}

/** The game the answer names. One the service drew is checked against the catalog; a listed one it
 * could not tie to the list falls back to the first choice. */
async function answered(game: string, choices: Choice[], drawn: boolean) {
  const chosen = choices.find((c) => c.game === game)
  if (chosen) return { id: chosen.game, name: chosen.name }
  if (drawn) return (await getGame(game)) ?? null
  return { id: choices[0].game, name: choices[0].name }
}

/** The pick, or null when there is nothing to choose from: no saved game for the year, or none the
 * player has when they keep to those. */
export async function nextPick(
  user: User,
  library: TitleProgress[],
  locale: Locale,
  ask: PickAsk = {},
  year = new Date().getFullYear(),
): Promise<NextPick | null> {
  const scope = ask.scope ?? 'interests'
  const ownedOnly = ask.ownedOnly === true
  const mood = ask.mood?.trim().slice(0, MAX_MOOD).trim() || undefined
  const [interests, games, dismissed, skip] = await Promise.all([
    listInterests(user.id, year),
    gamesForTitles(library, false),
    listDismissed(user.id),
    recentPickGames(user.id, scope, AGAIN_HOURS),
  ])
  if (scope === 'interests' && !interests.length) return null
  const owned = new Map<string, TitleProgress>()
  for (const t of library) {
    const g = games.get(t.npCommunicationId)
    if (g) owned.set(g.id, t)
  }
  const player: Player = {
    user,
    library,
    games,
    owned,
    plus: new Set(ownedOnly ? await plusCatalog(coveredTiers(user.ps_plus)) : []),
    turnedDown: new Set(dismissed.map((d) => d.game.id)),
  }
  const saved = interests.map((i) => i.game)
  const { choices, playing, draw } = await optionsFor(player, scope, ownedOnly, saved, skip)
  if (!choices.length && !draw) return null

  const answer = await aroundModel({ user, action: 'next_pick' }, async () =>
    tagged({ user: user.id, action: 'next_pick' }, async () =>
      ai<{ game: string; why: string; firstStep: string; fits: boolean } | null>('/pick', {
        choices,
        playing,
        recent: await recentPlatinums(player),
        profile: (user.taste_profile as { summary?: string } | null)?.summary ?? null,
        locale,
        scope,
        ...(mood ? { mood } : {}),
        ...(draw ? { draw } : {}),
      }),
    ),
  )
  if (!answer) return null
  const game = await answered(answer.game, choices, !!draw)
  if (!game) return null
  if (scope === 'interests') await markNextPick(user.id, game.id)
  return view(
    await savePick(user.id, {
      game: game.id,
      why: answer.why,
      first_step: answer.firstStep,
      ...(mood ? { mood } : {}),
      scope,
      owned_only: ownedOnly,
      fits: answer.fits !== false,
    }),
  )
}
