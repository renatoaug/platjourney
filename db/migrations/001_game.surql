-- Catalog: one record per game, keyed by IGDB id (game:3048) or, when IGDB has
-- no match, by the PSN communication id (game:psn_NPWR12514_00).
DEFINE TABLE IF NOT EXISTS game SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS name ON game TYPE string;
DEFINE FIELD IF NOT EXISTS slug ON game TYPE string;
DEFINE FIELD IF NOT EXISTS aliases ON game TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS platforms ON game TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS igdb_id ON game TYPE option<int>;
DEFINE FIELD IF NOT EXISTS np_communication_ids ON game TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS cover_url ON game TYPE option<string>;
-- A wide picture of the game (an IGDB screenshot, else artwork) for page headers.
DEFINE FIELD IF NOT EXISTS art_url ON game TYPE option<string>;
DEFINE FIELD IF NOT EXISTS genres ON game TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS themes ON game TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS modes ON game TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS summary ON game TYPE option<string>;
DEFINE FIELD IF NOT EXISTS release_year ON game TYPE option<int>;
-- The gallery and the "about" facts, from IGDB: scene image ids, studios, official site and first release day.
DEFINE FIELD IF NOT EXISTS screenshot_ids ON game TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS developers ON game TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS website ON game TYPE option<string>;
DEFINE FIELD IF NOT EXISTS released_at ON game TYPE option<datetime>;
-- How many people follow it on IGDB before release: the calendar lists the most awaited first.
DEFINE FIELD IF NOT EXISTS hypes ON game TYPE option<int>;
-- The game's PlayStation Store page, where its price is read.
DEFINE FIELD IF NOT EXISTS store_url ON game TYPE option<string>;
DEFINE FIELD IF NOT EXISTS rating ON game TYPE option<float>;
DEFINE FIELD IF NOT EXISTS embedding ON game TYPE option<array<float>>;
DEFINE FIELD IF NOT EXISTS created_at ON game TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON game TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS game_slug ON game FIELDS slug UNIQUE;
DEFINE INDEX IF NOT EXISTS game_igdb ON game FIELDS igdb_id UNIQUE;
DEFINE INDEX IF NOT EXISTS game_np_ids ON game FIELDS np_communication_ids;
