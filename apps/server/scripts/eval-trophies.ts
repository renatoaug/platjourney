// bun run eval:trophies — fetches from PSN the official trophy list of every game in the answers
// eval, as the chat gets it for a game the player does not own, and writes them to
// services/ai/evals/data/trophies.local.json (not versioned). The answers suite reads that file for
// a game with no stored list, so Nexo can match Portuguese trophy names to the guides and know what
// the case has earned, as in the app.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { closeDb, q } from '../src/db.ts'
import { catalogTrophies } from '../src/psn.ts'

const DATA = join(import.meta.dir, '../../../services/ai/evals/data')
const { cases } = JSON.parse(readFileSync(join(DATA, 'answers.json'), 'utf8')) as {
  cases: { game: string }[]
}
const names = [...new Set(cases.map((c) => c.game))].sort()

const lists: Record<string, { platform: string; trophies: unknown[] }> = {}
for (const name of names) {
  const [game] = await q<{ np_communication_ids?: string[] }[]>(
    'SELECT np_communication_ids FROM game WHERE name = $name LIMIT 1',
    { name },
  )
  const list = game ? await catalogTrophies(game.np_communication_ids ?? []) : null
  if (!list) {
    console.log(`  no list: ${name}`)
    continue
  }
  // The stored form (snake_case), the same as a title's trophies in the database.
  lists[name] = {
    platform: list.platform,
    trophies: list.trophies.map((t) => ({
      id: t.id,
      name: t.name,
      detail: t.detail,
      name_en: t.nameEn,
      detail_en: t.detailEn,
      type: t.type,
      rarity: t.rarity,
      earned_rate: t.earnedRate,
      hidden: t.hidden,
      group_id: t.groupId,
    })),
  }
}
writeFileSync(join(DATA, 'trophies.local.json'), `${JSON.stringify(lists)}\n`)
console.log(`eval trophies: ${Object.keys(lists).length} of ${names.length} games`)
await closeDb()
