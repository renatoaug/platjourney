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
