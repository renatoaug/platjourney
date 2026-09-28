// bun run check-servers — looks up online-server shutdowns for every player's games
// next to the platinum and records the warnings (they show up in the notifications).
// The watcher does this daily unless AI_RESEARCH=0; it searches the web, so it costs.
import { tagged } from '../src/costs.ts'
import { closeDb } from '../src/db.ts'
import { library } from '../src/library.ts'
import { listUsers } from '../src/repository/user.ts'
import { checkServers } from '../src/servers.ts'

for (const user of await listUsers()) {
  const warnings = await tagged({ user: user.id }, async () =>
    checkServers(user, await library(user.psn_account_id)),
  )
  console.log(`${user.psn_online_id}: ${warnings.length} new warnings`)
}
await closeDb()
