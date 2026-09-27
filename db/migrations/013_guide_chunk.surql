-- Passages of full guide, embedded, used only as retrieval context for Nexo.
-- The text is never shown as-is: answers are written by the model and cite the source.
DEFINE TABLE IF NOT EXISTS guide_chunk SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS game ON guide_chunk TYPE record<game>;
DEFINE FIELD IF NOT EXISTS source ON guide_chunk TYPE string;
DEFINE FIELD IF NOT EXISTS url ON guide_chunk TYPE string;
DEFINE FIELD IF NOT EXISTS heading ON guide_chunk TYPE string;
DEFINE FIELD IF NOT EXISTS content ON guide_chunk TYPE string;
DEFINE FIELD IF NOT EXISTS position ON guide_chunk TYPE int;
-- When the page was last updated (YYYY-MM-DD), when it says: between passages that disagree, the newer wins.
DEFINE FIELD IF NOT EXISTS page_updated_at ON guide_chunk TYPE option<string>;
DEFINE FIELD IF NOT EXISTS embedding ON guide_chunk TYPE array<float>;
DEFINE FIELD IF NOT EXISTS created_at ON guide_chunk TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS guide_chunk_game ON guide_chunk FIELDS game;
