// Keeps the similar games graph current: every night the games that joined the catalog get their
// links, and once a week the whole catalog is written again, so older games also point at the new
// ones IGDB lists as similar.
import { plain, q } from './db.ts'
import { relationsByIds } from './igdb.ts'
import { writeRelations } from './repository/similar.ts'
import { brazilWeekday, everyDayAt } from './schedule.ts'
import { catalogLinks } from './similar.ts'

export interface SyncCounts {
  games: number
  linked: number
  similar: number
  expansions: number
  inSeries: number
}

/** Writes the links of every catalog game, or only of the games that have none yet. Writing them is
 * not a change to the game itself, so updated_at is held while they are written. */
export async function syncSimilar(onlyNew = false): Promise<SyncCounts> {
  const all = plain(
    await q<{ id: string; igdb_id: number }[]>(
      'SELECT id, igdb_id FROM game WHERE igdb_id != NONE',
    ),
  )
  const linked = onlyNew
    ? new Set(
        plain(await q<{ id: string }[]>('SELECT VALUE in FROM similar_to GROUP BY in')).map(String),
      )
    : new Set<string>()
  const rows = onlyNew ? all.filter((r) => !linked.has(String(r.id))) : all
  const counts: SyncCounts = {
    games: rows.length,
    linked: 0,
    similar: 0,
    expansions: 0,
    inSeries: 0,
  }
  if (rows.length === 0) return counts
  const byIgdb = new Map(all.map((r) => [r.igdb_id, r.id]))
  const relations = await relationsByIds(rows.map((r) => r.igdb_id))
  await q('DEFINE FIELD OVERWRITE updated_at ON game TYPE datetime DEFAULT time::now()')
  try {
    for (const r of rows) {
      const found = relations.get(r.igdb_id)
      if (!found) continue
      const links = catalogLinks(r.id, found, byIgdb)
      await writeRelations(r.id, links)
      counts.linked++
      counts.similar += links.similar.length
      counts.expansions += links.base ? 1 : 0
      counts.inSeries += links.series.length ? 1 : 0
    }
  } finally {
    await q(
      'DEFINE FIELD OVERWRITE updated_at ON game TYPE datetime DEFAULT time::now() VALUE time::now()',
    )
  }
  return counts
}

/** At 4:30 every night in Brazil: the new games, or on Sundays the whole catalog. */
export function startSimilarSync(): void {
  everyDayAt(4, 30, 'similar sync', async () => {
    const full = brazilWeekday() === 0
    const c = await syncSimilar(!full)
    console.log(
      `similar: ${c.linked} of ${c.games} ${full ? 'games' : 'new games'} linked, ${c.similar} edges`,
    )
  })
}
