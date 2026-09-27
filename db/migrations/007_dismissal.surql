-- Recommendations the player never wants to see again.
DEFINE TABLE IF NOT EXISTS dismissal SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON dismissal TYPE record<user>;
DEFINE FIELD IF NOT EXISTS game ON dismissal TYPE record<game>;
-- Why the player did not want it, when they said: the next recommendations steer away from it.
DEFINE FIELD IF NOT EXISTS reason ON dismissal TYPE option<string> ASSERT $value = NONE OR $value IN ['too_long', 'too_hard', 'genre', 'online', 'played'];
DEFINE FIELD IF NOT EXISTS created_at ON dismissal TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON dismissal TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS dismissal_user_game ON dismissal FIELDS user, game UNIQUE;
