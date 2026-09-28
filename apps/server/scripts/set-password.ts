// bun run password <psn id> — sets the password of an existing account from the
// terminal (e.g. the one that came from the seed) and ends its open sessions.

import { MIN_PASSWORD } from '../src/auth.ts'
import { closeDb, q } from '../src/db.ts'

const onlineId = process.argv[2]
if (!onlineId) {
  console.error('usage: bun run password <psn id>')
  process.exit(1)
}
const password = prompt(`New password for ${onlineId} (min ${MIN_PASSWORD}):`) ?? ''
if (password.length < MIN_PASSWORD) {
  console.error('too short')
  process.exit(1)
}
const [user] = await q<{ id: unknown }[]>(
  'UPDATE user SET password_hash = $hash WHERE psn_online_id_lower = $id RETURN id',
  { hash: await Bun.password.hash(password), id: onlineId.toLowerCase() },
)
if (user) await q('DELETE auth_session WHERE user = $user', { user: user.id })
console.log(user ? 'password set' : `no account for ${onlineId}`)
await closeDb()
