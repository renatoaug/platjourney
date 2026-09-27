-- Pending proofs of ownership: the code a person must place in their PSN "About me"
-- to take over an account that already exists (lost password, or someone else got there first).
DEFINE TABLE IF NOT EXISTS verification SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS psn_online_id_lower ON verification TYPE string;
DEFINE FIELD IF NOT EXISTS psn_online_id ON verification TYPE string;
DEFINE FIELD IF NOT EXISTS psn_account_id ON verification TYPE string;
DEFINE FIELD IF NOT EXISTS avatar_url ON verification TYPE option<string>;
DEFINE FIELD IF NOT EXISTS code ON verification TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON verification TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON verification TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE FIELD IF NOT EXISTS expires_at ON verification TYPE datetime;
DEFINE INDEX IF NOT EXISTS verification_online_id ON verification FIELDS psn_online_id_lower UNIQUE;
