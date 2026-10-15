// bun run catalog:similar — writes the graph between catalog games from IGDB: each game's similar
// games (similar_to, only the ones in the catalog, with their place in IGDB's list), the base game a
// standalone expansion belongs to (expansion_of) and its series. A game's links are deleted and
// written again, so it is safe to re-run. The server also does this on its own every night for new
// games and every Sunday for the whole catalog.
import { closeDb } from '../src/db.ts'
import { syncSimilar } from '../src/similar-sync.ts'

const c = await syncSimilar(process.argv.includes('--new'))
console.log(
  `catalog: ${c.linked} of ${c.games} games linked; ${c.similar} similar_to edges, ${c.expansions} expansion_of edges, ${c.inSeries} games in a series`,
)
await closeDb()
