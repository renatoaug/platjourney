// The release calendar's games: once a day the PS4 and PS5 games out in the last two weeks or in the
// next six are looked up in IGDB, and the ones the catalog lacks join it (popularity alone never
// brings in a game that is not out yet).
import { releasingGames, toCatalog, withoutEdition } from './igdb.ts'
import { gameByName, upsertFromCatalog } from './repository/game.ts'

const DAY = 86_400_000
export const RELEASES_BEFORE_DAYS = 14
export const RELEASES_AFTER_DAYS = 42

/** Adds or refreshes the window's games; answers how many. */
export async function syncReleases(now = Date.now()): Promise<number> {
  const games = await releasingGames(
    new Date(now - RELEASES_BEFORE_DAYS * DAY),
    new Date(now + RELEASES_AFTER_DAYS * DAY),
  )
  const names = new Set(games.map((g) => g.name.toLowerCase()))
  let synced = 0
  for (const g of games) {
    if (await isEdition(g.name, names)) continue
    await upsertFromCatalog(toCatalog(g), g.name)
    synced++
  }
  return synced
}

// A store edition IGDB lists as a game of its own ("Control Resonant: Special Edition") is the same
// game, with the same trophy list: it stays out when the game is in the window or in the catalog.
async function isEdition(name: string, window: Set<string>): Promise<boolean> {
  const base = withoutEdition(name)
  return !!base && (window.has(base.toLowerCase()) || !!(await gameByName(base)))
}

/** Runs it now and every day after; a failure waits for the next day. */
export function startReleaseSync(): void {
  const run = () =>
    syncReleases()
      .then((n) => console.log(`releases: ${n} games in the calendar window`))
      .catch((e) => console.error('releases sync failed:', e.message))
  setTimeout(run, 60_000).unref()
  setInterval(run, DAY).unref()
}
