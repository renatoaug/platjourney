-- Games a player searched for and the catalog did not have, when IGDB did not know the name
-- either: for whoever runs the instance to add by hand. One row per name, as normalized for
-- search; each account counts once, however many times it asks.
DEFINE TABLE IF NOT EXISTS game_request SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS key ON game_request TYPE string;
DEFINE FIELD IF NOT EXISTS name ON game_request TYPE string;
DEFINE FIELD IF NOT EXISTS users ON game_request TYPE array<record<user>> DEFAULT [];
DEFINE FIELD IF NOT EXISTS requests ON game_request TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS created_at ON game_request TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON game_request TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS game_request_key ON game_request FIELDS key UNIQUE;
