import type { Relations } from './igdb.ts'
import type { TitleProgress } from './psn.ts'
import { emptyPrefs, type RecFilters, readPrefs } from './recommend.ts'
import { type Game, gamesForTitles } from './repository/game.ts'
import { listInterests } from './repository/interest.ts'
import { listDismissed } from './repository/recommendation.ts'
import {
  expansionLinks,
  type GuideFacts,
  gamesByIds,
  guidedInSeries,
  guideFacts,
  peerPlatinums,
  type SimilarEdge,
  seriesOf,
  similarEdges,
  similarOf,
} from './repository/similar.ts'
import type { User } from './repository/user.ts'

// Recommendations by similarity: free, instant and explainable. The player's games are seeds, IGDB's
// "similar games" are the edges (similar_to), and other players who platinumed the same games add
// weight to what they platinumed next. No model is called; the model's picks stay on demand
// (recommend.ts), fed by these same candidates.

const DAY = 86_400_000
/** A title played this recently counts a bit more. */
const RECENT_DAYS = 90
/** Each other player who platinumed a seed and the candidate. */
const CO_PLATINUM = 2
/** IGDB's first similar games add up to this much on top of the seed's weight. */
const RANK_BONUS = 0.5
const RANKED = 10
const MAX_PICKS = 12
const MAX_SHORT = 6
const MAX_BECAUSE = 3
/** How many of the graph's candidates the model's picks start from. */
const MAX_CANDIDATES = 60
/** A quick platinum: at most this many hours and this difficulty. */
const QUICK_HOURS = 10
const QUICK_DIFFICULTY = 3

/** A game from the player's library the recommendations start from. */
export interface Seed {
  game: string
  name: string
  weight: number
  /** Platinumed or at least half done: what the player surely liked. */
  strong: boolean
  platinum: boolean
}

export interface SimilarPick {
  game: Game
  platform: string
  difficulty: number
  hours: number
  playthroughs: number | null
  hasMissables: boolean
  hasDifficultyTrophy: boolean | null
  /** The player's games that led to it, the heaviest first. */
  because: string[]
  /** The ones among `because` the player platinumed ("Você platinou X"). */
  platinumed: string[]
}

interface SimilarPicks {
  items: SimilarPick[]
  /** Short and easy platinums among the same candidates. */
  quick: SimilarPick[]
  /** Expansions, base games and the same series as games the player liked. */
  series: SimilarPick[]
  /** No library to start from: nothing was searched. */
  reason?: 'no-library'
}

export type Relation = 'expansion' | 'base' | 'series' | 'similar'

export interface SimilarGame {
  game: Game
  difficulty: number
  hours: number
  relation: Relation
}

const platinumed = (t: TitleProgress) => t.earnedByType.platinum > 0

/** How much a title says about the player's taste: a platinum 3, half done 2, else 1, and 1 more
 * when played in the last 90 days. */
export function titleWeight(t: TitleProgress, now = Date.now()): number {
  const base = platinumed(t) ? 3 : t.progress >= 50 ? 2 : 1
  return base + (now - new Date(t.lastUpdated).getTime() <= RECENT_DAYS * DAY ? 1 : 0)
}

/** The catalog games of the player's titles, by game id; several copies of a game keep the
 * heaviest. */
export function seedWeights(
  library: TitleProgress[],
  games: Map<string, Game>,
  now = Date.now(),
): Map<string, Seed> {
  const seeds = new Map<string, Seed>()
  for (const t of library) {
    const game = games.get(t.npCommunicationId)
    if (!game) continue
    const weight = titleWeight(t, now)
    const strong = platinumed(t) || t.progress >= 50
    const prev = seeds.get(game.id)
    seeds.set(game.id, {
      game: game.id,
      name: game.name,
      weight: Math.max(weight, prev?.weight ?? 0),
      strong: strong || Boolean(prev?.strong),
      platinum: platinumed(t) || Boolean(prev?.platinum),
    })
  }
  return seeds
}

export interface Scored {
  game: string
  score: number
  because: string[]
}

const rankBonus = (rank: number) => (Math.max(0, RANKED - rank) / RANKED) * RANK_BONUS

/** Every game the seeds point at, the best first: the weights of the seeds that lead to it, a bonus
 * for being high in IGDB's list, and 2 per other player who platinumed a seed and it. */
