-- Platinum guide per game: the structured guide shown to the player, and when its
-- deep version (passages in guide_chunk) was indexed and against which trophy list,
-- so it can be refreshed when it gets old or the game receives new trophies.
DEFINE TABLE IF NOT EXISTS guide SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS game ON guide TYPE record<game>;
DEFINE FIELD IF NOT EXISTS guide ON guide TYPE option<object> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS fetched_at ON guide TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS indexed_at ON guide TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS trophy_total ON guide TYPE option<int>;
DEFINE FIELD IF NOT EXISTS pages ON guide TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS passages ON guide TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS created_at ON guide TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON guide TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS guide_game ON guide FIELDS game UNIQUE;
