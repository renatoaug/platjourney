-- Online server status per game (for trophies that need online play). Shared by
-- every user; who was already warned is in notification.
DEFINE TABLE IF NOT EXISTS server_status SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS game ON server_status TYPE record<game>;
DEFINE FIELD IF NOT EXISTS status ON server_status TYPE string ASSERT $value IN ['active', 'announced', 'closed', 'unknown'];
DEFINE FIELD IF NOT EXISTS shutdown_at ON server_status TYPE option<string>;
DEFINE FIELD IF NOT EXISTS note ON server_status TYPE option<string>;
DEFINE FIELD IF NOT EXISTS created_at ON server_status TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON server_status TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS server_status_game ON server_status FIELDS game UNIQUE;
