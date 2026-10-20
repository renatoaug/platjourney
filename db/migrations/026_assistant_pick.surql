-- Games an assistant connected through MCP suggested to the player (the save_suggestion tool),
-- shown on Discover under the assistant's name. One row a game: suggesting it again updates the
-- reason and the date. A suggestion is left out once the game is in the interests or dismissed,
-- and deleted after 30 days.
DEFINE TABLE IF NOT EXISTS assistant_pick SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON assistant_pick TYPE record<user>;
DEFINE FIELD IF NOT EXISTS game ON assistant_pick TYPE record<game>;
DEFINE FIELD IF NOT EXISTS reason ON assistant_pick TYPE string;
-- The assistant's name as the app shows it: 'Claude', 'ChatGPT'.
DEFINE FIELD IF NOT EXISTS assistant ON assistant_pick TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON assistant_pick TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON assistant_pick TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS assistant_pick_user_game ON assistant_pick FIELDS user, game UNIQUE;
