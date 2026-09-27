-- Every platinum earned: the trophy's own unlock date and rarity.
DEFINE TABLE IF NOT EXISTS platinum SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON platinum TYPE record<user>;
DEFINE FIELD IF NOT EXISTS game ON platinum TYPE record<game>;
DEFINE FIELD IF NOT EXISTS np_communication_id ON platinum TYPE string;
DEFINE FIELD IF NOT EXISTS trophy_name ON platinum TYPE string;
DEFINE FIELD IF NOT EXISTS earned_at ON platinum TYPE datetime;
DEFINE FIELD IF NOT EXISTS rarity_rate ON platinum TYPE float;
DEFINE FIELD IF NOT EXISTS created_at ON platinum TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON platinum TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS platinum_user_np ON platinum FIELDS user, np_communication_id UNIQUE;
DEFINE INDEX IF NOT EXISTS platinum_game ON platinum FIELDS game;
