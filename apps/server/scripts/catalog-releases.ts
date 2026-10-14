// bun run catalog:releases — adds the PS4 and PS5 games out in the last two weeks or in the next six
// to the catalog, as the server does once a day, for the home's calendar.
import { closeDb } from '../src/db.ts'
import { syncReleases } from '../src/releases.ts'

console.log(`catalog: ${await syncReleases()} games in the calendar window`)
await closeDb()
