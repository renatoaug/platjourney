// Config refuses to load without its secrets; tests never use them, so any value will do.
for (const name of [
  'PSN_NPSSO',
  'TELEGRAM_BOT_TOKEN',
  'AI_TOKEN',
  'SURREAL_PASS',
  'IGDB_CLIENT_ID',
  'IGDB_CLIENT_SECRET',
])
  process.env[name] ??= 'test'

// Tests never reach a database. Bun loads the repository's .env, so without this a test that forgot
// a mock quietly reads the local SurrealDB and passes here, then fails in CI where there is none.
// A closed port makes it fail the same way everywhere.
process.env.SURREAL_URL = 'http://127.0.0.1:9/rpc'
