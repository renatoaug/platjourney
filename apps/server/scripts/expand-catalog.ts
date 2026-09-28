// bun run catalog:expand — pulls well-rated PlayStation games from IGDB into the
// catalog so recommendations have a pool beyond what the player already owns.
import { closeDb } from '../src/db.ts'
import { popularGames, toCatalog } from '../src/igdb.ts'
import { upsertFromCatalog } from '../src/repository/game.ts'

const MIN_RATINGS = Number(process.argv[2] ?? 20)
let total = 0
for (let offset = 0; ; offset += 500) {
  const page = await popularGames(MIN_RATINGS, offset)
  if (page.length === 0) break
  for (const g of page) {
    await upsertFromCatalog(toCatalog(g), g.name)
    total++
  }
  console.log(`${total} games so far (last: ${page.at(-1)?.name})`)
  if (page.length < 500) break
}
console.log(`catalog: ${total} games from IGDB with more than ${MIN_RATINGS} ratings`)
await closeDb()
