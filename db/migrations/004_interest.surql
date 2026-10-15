-- Games the player wants to platinum, in manual order.
DEFINE TABLE IF NOT EXISTS interest SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON interest TYPE record<user>;
DEFINE FIELD IF NOT EXISTS game ON interest TYPE record<game>;
DEFINE FIELD IF NOT EXISTS year ON interest TYPE int;
DEFINE FIELD IF NOT EXISTS position ON interest TYPE int;
-- When Nexo recommended the game, if it did before the player saved it.
DEFINE FIELD IF NOT EXISTS recommended_at ON interest TYPE option<datetime>;
-- Where the player saved it from: releases (the home's calendar), recommendations (Nexo's picks),
-- similar (the lists of similar games), title (a game's page), search (the add panel on Interests).
-- NONE for older saves and for Telegram's /goals add.
DEFINE FIELD IF NOT EXISTS source ON interest TYPE option<string> ASSERT $value = NONE OR $value IN ['releases', 'recommendations', 'similar', 'title', 'search'];
-- When "Nexo decide" last picked it as the next platinum; one interest of the player at a time.
DEFINE FIELD IF NOT EXISTS next_pick_at ON interest TYPE option<datetime>;
-- When the player said they already have it ("Já tenho"): bought or claimed but never started, so it
-- is not in their PSN trophy list yet. It stops showing as a deal and in deal notices.
DEFINE FIELD IF NOT EXISTS owned_at ON interest TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS created_at ON interest TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON interest TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS interest_user_game ON interest FIELDS user, game UNIQUE;