export function scoreCandidates(
  seeds: Map<string, Seed>,
  edges: SimilarEdge[],
  peers: { user: string; game: string }[],
): Scored[] {
  const found = new Map<string, { score: number; from: Map<string, number> }>()
  for (const e of edges) {
    const seed = seeds.get(e.seed)
    if (!seed || seeds.has(e.game)) continue
    const entry = found.get(e.game) ?? { score: 0, from: new Map<string, number>() }
    entry.score += seed.weight + rankBonus(e.rank)
    entry.from.set(seed.name, Math.max(seed.weight, entry.from.get(seed.name) ?? 0))
    found.set(e.game, entry)
  }
  const players = new Map<string, Set<string>>()
  for (const p of peers) players.set(p.game, (players.get(p.game) ?? new Set()).add(p.user))
  return [...found]
    .map(([game, e]) => ({
      game,
      score: e.score + CO_PLATINUM * (players.get(game)?.size ?? 0),
      because: heaviest(e.from),
    }))
    .sort((a, b) => b.score - a.score || a.game.localeCompare(b.game))
}

const heaviest = (names: Map<string, number>) =>
  [...names]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_BECAUSE)
    .map(([name]) => name)

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Whether what the guide says breaks one of the player's rules. What it does not say passes. */
export function breaksRules(f: GuideFacts, rules: RecFilters): boolean {
  const checks: [unknown, boolean][] = [
    [rules.noMissables, f.hasMissables === true],
    [rules.noOnline, f.hasOnline === true || (f.onlineTrophies ?? 0) > 0],
    [rules.noDifficultyTrophy, Boolean(f.difficultyTrophy)],
    [rules.onePlaythrough, (num(f.playthroughs) ?? 1) > 1],
    [rules.maxHours != null, (num(f.hours) ?? 0) > (rules.maxHours ?? 0)],
    [rules.maxDifficulty != null, (num(f.difficulty) ?? 0) > (rules.maxDifficulty ?? 0)],
  ]
  return checks.some(([on, broken]) => Boolean(on) && broken)
}

const PLATFORM_ORDER = ['PS5', 'PS4', 'PS Vita', 'PS3']
const platformOf = (game: Game) =>
  PLATFORM_ORDER.find((p) => game.platforms.includes(p)) ?? game.platforms[0] ?? ''

export function toPick(
  game: Game,
  f: GuideFacts,
  because: string[],
  platinumedNames: Set<string> = new Set(),
): SimilarPick {
  const runs = num(f.playthroughs)
  return {
    game,
    platform: platformOf(game),
    difficulty: num(f.difficulty) ?? 0,
    hours: num(f.hours) ?? 0,
    playthroughs: runs && Number.isInteger(runs) && runs > 0 ? runs : null,
    hasMissables: f.hasMissables === true,
    hasDifficultyTrophy: f.difficultyTrophy === undefined ? null : Boolean(f.difficultyTrophy),
    because,
    platinumed: because.filter((n) => platinumedNames.has(n)),
  }
}

const within = (v: unknown, max: number) => {
  const n = num(v)
  return n !== null && n > 0 && n <= max
}

/** Short and easy: guide hours up to 10 and difficulty up to 3, the best first. */
export function quickPicks<T extends { facts: GuideFacts }>(eligible: T[]): T[] {
  return eligible
    .filter(
      (c) => within(c.facts.hours, QUICK_HOURS) && within(c.facts.difficulty, QUICK_DIFFICULTY),
    )
    .slice(0, MAX_SHORT)
}

async function gameMap(ids: string[]): Promise<Map<string, Game>> {
  return new Map((await gamesByIds([...new Set(ids)])).map((g) => [g.id, g]))
}

async function factsMap(ids: string[]): Promise<Map<string, GuideFacts>> {
  return new Map((await guideFacts([...new Set(ids)])).map((f) => [String(f.game), f]))
}

/** The graph's candidates for these seeds, scored, the best first. */
async function graphScores(user: string, seeds: Map<string, Seed>): Promise<Scored[]> {
  const ids = [...seeds.keys()]
  const edges = await similarEdges(ids)
  const candidates = [...new Set(edges.map((e) => e.game))].filter((g) => !seeds.has(g))
  return scoreCandidates(seeds, edges, await peerPlatinums(user, ids, candidates))
}

