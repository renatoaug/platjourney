-- Where each account is used from, to find one person behind many accounts. Only a keyed hash of
-- the IP address is stored (ACCESS_HASH_SECRET), never the address; rows unused for 180 days are
-- deleted, and every row of an account goes with it.
DEFINE TABLE IF NOT EXISTS access SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON access TYPE record<user>;
DEFINE FIELD IF NOT EXISTS ip_hash ON access TYPE string;
DEFINE FIELD IF NOT EXISTS count ON access TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS created_at ON access TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON access TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS access_user_ip ON access FIELDS user, ip_hash UNIQUE;
DEFINE INDEX IF NOT EXISTS access_ip ON access FIELDS ip_hash;
