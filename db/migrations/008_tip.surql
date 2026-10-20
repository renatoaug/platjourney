-- Everything Nexo sent proactively or answered, and the tips connected assistants saved.
DEFINE TABLE IF NOT EXISTS tip SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON tip TYPE record<user>;
-- 'deal': a game in the player's interests went on sale. 'assistant': a tip an assistant connected
-- through MCP saved (the save_tip tool); `assistant` says which ('other' is one the app does not know
-- by name).
DEFINE FIELD OVERWRITE kind ON tip TYPE string ASSERT $value IN ['start', 'unlock', 'session', 'server', 'route', 'deal', 'chat', 'assistant'];
DEFINE FIELD IF NOT EXISTS content ON tip TYPE string;
DEFINE FIELD IF NOT EXISTS game ON tip TYPE option<record<game>>;
DEFINE FIELD IF NOT EXISTS assistant ON tip TYPE option<'claude' | 'chatgpt' | 'other'>;
DEFINE FIELD IF NOT EXISTS created_at ON tip TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS tip_user_created ON tip FIELDS user, created_at;
