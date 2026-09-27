-- One row per call to the model provider, with the tokens it used and what it
-- cost. Tagged with the user and the action that caused it (both optional:
-- shared work such as the catalog has no user).
DEFINE TABLE IF NOT EXISTS llm_call SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON llm_call TYPE option<record<user>>;
DEFINE FIELD IF NOT EXISTS action ON llm_call TYPE string;
DEFINE FIELD IF NOT EXISTS model ON llm_call TYPE string;
DEFINE FIELD IF NOT EXISTS input_tokens ON llm_call TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS cached_tokens ON llm_call TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS output_tokens ON llm_call TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS web_searches ON llm_call TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS cost_usd ON llm_call TYPE float DEFAULT 0;
DEFINE FIELD IF NOT EXISTS ms ON llm_call TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS created_at ON llm_call TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS llm_call_created ON llm_call FIELDS created_at;
