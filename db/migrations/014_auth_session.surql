-- Browser sessions. Only the SHA-256 of the cookie token is stored.
DEFINE TABLE IF NOT EXISTS auth_session SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON auth_session TYPE record<user>;
DEFINE FIELD IF NOT EXISTS token_hash ON auth_session TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON auth_session TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS expires_at ON auth_session TYPE datetime;
DEFINE INDEX IF NOT EXISTS auth_session_token ON auth_session FIELDS token_hash UNIQUE;
