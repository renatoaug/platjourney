-- Hours played per game, summed across its PS4/PS5 copies (from PSN's played-game list).
DEFINE TABLE IF NOT EXISTS playtime SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON playtime TYPE record<user>;
DEFINE FIELD IF NOT EXISTS game ON playtime TYPE record<game>;
DEFINE FIELD IF NOT EXISTS seconds ON playtime TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS play_count ON playtime TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS first_played_at ON playtime TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS last_played_at ON playtime TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS created_at ON playtime TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON playtime TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS playtime_user_game ON playtime FIELDS user, game UNIQUE;