type WithFacts<T> = T & { facts: GuideFacts }

/** Only candidates with a guide that follows the player's rules, in the same order. */
function eligible<T extends { game: string }>(
  list: T[],
  facts: Map<string, GuideFacts>,
  rules: RecFilters,
): WithFacts<T>[] {
  return list.flatMap((c) => {
    const f = facts.get(c.game)
    return f && !breaksRules(f, rules) ? [{ ...c, facts: f }] : []
  })
}

function picksOf(
  list: WithFacts<{ game: string; because: string[] }>[],
  games: Map<string, Game>,
  seeds: Map<string, Seed>,
): SimilarPick[] {
  const platinum = new Set([...seeds.values()].filter((s) => s.platinum).map((s) => s.name))
  return list.flatMap((c) => {
    const game = games.get(c.game)
    return game ? [toPick(game, c.facts, c.because, platinum)] : []
  })
}

export interface SeriesCandidate {
  game: string
  /** An expansion or base game of one of the player's games, before games of the same series. */
  close: boolean
  weight: number
  because: string[]
}

/** Games tied to what the player liked: expansions and base games (either direction of
 * expansion_of) first, then games of the same series, each by the heaviest of the player's games it
 * ties to. */
export function seriesCandidates(
  liked: Seed[],
  links: { expansion: string; base: string }[],
  seedSeries: { id: string; series: number[] }[],
  guided: { id: string; series: number[] }[],
  exclude: Set<string>,
): SeriesCandidate[] {
  const byId = new Map(liked.map((s) => [s.game, s]))
  const found = new Map<string, { close: boolean; weight: number; from: Map<string, number> }>()
  const add = (game: string, seed: Seed | undefined, close: boolean) => {
    if (!seed || exclude.has(game) || byId.has(game)) return
    const entry = found.get(game) ?? { close, weight: 0, from: new Map<string, number>() }
    entry.close ||= close
    entry.weight = Math.max(entry.weight, seed.weight)
    entry.from.set(seed.name, seed.weight)
    found.set(game, entry)
  }
  for (const l of links) {
    add(l.expansion, byId.get(l.base), true)
    add(l.base, byId.get(l.expansion), true)
  }
  for (const s of seedSeries)
    for (const g of guided)
      if (g.series.some((x) => s.series.includes(x))) add(g.id, byId.get(s.id), false)
  return [...found]
    .map(([game, e]) => ({ game, close: e.close, weight: e.weight, because: heaviest(e.from) }))
    .sort(
      (a, b) =>
        Number(b.close) - Number(a.close) || b.weight - a.weight || a.game.localeCompare(b.game),
    )
}

/** Guided games tied to the games the player platinumed or got halfway through, top 6. */
async function seriesPicks(
  seeds: Map<string, Seed>,
  exclude: Set<string>,
  rules: RecFilters,
): Promise<SimilarPick[]> {
  const liked = [...seeds.values()].filter((s) => s.strong)
  const ids = liked.map((s) => s.game)
  const [links, seedSeries] = await Promise.all([expansionLinks(ids), seriesOf(ids)])
  const guided = await guidedInSeries([...new Set(seedSeries.flatMap((s) => s.series))])
  const candidates = seriesCandidates(liked, links, seedSeries, guided, exclude)
  const top = eligible(candidates, await factsMap(candidates.map((c) => c.game)), rules).slice(
    0,
    MAX_SHORT,
  )
  return picksOf(top, await gameMap(top.map((c) => c.game)), seeds)
}

/** Games the player owns, dismissed or already saved, plus their own seeds. */
async function excluded(user: User, accountGames: Game[], seeds: Map<string, Seed>) {
  const [dismissed, interests] = await Promise.all([
    listDismissed(user.id),
    listInterests(user.id, new Date().getFullYear()),
  ])
  return new Set([
    ...accountGames.map((g) => g.id),
    ...seeds.keys(),
    ...dismissed.map((d) => d.game.id),
    ...interests.map((i) => i.game.id),
  ])
}

/** Recommendations from the graph: the 12 best guided games similar to the player's, the quick
 * ones among them and the ones tied to games they liked. Only reads. */
