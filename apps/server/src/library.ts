import { isDemoAccount, storedTitles } from './demo.ts'
import { allTitles, type TitleProgress } from './psn.ts'
import { type Game, gamesForTitles } from './repository/game.ts'

const TTL_MS = 10 * 60_000

const titlesCache = new Map<string, { at: number; titles: TitleProgress[] }>()
const gamesCache = new Map<string, { at: number; games: Game[] }>()

// The full trophy list is one heavier PSN call; several features read it, so it
// is kept per PSN account and refreshed at most every 10 minutes.
export async function library(accountId: string, force = false): Promise<TitleProgress[]> {
  // The demo player has no PSN account: its library is what the demo seed stored.
  if (isDemoAccount(accountId)) return storedTitles(accountId)
  const cached = titlesCache.get(accountId)
  if (cached && !force && Date.now() - cached.at < TTL_MS) return cached.titles
  const titles = await allTitles(accountId)
  titlesCache.set(accountId, { at: Date.now(), titles })
  return titles
}

// Every catalog game the player owns (titles collapsed onto games).
export async function ownedGames(accountId: string): Promise<Game[]> {
  const cached = gamesCache.get(accountId)
  if (cached && Date.now() - cached.at < TTL_MS) return cached.games
  const titles = await library(accountId)
  const byId = new Map<string, Game>()
  for (const g of (await gamesForTitles(titles, false)).values()) byId.set(g.id, g)
  const games = [...byId.values()]
  gamesCache.set(accountId, { at: Date.now(), games })
  return games
}
