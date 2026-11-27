-- Platinum guide per game: the structured guide shown to the player, and when its
-- deep version (passages in guide_chunk) was indexed and against which trophy list,
-- so it can be refreshed when it gets old or the game receives new trophies.
DEFINE TABLE IF NOT EXISTS guide SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS game ON guide TYPE record<game>;
-- The guide in each language, the same structured object: guide_pt for pt-BR readers, guide_en for
-- English ones. Either can be the one researched first and the other its translation; a reader whose
-- language has none gets the other.
DEFINE FIELD IF NOT EXISTS guide_pt ON guide TYPE option<object> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS guide_en ON guide TYPE option<object> FLEXIBLE;
-- The language left behind when the other one changed (en or pt-BR), until it is translated again;
-- NONE when both say the same. Nothing is dropped.
DEFINE FIELD IF NOT EXISTS outdated ON guide TYPE option<string>;
DEFINE FIELD IF NOT EXISTS fetched_at ON guide TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS indexed_at ON guide TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS trophy_total ON guide TYPE option<int>;
DEFINE FIELD IF NOT EXISTS pages ON guide TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS passages ON guide TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS created_at ON guide TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON guide TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS guide_game ON guide FIELDS game UNIQUE;
-- Before guide_pt, the pt-BR guide was the field guide, and an event dropped guide_en whenever guide
-- changed. The event goes first: removing guide is a change, and it would drop every translation.
-- Then the guide is moved once, copied into guide_pt and removed; a run after that finds no guide
-- field and does nothing.
REMOVE EVENT IF EXISTS guide_en_stale ON guide;
UPDATE guide SET guide_pt = guide WHERE guide != NONE AND guide_pt = NONE;
UPDATE guide UNSET guide WHERE guide != NONE AND guide_pt != NONE;
REMOVE FIELD IF EXISTS guide ON guide;
