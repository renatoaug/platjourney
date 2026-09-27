-- Latest recommendation batch of each user; the taste profile that produced it lives on the user.
DEFINE TABLE IF NOT EXISTS recommendation SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON recommendation TYPE record<user>;
DEFINE FIELD IF NOT EXISTS game ON recommendation TYPE record<game>;
DEFINE FIELD IF NOT EXISTS platform ON recommendation TYPE string;
DEFINE FIELD IF NOT EXISTS difficulty ON recommendation TYPE float;
DEFINE FIELD IF NOT EXISTS hours ON recommendation TYPE float;
DEFINE FIELD IF NOT EXISTS has_missables ON recommendation TYPE bool DEFAULT false;
DEFINE FIELD IF NOT EXISTS playthroughs ON recommendation TYPE option<int>;
DEFINE FIELD IF NOT EXISTS has_difficulty_trophy ON recommendation TYPE option<bool>;
DEFINE FIELD IF NOT EXISTS why ON recommendation TYPE string;
DEFINE FIELD IF NOT EXISTS similar_to ON recommendation TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS created_at ON recommendation TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS recommendation_user_game ON recommendation FIELDS user, game UNIQUE;
