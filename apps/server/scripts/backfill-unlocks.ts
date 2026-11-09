// bun run backfill-unlocks — reads, once, the earned list of every title in every player's library
// from PSN and keeps each trophy's unlock time (ADR-015). From then on each sync keeps the new ones.
// Slow on purpose: one title at a time with a pause (DELAY ms, default 1500), to stay under PSN's
// limits. A title already kept is skipped, so it can stop and run again. ONLY=<psn id> and
// LIMIT=<titles per player> narrow a trial run.
import { closeDb, q } from '../src/db.ts'
import { isDemo, storedProgress } from '../src/demo.ts'
import { titleTrophies } from '../src/psn.ts'
import { titlesOfAccount } from '../src/repository/title.ts'
import { saveUnlocks } from '../src/repository/unlock.ts'
import { listUsers, userRef } from '../src/repository/user.ts'

const delay = Number(process.env.DELAY ?? 1500)
const only = process.env.ONLY?.toLowerCase()
const limit = Number(process.env.LIMIT ?? Number.POSITIVE_INFINITY)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let kept = 0
let failed = 0
for (const user of await listUsers()) {
  if (isDemo(user) || !user.psn_account_id) continue
  if (only && user.psn_online_id.toLowerCase() !== only) continue
  const done = new Set(
    (
      (await q<{ np: string }[]>(
        'SELECT np_communication_id AS np FROM unlock WHERE user = $user GROUP BY np',
        { user: userRef(user.id) },
      )) ?? []
    ).map((r) => r.np),
  )
  const titles = (await titlesOfAccount(user.psn_account_id))
    .filter((t) => t.earned > 0 && !done.has(t.np_communication_id))
    .slice(0, limit)
  for (const row of titles) {
    try {
      const list = await titleTrophies(storedProgress(row), user.psn_account_id)
      const earned = list.flatMap((t) =>
        t.earned && t.earnedAt ? [{ id: t.id, earnedAt: t.earnedAt }] : [],
      )
      await saveUnlocks(user.id, row.np_communication_id, earned)
      kept += earned.length
    } catch (e) {
      failed++
      console.error(`${user.psn_online_id} ${row.name}: ${(e as Error).message}`)
    }
    await sleep(delay)
  }
  console.log(`${user.psn_online_id}: ${titles.length} titles`)
}
console.log(`kept ${kept} unlocks, ${failed} titles failed`)
await closeDb()
