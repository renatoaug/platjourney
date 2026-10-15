-- Graph edges between catalog games, from IGDB, written by `bun run catalog:similar` and read by the
-- recommendations by similarity (similar.ts). Each run deletes a game's outgoing edges and writes
-- them again, so rows are only created and deleted.

-- game -> similar_to -> game: IGDB's "similar games" of a game, kept only when both are in the
-- catalog. `rank` is the position in IGDB's list (0 is the most similar).
DEFINE TABLE IF NOT EXISTS similar_to TYPE RELATION IN game OUT game SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS rank ON similar_to TYPE int;
DEFINE FIELD IF NOT EXISTS created_at ON similar_to TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS similar_to_pair ON similar_to FIELDS in, out UNIQUE;

-- expansion -> expansion_of -> base game: a standalone expansion or episode (IGDB's parent_game),
-- such as Uncharted: The Lost Legacy -> Uncharted 4.
DEFINE TABLE IF NOT EXISTS expansion_of TYPE RELATION IN game OUT game SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS created_at ON expansion_of TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS expansion_of_pair ON expansion_of FIELDS in, out UNIQUE;
