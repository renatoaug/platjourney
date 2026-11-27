-- The spots of a game's interactive map a player marked as collected: one row per player and game.
DEFINE TABLE IF NOT EXISTS map_collected SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON map_collected TYPE record<user>;
DEFINE FIELD IF NOT EXISTS game ON map_collected TYPE record<game>;
-- The spot ids of the game's map.json ("cards-12").
DEFINE FIELD IF NOT EXISTS spots ON map_collected TYPE array<string>;
DEFINE FIELD IF NOT EXISTS created_at ON map_collected TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON map_collected TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS map_collected_user_game ON map_collected FIELDS user, game UNIQUE;
