-- A game's color, read from its catalog picture: the pages tint their background and labels with it.
-- Kept apart from the game so reading it is not a change to the catalog row.
DEFINE TABLE IF NOT EXISTS game_tint SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS game ON game_tint TYPE record<game>;
DEFINE FIELD IF NOT EXISTS color ON game_tint TYPE string;
-- The picture it was read from: a new picture is read again.
DEFINE FIELD IF NOT EXISTS picture ON game_tint TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON game_tint TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON game_tint TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS game_tint_game ON game_tint FIELDS game UNIQUE;
