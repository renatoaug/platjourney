// bun run catalog:similar — writes the graph between catalog games from IGDB: each game's similar
// games (similar_to, only the ones in the catalog, with their place in IGDB's list), the base game a
// standalone expansion belongs to (expansion_of) and its series. A game's links are deleted and
// written again, so it is safe to re-run. Writing them is not a change to the game itself, so
// updated_at is held while they are written.
import { closeDb, plain, q } from '../src/db.ts'
import { relationsByIds } from '../src/igdb.ts'
import { writeRelations } from '../src/repository/similar.ts'
import { catalogLinks } from '../src/similar.ts'

const rows = plain(
  await q<{ id: string; igdb_id: number }[]>('SELECT id, igdb_id FROM game WHERE igdb_id != NONE'),
)
console.log(`${rows.length} games with an IGDB id`)
const byIgdb = new Map(rows.map((r) => [r.igdb_id, r.id]))
const relations = await relationsByIds(rows.map((r) => r.igdb_id))
await q('DEFINE FIELD OVERWRITE updated_at ON game TYPE datetime DEFAULT time::now()')
let games = 0
let similar = 0
let expansions = 0
let inSeries = 0
try {
  for (const r of rows) {
    const found = relations.get(r.igdb_id)
    if (!found) continue
    const links = catalogLinks(r.id, found, byIgdb)
    await writeRelations(r.id, links)
    similar += links.similar.length
    expansions += links.base ? 1 : 0
    inSeries += links.series.length ? 1 : 0
    if (++games % 500 === 0) console.log(`${games} written`)
  }
} finally {
  await q(
    'DEFINE FIELD OVERWRITE updated_at ON game TYPE datetime DEFAULT time::now() VALUE time::now()',
  )
}
console.log(
  `catalog: ${games} of ${rows.length} games linked; ${similar} similar_to edges, ${expansions} expansion_of edges, ${inSeries} games in a series`,
)
await closeDb()
