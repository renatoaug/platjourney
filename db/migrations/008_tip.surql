-- Everything Nexo sent proactively or answered.
DEFINE TABLE IF NOT EXISTS tip SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON tip TYPE record<user>;
-- 'deal': a game in the player's interests went on sale.
DEFINE FIELD OVERWRITE kind ON tip TYPE string ASSERT $value IN ['start', 'unlock', 'session', 'server', 'route', 'deal', 'chat'];
DEFINE FIELD IF NOT EXISTS content ON tip TYPE string;
DEFINE FIELD IF NOT EXISTS game ON tip TYPE option<record<game>>;
DEFINE FIELD IF NOT EXISTS created_at ON tip TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS tip_user_created ON tip FIELDS user, created_at;
