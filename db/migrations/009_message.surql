-- Chat transcript of each user (Telegram and web share one thread).
DEFINE TABLE IF NOT EXISTS message SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON message TYPE record<user>;
DEFINE FIELD IF NOT EXISTS role ON message TYPE string ASSERT $value IN ['user', 'assistant'];
DEFINE FIELD IF NOT EXISTS content ON message TYPE string;
DEFINE FIELD IF NOT EXISTS game ON message TYPE option<record<game>>;
-- What the answer shows besides its text, as it was when written: the game Nexo picked.
DEFINE FIELD IF NOT EXISTS card ON message TYPE option<object> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS created_at ON message TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS message_user_created ON message FIELDS user, created_at;
