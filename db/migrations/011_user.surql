-- People using PlatJourney. Identity is the PSN account; the password is what lets
-- its holder back in. Per-user state that is a single value lives here.
DEFINE TABLE IF NOT EXISTS user SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS psn_online_id ON user TYPE string;
DEFINE FIELD IF NOT EXISTS psn_online_id_lower ON user TYPE string;
DEFINE FIELD IF NOT EXISTS psn_account_id ON user TYPE string;
DEFINE FIELD IF NOT EXISTS password_hash ON user TYPE option<string>;
DEFINE FIELD IF NOT EXISTS avatar_url ON user TYPE option<string>;
DEFINE FIELD IF NOT EXISTS telegram_chat_id ON user TYPE option<string>;
DEFINE FIELD IF NOT EXISTS telegram_link_code ON user TYPE option<string>;
-- A link code works for a short while: a screenshot of the link is no lasting key to the account.
DEFINE FIELD IF NOT EXISTS telegram_link_expires_at ON user TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS goal_targets ON user TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD IF NOT EXISTS taste_profile ON user TYPE option<object> FLEXIBLE;
-- What the player changed in that profile (added and removed likes, genres and things to avoid) and
-- the rules every recommendation must follow; kept when the model writes the profile again.
DEFINE FIELD IF NOT EXISTS taste_prefs ON user TYPE option<object> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS session_plan ON user TYPE option<object> FLEXIBLE;
-- Show progress with DLC trophies counted in; off means the base game only (what the platinum needs).
DEFINE FIELD IF NOT EXISTS include_dlc_progress ON user TYPE bool DEFAULT false;
-- The player's PS Plus tier, as they say (PSN does not tell): deals count the games its catalog includes.
DEFINE FIELD IF NOT EXISTS ps_plus ON user TYPE option<string> ASSERT $value = NONE OR $value IN ['none', 'essential', 'extra', 'deluxe'];
-- Nexo writes this player's automatic notices (when the instance allows it); off, they are plain
-- templates that need no model.
DEFINE FIELD IF NOT EXISTS ai_notices ON user TYPE bool DEFAULT true;
-- The language the player picked for the web app, notices and Telegram; NONE until they pick one.
DEFINE FIELD IF NOT EXISTS locale ON user TYPE option<string> ASSERT $value = NONE OR $value IN ['pt-BR', 'en'];
-- The demo player (db/demo-seed.json): anyone can open it without a password, and it is read-only.
DEFINE FIELD IF NOT EXISTS demo ON user TYPE bool DEFAULT false;
-- When the last session-start notice went out: one every few hours, and no presence check before then.
DEFINE FIELD IF NOT EXISTS session_notice_at ON user TYPE option<datetime>;
-- When the player finished or skipped the first-visit introduction; NONE shows it.
DEFINE FIELD IF NOT EXISTS onboarded_at ON user TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS created_at ON user TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON user TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE FIELD IF NOT EXISTS last_seen_at ON user TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS user_online_id ON user FIELDS psn_online_id_lower UNIQUE;
DEFINE INDEX IF NOT EXISTS user_account ON user FIELDS psn_account_id UNIQUE;
-- A Telegram chat belongs to one account: linking it takes it off any other. NONE (not linked) repeats freely.
DEFINE INDEX IF NOT EXISTS user_telegram_chat ON user FIELDS telegram_chat_id UNIQUE;
