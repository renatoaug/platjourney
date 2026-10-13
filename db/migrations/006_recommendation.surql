-- Every recommendation batch of each user, kept a year (recommend.ts, SEEN_KEEP_DAYS): the latest batch is what Discover shows, the
-- older ones keep new batches from repeating games. The taste profile that produced them lives on the user.
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
-- When its batch was built, the same for every row of the batch. Rows from before batches were kept have none and are one batch.
DEFINE FIELD IF NOT EXISTS batch_at ON recommendation TYPE option<datetime>;
-- A game can come back in a later batch, so one user and game are no longer unique.
REMOVE INDEX IF EXISTS recommendation_user_game ON recommendation;
DEFINE INDEX IF NOT EXISTS recommendation_user_batch ON recommendation FIELDS user, batch_at;
