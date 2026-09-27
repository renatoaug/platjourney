-- Games the player wants to platinum, in manual order.
DEFINE TABLE IF NOT EXISTS interest SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON interest TYPE record<user>;
DEFINE FIELD IF NOT EXISTS game ON interest TYPE record<game>;
DEFINE FIELD IF NOT EXISTS year ON interest TYPE int;
DEFINE FIELD IF NOT EXISTS position ON interest TYPE int;
DEFINE FIELD IF NOT EXISTS created_at ON interest TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON interest TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS interest_user_game ON interest FIELDS user, game UNIQUE;
