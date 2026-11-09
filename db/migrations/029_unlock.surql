-- Every trophy a player earned, with its PSN unlock time: where long trophies usually close is
-- worked out from these (ADR-015). Personal data: deleted with the account.
DEFINE TABLE IF NOT EXISTS unlock SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON unlock TYPE record<user>;
DEFINE FIELD IF NOT EXISTS np_communication_id ON unlock TYPE string;
DEFINE FIELD IF NOT EXISTS trophy_id ON unlock TYPE int;
DEFINE FIELD IF NOT EXISTS earned_at ON unlock TYPE datetime;
DEFINE FIELD IF NOT EXISTS created_at ON unlock TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS unlock_user_np_trophy ON unlock FIELDS user, np_communication_id, trophy_id UNIQUE;
DEFINE INDEX IF NOT EXISTS unlock_np ON unlock FIELDS np_communication_id;
