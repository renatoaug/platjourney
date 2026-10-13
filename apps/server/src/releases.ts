// The release calendar's games: once a day the PS4 and PS5 games out in the last two weeks or in the
// next six are looked up in IGDB, and the ones the catalog lacks join it (popularity alone never
// brings in a game that is not out yet).
import { releasingGames, toCatalog } from './igdb.ts'
import { upsertFromCatalog } from './repository/game.ts'

const DAY = 86_400_000
export const RELEASES_BEFORE_DAYS = 14
export const RELEASES_AFTER_DAYS = 42

/** Adds or refreshes the window's games; answers how many. */
export async function syncReleases(now = Date.now()): Promise<number> {
  const games = await releasingGames(
    new Date(now - RELEASES_BEFORE_DAYS * DAY),
    new Date(now + RELEASES_AFTER_DAYS * DAY),
  )
  for (const g of games) await upsertFromCatalog(toCatalog(g), g.name)
  return games.length
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
