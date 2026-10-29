import { readdirSync, readFileSync } from 'node:fs'
import { RecordId, Surreal } from 'surrealdb'
import { config } from './config.ts'

// One shared connection. Root auth is fine for a single-tenant local app.
// Concurrent callers during startup share the same in-flight connect.
let client: Surreal | null = null
let connecting: Promise<Surreal> | null = null

export function db(): Promise<Surreal> {
  if (client) return Promise.resolve(client)
  if (!connecting) connecting = connect().finally(() => (connecting = null))
  return connecting
}

async function connect(): Promise<Surreal> {
  const s = new Surreal()
  await s.connect(config.surreal.url, {
    // A function is re-invoked by the SDK when the session token expires (~1h);
    // a static object would leave us with "The token has expired" after that.
    authentication: () => ({ username: config.surreal.user, password: config.surreal.pass }),
  })
  await s.query(
    `DEFINE NAMESPACE IF NOT EXISTS ${config.surreal.namespace};
     USE NS ${config.surreal.namespace};
     DEFINE DATABASE IF NOT EXISTS ${config.surreal.database};`,
  )
  await s.use({ namespace: config.surreal.namespace, database: config.surreal.database })
  client = s
  return s
}

export async function closeDb(): Promise<void> {
  await client?.close()
  client = null
}

// Applies db/migrations/*.surql in order. Every statement is IF NOT EXISTS, so
// re-running is safe; there is no version table on purpose.
export async function migrate(): Promise<string[]> {
  const dir = new URL('../../../db/migrations/', import.meta.url)
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.surql'))
    .sort()
  const s = await db()
  for (const file of files) await s.query(readFileSync(new URL(file, dir), 'utf8'))
  return files
}

// Drops the whole database so the seed can rebuild it from scratch.
export async function reset(): Promise<void> {
  const s = await db()
  await s.query(`REMOVE DATABASE IF EXISTS ${config.surreal.database};`)
  await s.query(`DEFINE DATABASE IF NOT EXISTS ${config.surreal.database};`)
  await s.use({ namespace: config.surreal.namespace, database: config.surreal.database })
}

// Runs a query and returns the result of its last statement. If the session died
// anyway (expired token, restarted database), reconnect once and retry.
export async function q<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
  try {
    const s = await db()
    const results = await s.query<unknown[]>(sql, vars)
    return results[results.length - 1] as T
  } catch (e) {
    const msg = (e as Error).message ?? ''
    // Two writes on the same record at once: the database asks for a retry.
    if (/can be retried/i.test(msg)) {
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 150))
      const results = await (await db()).query<unknown[]>(sql, vars)
      return results[results.length - 1] as T
    }
    if (!/token has expired|connection|not connected|closed/i.test(msg)) throw e
    console.warn('surreal session lost, reconnecting:', msg.slice(0, 80))
    await closeDb().catch(() => {})
    const s = await db()
    const results = await s.query<unknown[]>(sql, vars)
    return results[results.length - 1] as T
  }
}

export async function one<T = unknown>(
  sql: string,
  vars?: Record<string, unknown>,
): Promise<T | undefined> {
  const rows = await q<T[]>(sql, vars)
  return Array.isArray(rows) ? rows[0] : (rows as T | undefined)
}

// Ids are plain strings in the app ("game:19561"); numeric parts become numbers
// so they match the records the seed created.
const idPart = (id: string | number) =>
  typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id
export const rid = (table: string, id: string | number) => new RecordId(table, idPart(id))
// Takes "3048" or "game:3048": a game's id as the API passes it keeps one table name, not two.
export const gameId = (id: string | number) =>
  new RecordId('game', idPart(typeof id === 'string' ? id.replace(/^game:/, '') : id))

// Record ids come back as RecordId objects; the API and logs want "game:3048".
export function plain<T>(value: T): T {
  if (value === undefined || value === null) return value
  return JSON.parse(
    JSON.stringify(value, (_k, v) => {
      // RecordId.toJSON already ran here and wraps numeric ids in ⟨⟩.
      if (typeof v === 'string' && /^[a-z_]+:⟨[^⟩]+⟩$/.test(v)) return v.replace(/[⟨⟩]/g, '')
      if (typeof v === 'bigint') return Number(v)
      return v
    }),
  ) as T
}

// Objects are stored with snake_case keys and used in TypeScript with camelCase ones (AGENTS.md,
// Database). These rename the keys of plain objects at any depth; values, record ids and dates
// pass through untouched.
const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype
function renameKeys(value: unknown, rename: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((v) => renameKeys(v, rename))
  if (!isPlain(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [rename(k), renameKeys(v, rename)]),
  )
}
export const snakeKeys = <T>(value: T): T =>
  renameKeys(value, (k) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)) as T
export const camelKeys = <T>(value: T): T =>
  renameKeys(value, (k) => k.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase())) as T

export { RecordId }
