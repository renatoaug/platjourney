-- Assistants connected through MCP (Claude, ChatGPT…). Each registers itself (dynamic client
-- registration), the player allows it once, and it then holds an access token and a refresh token.
-- Only the SHA-256 of codes and tokens is stored.
DEFINE TABLE IF NOT EXISTS oauth_client SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS client_id ON oauth_client TYPE string;
DEFINE FIELD IF NOT EXISTS name ON oauth_client TYPE string;
DEFINE FIELD IF NOT EXISTS redirect_uris ON oauth_client TYPE array<string>;
DEFINE FIELD IF NOT EXISTS created_at ON oauth_client TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS oauth_client_id ON oauth_client FIELDS client_id UNIQUE;

-- The one-time code the player's "Allow" hands to the assistant, bound to its PKCE challenge.
DEFINE TABLE IF NOT EXISTS oauth_code SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS code_hash ON oauth_code TYPE string;
DEFINE FIELD IF NOT EXISTS client ON oauth_code TYPE record<oauth_client>;
DEFINE FIELD IF NOT EXISTS user ON oauth_code TYPE record<user>;
DEFINE FIELD IF NOT EXISTS redirect_uri ON oauth_code TYPE string;
DEFINE FIELD IF NOT EXISTS challenge ON oauth_code TYPE string;
DEFINE FIELD IF NOT EXISTS expires_at ON oauth_code TYPE datetime;
DEFINE INDEX IF NOT EXISTS oauth_code_hash ON oauth_code FIELDS code_hash UNIQUE;

-- One connection: a player and an assistant. The refresh token changes on every use; disconnecting
-- deletes the row, which ends both tokens.
DEFINE TABLE IF NOT EXISTS oauth_token SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS client ON oauth_token TYPE record<oauth_client>;
DEFINE FIELD IF NOT EXISTS user ON oauth_token TYPE record<user>;
DEFINE FIELD IF NOT EXISTS access_hash ON oauth_token TYPE string;
DEFINE FIELD IF NOT EXISTS access_expires_at ON oauth_token TYPE datetime;
DEFINE FIELD IF NOT EXISTS refresh_hash ON oauth_token TYPE string;
DEFINE FIELD IF NOT EXISTS refresh_expires_at ON oauth_token TYPE datetime;
DEFINE FIELD IF NOT EXISTS used_at ON oauth_token TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS created_at ON oauth_token TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS oauth_token_access ON oauth_token FIELDS access_hash UNIQUE;
DEFINE INDEX IF NOT EXISTS oauth_token_refresh ON oauth_token FIELDS refresh_hash UNIQUE;
DEFINE INDEX IF NOT EXISTS oauth_token_user ON oauth_token FIELDS user;
