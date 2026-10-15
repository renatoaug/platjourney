import { camelKeys, plain, q } from '../db.ts'
import type { Game } from './game.ts'
import { gameRef } from './game.ts'
import { userRef } from './user.ts'

// The graph between catalog games: similar_to (IGDB's similar games) and expansion_of (an expansion
// to its base game), plus the series ids on each game. Written by `bun run catalog:similar`.

const refs = (ids: string[]) => ids.map(gameRef)

export interface SimilarEdge {
  /** The game the edge starts from. */
  seed: string
  game: string
  rank: number
}

/** Every similar_to edge out of these games. */
export async function similarEdges(seeds: string[]): Promise<SimilarEdge[]> {
  if (seeds.length === 0) return []
  return plain(
    await q<SimilarEdge[]>(
      'SELECT in AS seed, out AS game, rank FROM similar_to WHERE in IN $ids',
      {
        ids: refs(seeds),
      },
    ),
  )
}

/** Platinums of these candidates earned by other players who also platinumed one of the seeds. */
export async function peerPlatinums(
  user: string,
  seeds: string[],
  candidates: string[],
): Promise<{ user: string; game: string }[]> {
  if (seeds.length === 0 || candidates.length === 0) return []
  return plain(
    await q<{ user: string; game: string }[]>(
      `LET $peers = array::distinct((SELECT VALUE user FROM platinum WHERE game IN $seeds AND user != $user));
       SELECT user, game FROM platinum WHERE game IN $candidates AND user IN $peers`,
      { user: userRef(user), seeds: refs(seeds), candidates: refs(candidates) },
    ),
  )
}

/** What a guide says that the recommendations show and the player's rules look at. */
export interface GuideFacts {
  game: string
  difficulty?: number | null
  hours?: number | null
  playthroughs?: number | null
  hasMissables?: boolean | null
  hasOnline?: boolean | null
  /** How many online trophies the guide lists. */
  onlineTrophies?: number | null
  /** The trophy tied to a difficulty: null when the guide says there is none, absent when it does
   * not say. */
  difficultyTrophy?: string | null
}

/** The facts of the guides of these games; games without a guide are left out. */
export async function guideFacts(ids: string[]): Promise<GuideFacts[]> {
  if (ids.length === 0) return []
  return plain(
    await q<GuideFacts[]>(
      `SELECT game, guide.difficulty AS difficulty, guide.hours AS hours,
         guide.playthroughs AS playthroughs, guide.has_missables AS has_missables,
         guide.has_online AS has_online, array::len(guide.online_trophies ?? []) AS online_trophies,
         guide.difficulty_trophy AS difficulty_trophy
       FROM guide WHERE game IN $ids AND guide != NONE`,
      { ids: refs(ids) },
    ),
  ).map(camelKeys)
}

export async function gamesByIds(ids: string[]): Promise<Game[]> {
  if (ids.length === 0) return []
  return plain(await q<Game[]>('SELECT * OMIT embedding FROM $ids', { ids: refs(ids) }))
}

/** expansion_of edges that touch these games, in either direction. */
export async function expansionLinks(
  ids: string[],
): Promise<{ expansion: string; base: string }[]> {
  if (ids.length === 0) return []
  return plain(
    await q<{ expansion: string; base: string }[]>(
      'SELECT in AS expansion, out AS base FROM expansion_of WHERE in IN $ids OR out IN $ids',
      { ids: refs(ids) },
    ),
  )
}

/** The series ids of these games, for the ones that have any. */
export async function seriesOf(ids: string[]): Promise<{ id: string; series: number[] }[]> {
  if (ids.length === 0) return []
  return plain(
    await q<{ id: string; series: number[] | null }[]>(
      'SELECT id, series FROM game WHERE id IN $ids',
      {
        ids: refs(ids),
      },
    ),
  ).filter((r): r is { id: string; series: number[] } => Boolean(r.series?.length))
}

/** Games with a guide in any of these series. */
export async function guidedInSeries(
  series: number[],
): Promise<{ id: string; series: number[] }[]> {
  if (series.length === 0) return []
  return plain(
    await q<{ id: string; series: number[] }[]>(
      'SELECT game AS id, game.series AS series FROM guide WHERE guide != NONE AND game.series CONTAINSANY $series',
      { series },
    ),
  )
}

/** The game's similar games, the most similar first. */
export async function similarOf(game: string): Promise<{ game: string; rank: number }[]> {
  return plain(
    await q<{ game: string; rank: number }[]>(
      'SELECT out AS game, rank FROM similar_to WHERE in = $id ORDER BY rank',
      { id: gameRef(game) },
    ),
  )
}

/** Replaces a game's links: its similar_to edges, its expansion_of edge and its series. The game's
 * updated_at is the caller's to hold. */
export async function writeRelations(
  game: string,
  links: { similar: { game: string; rank: number }[]; base: string | null; series: number[] },
): Promise<void> {
  const id = gameRef(game)
  const similar = links.similar.map((s) => ({ in: id, out: gameRef(s.game), rank: s.rank }))
  const base = links.base ? [{ in: id, out: gameRef(links.base) }] : []
  await q(
    [
      'DELETE similar_to WHERE in = $id;',
      'DELETE expansion_of WHERE in = $id;',
      ...(similar.length ? ['INSERT RELATION INTO similar_to $similar RETURN NONE;'] : []),
      ...(base.length ? ['INSERT RELATION INTO expansion_of $base RETURN NONE;'] : []),
      'UPDATE $id SET series = $series RETURN NONE;',
    ].join('\n'),
    { id, similar, base, series: links.series.length ? links.series : undefined },
  )
}
