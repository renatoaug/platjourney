-- Games already shown to a player as recommendations, so a new batch brings games not shown yet; they come back only when those run out
-- (recommend.ts, SEEN_KEEP_DAYS). Written once per pick and deleted when old.
DEFINE TABLE IF NOT EXISTS recommendation_seen SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON recommendation_seen TYPE record<user>;
DEFINE FIELD IF NOT EXISTS game ON recommendation_seen TYPE record<game>;
DEFINE FIELD IF NOT EXISTS created_at ON recommendation_seen TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS recommendation_seen_user ON recommendation_seen FIELDS user, created_at;