export async function similarPicks(
  user: User,
  library: TitleProgress[],
  accountGames: Game[],
): Promise<SimilarPicks> {
  if (library.length === 0) return { items: [], quick: [], series: [], reason: 'no-library' }
  const seeds = seedWeights(library, await gamesForTitles(library, false))
  const exclude = await excluded(user, accountGames, seeds)
  const rules = (readPrefs(user.taste_prefs) ?? emptyPrefs()).filters
  const scored = (await graphScores(user.id, seeds)).filter((c) => !exclude.has(c.game))
  const [ok, series] = await Promise.all([
    factsMap(scored.map((c) => c.game)).then((facts) => eligible(scored, facts, rules)),
    seriesPicks(seeds, exclude, rules),
  ])
  const top = ok.slice(0, MAX_PICKS)
  const quick = quickPicks(ok)
  const games = await gameMap([...top, ...quick].map((c) => c.game))
  return {
    items: picksOf(top, games, seeds),
    quick: picksOf(quick, games, seeds),
    series,
  }
}

/** The graph's candidates for the model's picks: up to 60 ids, the best first, without what is in
 * `exclude`. The player's rules are the AI service's to apply. */
export async function graphCandidates(
  user: User,
  library: TitleProgress[],
  games: Map<string, Game>,
  exclude: Set<string>,
): Promise<string[]> {
  const seeds = seedWeights(library, games)
  return (await graphScores(user.id, seeds))
    .filter((c) => !exclude.has(c.game))
    .slice(0, MAX_CANDIDATES)
    .map((c) => c.game)
}

/** The games related to one game, in the order the game page shows them: its expansions and its
 * base game, then IGDB's similar games by rank, then games of its series. Each once. */
export function relatedOrder(
  game: string,
  links: { expansion: string; base: string }[],
  similar: { game: string; rank: number }[],
  series: { id: string }[],
): { game: string; relation: Relation }[] {
  const ordered: { game: string; relation: Relation }[] = [
    ...links
      .filter((l) => l.base === game)
      .map((l) => ({ game: l.expansion, relation: 'expansion' as const })),
    ...links
      .filter((l) => l.expansion === game)
      .map((l) => ({ game: l.base, relation: 'base' as const })),
    ...[...similar]
      .sort((a, b) => a.rank - b.rank)
      .map((s) => ({ game: s.game, relation: 'similar' as const })),
    ...series.map((s) => ({ game: s.id, relation: 'series' as const })),
  ]
  const seen = new Set([game])
  return ordered.filter((r) => !seen.has(r.game) && Boolean(seen.add(r.game)))
}

/** Up to 6 guided games related to a game, for its page. */
export async function similarToGame(game: string): Promise<SimilarGame[]> {
  const [links, similar, own] = await Promise.all([
    expansionLinks([game]),
    similarOf(game),
    seriesOf([game]),
  ])
  const series = await guidedInSeries(own[0]?.series ?? [])
  const ordered = relatedOrder(game, links, similar, series)
  const facts = await factsMap(ordered.map((r) => r.game))
  const top = ordered.filter((r) => facts.has(r.game)).slice(0, MAX_SHORT)
  const games = await gameMap(top.map((r) => r.game))
  return top.flatMap((r) => {
    const g = games.get(r.game)
    const f = facts.get(r.game) as GuideFacts
    return g
      ? [
          {
            game: g,
            difficulty: num(f.difficulty) ?? 0,
            hours: num(f.hours) ?? 0,
            relation: r.relation,
          },
        ]
      : []
  })
}

/** What catalog-similar writes for one game: its similar games in the catalog with their place in
 * IGDB's list, its base game when that is in the catalog, and its series. */
export function catalogLinks(
  game: string,
  links: Relations,
  byIgdb: Map<number, string>,
): { similar: { game: string; rank: number }[]; base: string | null; series: number[] } {
  const seen = new Set<string>([game])
  const similar: { game: string; rank: number }[] = []
  links.similar.forEach((igdbId, rank) => {
    const to = byIgdb.get(igdbId)
    if (!to || seen.has(to)) return
    seen.add(to)
    similar.push({ game: to, rank })
  })
  const base = links.parent != null ? (byIgdb.get(links.parent) ?? null) : null
  return { similar, base: base === game ? null : base, series: [...new Set(links.series)] }
}
