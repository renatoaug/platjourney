function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var ${name}`)
  return value
}

export const config = {
  psnNpsso: required('PSN_NPSSO'),
  telegramToken: required('TELEGRAM_BOT_TOKEN'),
  pollMinutes: Number(process.env.POLL_MINUTES ?? 15),
  // A play session is considered over after this long without a new trophy.
  sessionIdleMinutes: Number(process.env.SESSION_IDLE_MINUTES ?? 60),
  port: Number(process.env.PORT ?? 3000),
  // Model work the app starts on its own, without a player asking. Both default on;
  // set to 0 so the instance only spends when a player uses Nexo, a plan or
  // recommendations.
  automatic: {
    // Researching a missing guide, finding pages for the deep guide and checking online
    // servers, all with web search. Off: guides come only from the database, and a game
    // without one is listed in guide_request.
    research: process.env.AI_RESEARCH !== '0',
    // Nexo's messages when a game starts, trophies unlock and a session ends. Off: a plain
    // notice without the model for the first two, nothing for the session end.
    notices: process.env.AI_NOTICES !== '0',
  },
  auth: {
    sessionDays: Number(process.env.SESSION_DAYS ?? 30),
    verificationMinutes: 30,
    // Send the session cookie only over HTTPS. Turn on anywhere but localhost.
    secureCookie: process.env.COOKIE_SECURE === '1',
    // Local development only: accept a PSN id without the "About me" code.
    skipVerification: process.env.AUTH_SKIP_VERIFICATION === '1',
  },
  // Where accounts are used from, to find one person behind many accounts. Off without
  // ACCESS_HASH_SECRET; only an HMAC of the IP address is stored. TRUST_PROXY=1 reads the address
  // from X-Forwarded-For, which only a reverse proxy in front of the instance may set.
  access: {
    secret: process.env.ACCESS_HASH_SECRET || null,
    trustProxy: process.env.TRUST_PROXY === '1',
    keepDays: Number(process.env.ACCESS_KEEP_DAYS ?? 180),
  },
  // The longest chat message passed to the model, on the web and on Telegram (the web app
  // stops typing at the same length).
  chat: { maxChars: 1000 },
  // The AI service (services/ai): every model call goes through it.
  ai: {
    url: process.env.AI_URL ?? 'http://127.0.0.1:8100',
    token: required('AI_TOKEN'),
  },
  surreal: {
    url: process.env.SURREAL_URL ?? 'http://localhost:8000/rpc',
    user: process.env.SURREAL_USER ?? 'root',
    pass: required('SURREAL_PASS'),
    namespace: process.env.SURREAL_NS ?? 'platjourney',
    database: process.env.SURREAL_DB ?? 'main',
  },
  igdb: {
    clientId: required('IGDB_CLIENT_ID'),
    clientSecret: required('IGDB_CLIENT_SECRET'),
  },
}
