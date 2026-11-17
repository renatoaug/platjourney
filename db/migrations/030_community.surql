-- The community: who follows whom, reactions on feed events, medals earned and every trophy's
-- rarity. The feed itself is read from what is already stored (unlock, platinum, user goals): no
-- event is written twice. A player who turns `community_visible` off leaves the feed and the
-- rankings; follows, reactions and medals are personal data, deleted with the account.

DEFINE FIELD IF NOT EXISTS community_visible ON user TYPE bool DEFAULT true;

-- One row per player and player they follow.
DEFINE TABLE IF NOT EXISTS follow SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON follow TYPE record<user>;
DEFINE FIELD IF NOT EXISTS target ON follow TYPE record<user>;
DEFINE FIELD IF NOT EXISTS created_at ON follow TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS follow_user_target ON follow FIELDS user, target UNIQUE;
DEFINE INDEX IF NOT EXISTS follow_target ON follow FIELDS target;

-- One row per player, feed event and kind of reaction. `event` is the event's stable key
-- (`plat:<user>:<np>`, `rare:<user>:<np>:<trophy>`, `start:<user>:<np>`, `medal:<user>:<kind>`).
DEFINE TABLE IF NOT EXISTS reaction SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON reaction TYPE record<user>;
DEFINE FIELD IF NOT EXISTS event ON reaction TYPE string ASSERT string::len($value) > 0 AND string::len($value) <= 200;
DEFINE FIELD IF NOT EXISTS kind ON reaction TYPE string ASSERT $value IN ['gg', 'fire', 'skull'];
DEFINE FIELD IF NOT EXISTS created_at ON reaction TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS reaction_user_event_kind ON reaction FIELDS user, event, kind UNIQUE;
DEFINE INDEX IF NOT EXISTS reaction_event ON reaction FIELDS event;

-- One row per player and medal, written the first time the server finds it earned.
DEFINE TABLE IF NOT EXISTS medal SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON medal TYPE record<user>;
DEFINE FIELD IF NOT EXISTS kind ON medal TYPE string ASSERT $value IN ['rare_hunter', 'quick_platinum', 'no_day_off', 'year_goal'];
DEFINE FIELD IF NOT EXISTS earned_at ON medal TYPE datetime;
DEFINE FIELD IF NOT EXISTS created_at ON medal TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS medal_user_kind ON medal FIELDS user, kind UNIQUE;

-- Every trophy's share of players on PSN, from the last list a player who owns the game opened
-- (a catalog list has no rates). Shared by everyone, not personal.
DEFINE TABLE IF NOT EXISTS trophy_rarity SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS np_communication_id ON trophy_rarity TYPE string;
DEFINE FIELD IF NOT EXISTS trophy_id ON trophy_rarity TYPE int;
DEFINE FIELD IF NOT EXISTS type ON trophy_rarity TYPE string;
DEFINE FIELD IF NOT EXISTS name ON trophy_rarity TYPE string;
DEFINE FIELD IF NOT EXISTS name_en ON trophy_rarity TYPE string;
DEFINE FIELD IF NOT EXISTS earned_rate ON trophy_rarity TYPE number;
DEFINE FIELD IF NOT EXISTS created_at ON trophy_rarity TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON trophy_rarity TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS trophy_rarity_np_trophy ON trophy_rarity FIELDS np_communication_id, trophy_id UNIQUE;
