// bun run seed [path] [--add | --force] — drops the database, re-applies migrations and loads a seed file.
// Without a path it loads the committed demo (db/demo-seed.json); a path is read from the
// repository root. With --add nothing is dropped:
// the seed's players replace their previous copy, and games and guides the database already has
// are kept as they are (`bun run seed --add` puts the demo player in a running instance). A
// database with players the seed does not include is only dropped with --force.
import { isAbsolute, resolve } from 'node:path'
import { closeDb, gameId, migrate, one, q, reset, rid } from '../src/db.ts'

type Row = Record<string, unknown>
interface Seed {
  // A seed built for a fixed day (the demo) moves every date by the days since then, so its
  // history reads as recent whenever it is loaded.
  anchor?: string
  user: Row[]
  game: Row[]
  title: Row[]
  guide: Row[]
  interest: Row[]
  platinum: Row[]
  dismissal: Row[]
  server_status: Row[]
  tip: Row[]
  message: Row[]
  notification?: Row[]
  recommendation?: Row[]
  playtime?: Row[]
  store_price?: Row[]
}

const ROOT = new URL('../../../', import.meta.url).pathname
const args = process.argv.slice(2)
const add = args.includes('--add')
const arg = args.find((a) => !a.startsWith('--'))
const file = arg ? (isAbsolute(arg) ? arg : resolve(ROOT, arg)) : resolve(ROOT, 'db/demo-seed.json')
const seed = (await Bun.file(file).json()) as Seed

const DAY = 86_400_000
const shift = seed.anchor
  ? Math.floor((Date.now() - new Date(seed.anchor).getTime()) / DAY) * DAY
  : 0
const years = seed.anchor ? new Date().getUTCFullYear() - new Date(seed.anchor).getUTCFullYear() : 0
const dt = (v: unknown) => (typeof v === 'string' ? new Date(new Date(v).getTime() + shift) : v)
const iso = (v: unknown) => (typeof v === 'string' ? (dt(v) as Date).toISOString() : v)
// option<...> fields reject NULL; a missing value must be NONE (undefined).
const dropNulls = (row: Row) =>
  Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null))
// "game:123" and user keys in the seed become record links.
const link = (row: Row): Row => ({
  ...row,
  ...(row.game == null ? {} : { game: gameId(String(row.game)) }),
  ...(row.user == null ? {} : { user: rid('user', String(row.user)) }),
})
// Yearly goals are keyed by year; a moved seed moves them along.
const movedTargets = (targets: unknown) =>
  Object.fromEntries(
    Object.entries((targets ?? {}) as Record<string, number>).map(([y, n]) => [
      String(Number(y) + years),
      n,
    ]),
  )

// Dropping a database with players the seed does not bring back loses them: that takes --force.
if (!add && !args.includes('--force')) {
  const keys = new Set(seed.user.map((u) => String(u.key)))
  const others = await q<{ id: unknown }[]>('SELECT id FROM user').catch(() => [])
  const lost = (Array.isArray(others) ? others : []).filter(
    (u) =>
      !keys.has(
        String(u.id)
          .replace(/^user:/, '')
          .replace(/[⟨⟩`]/g, ''),
      ),
  )
  if (lost.length > 0) {
    console.error(
      `seed: the database has ${lost.length} player(s) this seed does not include; nothing was dropped.\n` +
        'Use --add to put the seed next to them, or --force to drop everything.',
    )
    await closeDb()
    process.exit(1)
  }
}

console.log(`loading ${file}${add ? ' into the current database' : ''}`)
if (!add) await reset()
await migrate()

// Everything a seed player owns, so --add can replace an earlier copy of them.
const OWNED = [
  'title',
  'interest',
  'platinum',
  'dismissal',
  'tip',
  'message',
  'notification',
  'recommendation',
  'playtime',
  'auth_session',
]
if (add)
  for (const u of seed.user) {
    const id = rid('user', String(u.key))
    for (const table of OWNED) await q(`DELETE ${table} WHERE user = $id`, { id })
    await q('DELETE $id', { id })
  }
const exists = async (sql: string, vars: Row) => (await one(sql, vars)) !== undefined

for (const u of seed.user) {
  const { key, ...rest } = u as { key: string; psn_online_id: string } & Row
  const plan = rest.session_plan as Row | null | undefined
  await q('CREATE $id CONTENT $data', {
    id: rid('user', key),
    data: dropNulls({
      ...rest,
      psn_online_id_lower: rest.psn_online_id.toLowerCase(),
      ...(rest.last_seen_at ? { last_seen_at: dt(rest.last_seen_at) } : {}),
      ...(rest.goal_targets ? { goal_targets: movedTargets(rest.goal_targets) } : {}),
      ...(plan ? { session_plan: { ...plan, created_at: iso(plan.created_at) } } : {}),
    }),
  })
}
console.log(`user: ${seed.user.length}`)

for (const g of seed.game) {
  const { key, id: _igdb, ...rest } = g as { key: string; id: number }
  if (add && (await exists('SELECT id FROM $id', { id: gameId(key) }))) continue
  await q('CREATE $id CONTENT $data', {
    id: gameId(key),
    data: dropNulls({ ...rest, igdb_id: key.startsWith('psn_') ? null : Number(key) }),
  })
}
console.log(`game: ${seed.game.length}`)

// Tables with a unique game index keep the first row for a game (per user when
// the table is personal); two PSN names can resolve to the same catalog entry.
const UNIQUE_BY_GAME = new Set([
  'interest',
  'dismissal',
  'server_status',
  'guide',
  'recommendation',
  'playtime',
])
const insert = async (table: string, rows: Row[] = [], dates: string[] = []) => {
  const seen = new Set<string>()
  for (const row of rows) {
    if (UNIQUE_BY_GAME.has(table)) {
      const key = `${row.user ?? ''}/${row.game}`
      if (seen.has(key)) {
        console.log(`  skip duplicate ${table} for game:${row.game}`)
        continue
      }
      seen.add(key)
    }
    const data = link(row)
    // The instance's own guide and store prices win over the seed's copies.
    if (
      add &&
      table === 'guide' &&
      (await exists('SELECT id FROM guide WHERE game = $game', { game: data.game }))
    )
      continue
    if (
      add &&
      table === 'store_price' &&
      (await exists('SELECT id FROM store_price WHERE game = $game AND region = $region', {
        game: data.game,
        region: data.region,
      }))
    )
      continue
    for (const d of dates) data[d] = dt(data[d])
    if (table === 'interest' && typeof data.year === 'number') data.year = data.year + years
    if (Array.isArray(data.trophies))
      data.trophies = (data.trophies as Row[]).map((t) =>
        t.earned_at ? { ...t, earned_at: iso(t.earned_at) } : t,
      )
    await q(`CREATE ${table} CONTENT $data`, { data: dropNulls(data) })
  }
  console.log(`${table}: ${rows.length}`)
}
await insert('title', seed.title, ['created_at', 'last_updated_at', 'last_tip_at'])
await insert('guide', seed.guide, ['fetched_at', 'indexed_at'])
await insert('interest', seed.interest, ['created_at'])
await insert('platinum', seed.platinum, ['earned_at'])
await insert('dismissal', seed.dismissal, ['created_at'])
await insert('server_status', seed.server_status)
await insert('tip', seed.tip, ['created_at'])
await insert('message', seed.message, ['created_at'])
await insert('notification', seed.notification, ['created_at', 'read_at'])
await insert('recommendation', seed.recommendation, ['created_at'])
await insert('playtime', seed.playtime, ['first_played_at', 'last_played_at'])
await insert('store_price', seed.store_price, ['ends_at'])
await closeDb()
