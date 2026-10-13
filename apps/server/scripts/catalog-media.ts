// bun run catalog:media [--all] — fills each catalog game's gallery and "about" facts from IGDB
// (scenes, studios, official site, release day). Only games without them, unless --all. Writing
// them is not a change to the game itself, so updated_at is held while they are written.
import { closeDb, q } from '../src/db.ts'
import { mediaByIds } from '../src/igdb.ts'
import { gameRef } from '../src/repository/game.ts'

const all = process.argv.includes('--all')
const rows = await q<{ id: string; igdb_id: number }[]>(
  `SELECT meta::id(id) AS id, igdb_id FROM game WHERE igdb_id != NONE${all ? '' : ' AND array::len(screenshot_ids ?? []) = 0'}`,
)
console.log(`${rows.length} games to fill`)
const media = await mediaByIds(rows.map((r) => r.igdb_id))
await q('DEFINE FIELD OVERWRITE updated_at ON game TYPE datetime DEFAULT time::now()')
let filled = 0
try {
  for (const r of rows) {
    const m = media.get(r.igdb_id)
    if (!m) continue
    await q(
      'UPDATE $id SET screenshot_ids = $shots, developers = $devs, website = $site, released_at = $day RETURN NONE',
      {
        id: gameRef(String(r.id)),
        shots: m.screenshot_ids,
        devs: m.developers,
        site: m.website ?? undefined,
        day: m.released_at ? new Date(m.released_at) : undefined,
      },
    )
    if (++filled % 500 === 0) console.log(`${filled} filled`)
  }
} finally {
  await q(
    'DEFINE FIELD OVERWRITE updated_at ON game TYPE datetime DEFAULT time::now() VALUE time::now()',
  )
}
console.log(`catalog: ${filled} of ${rows.length} games with their gallery and facts`)
await closeDb()
