-- Games the player wants to platinum, in manual order.
DEFINE TABLE IF NOT EXISTS interest SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON interest TYPE record<user>;
DEFINE FIELD IF NOT EXISTS game ON interest TYPE record<game>;
DEFINE FIELD IF NOT EXISTS year ON interest TYPE int;
DEFINE FIELD IF NOT EXISTS position ON interest TYPE int;
-- When Nexo recommended the game, if it did before the player saved it.
DEFINE FIELD IF NOT EXISTS recommended_at ON interest TYPE option<datetime>;
-- When "Nexo decide" last picked it as the next platinum; one interest of the player at a time.
DEFINE FIELD IF NOT EXISTS next_pick_at ON interest TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS created_at ON interest TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON interest TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS interest_user_game ON interest FIELDS user, game UNIQUE;
