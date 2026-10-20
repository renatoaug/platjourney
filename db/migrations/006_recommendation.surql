-- Every recommendation batch of each user, kept a year (recommend.ts, SEEN_KEEP_DAYS): the latest batch is what Discover shows, the
-- older ones keep new batches from repeating games. The taste profile that produced them lives on the user.
DEFINE TABLE IF NOT EXISTS recommendation SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON recommendation TYPE record<user>;
DEFINE FIELD IF NOT EXISTS game ON recommendation TYPE record<game>;
-- Optional: a pick can be a game with no guide yet, whose numbers are unknown.
DEFINE FIELD OVERWRITE platform ON recommendation TYPE option<string>;
DEFINE FIELD OVERWRITE difficulty ON recommendation TYPE option<float>;
DEFINE FIELD OVERWRITE hours ON recommendation TYPE option<float>;
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
-- The picks the player asks Nexo for (Discover's "O que jogar agora?" and /pick on Telegram) are kept with the
-- Discover batches, told apart by `source`: rows from before it have none and are Discover's. A pick names one
-- game, why, where to start, and what the player asked: their mood, where to look and whether a game fit it.
DEFINE FIELD IF NOT EXISTS source ON recommendation TYPE option<string> ASSERT $value = NONE OR $value IN ['discover', 'pick'];
DEFINE FIELD IF NOT EXISTS first_step ON recommendation TYPE option<string>;
DEFINE FIELD IF NOT EXISTS mood ON recommendation TYPE option<string>;
-- Where Nexo looked: the player's interests, or any game in the catalog.
DEFINE FIELD IF NOT EXISTS scope ON recommendation TYPE option<string> ASSERT $value = NONE OR $value IN ['interests', 'any'];
DEFINE FIELD IF NOT EXISTS owned_only ON recommendation TYPE option<bool>;
-- False when nothing in the list matched the mood and Nexo chose the closest.
DEFINE FIELD IF NOT EXISTS fits ON recommendation TYPE option<bool>;
DEFINE INDEX IF NOT EXISTS recommendation_user_created ON recommendation FIELDS user, created_at;
-- Who recommended it: Nexo, or an assistant connected through MCP (a pick it saved with save_suggestion); 'other' is
-- an assistant the app does not know by name.
DEFINE FIELD IF NOT EXISTS recommender ON recommendation TYPE 'nexo' | 'claude' | 'chatgpt' | 'other' DEFAULT 'nexo';
