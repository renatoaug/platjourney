-- One PSN trophy list (a title) per platform release of a game, with one
-- player's last known progress. Unique per user and np_communication_id.
DEFINE TABLE IF NOT EXISTS title SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON title TYPE record<user>;
DEFINE FIELD IF NOT EXISTS game ON title TYPE record<game>;
DEFINE FIELD IF NOT EXISTS np_communication_id ON title TYPE string;
DEFINE FIELD IF NOT EXISTS name ON title TYPE string;
DEFINE FIELD IF NOT EXISTS platform ON title TYPE string;
DEFINE FIELD IF NOT EXISTS icon_url ON title TYPE string;
DEFINE FIELD IF NOT EXISTS progress ON title TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS earned ON title TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS total ON title TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS earned_ids ON title TYPE array<int> DEFAULT [];
DEFINE FIELD IF NOT EXISTS groups ON title TYPE option<object> FLEXIBLE;
-- The full trophy list with the player's unlocks, kept only for the demo player, who has no PSN account to read it from.
DEFINE FIELD IF NOT EXISTS trophies ON title TYPE option<array<object>> FLEXIBLE;
-- Each trophy keeps whatever PSN sends with it; SurrealDB 3 would otherwise lock the items' shape.
DEFINE FIELD IF NOT EXISTS trophies.* ON title TYPE object FLEXIBLE;
DEFINE FIELD IF NOT EXISTS last_updated_at ON title TYPE datetime;
DEFINE FIELD IF NOT EXISTS last_tip_at ON title TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS created_at ON title TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON title TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS title_user_np ON title FIELDS user, np_communication_id UNIQUE;
DEFINE INDEX IF NOT EXISTS title_game ON title FIELDS game;
