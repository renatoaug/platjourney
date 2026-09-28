// bun run migrate — applies every db/migrations/*.surql (idempotent).
import { closeDb, migrate } from '../src/db.ts'

const files = await migrate()
console.log(`applied ${files.length} migrations:\n  ${files.join('\n  ')}`)
await closeDb()
