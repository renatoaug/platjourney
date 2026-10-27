-- Every session plan a player made, one row each. The one on screen is the player's latest that is
-- active or expired; the others stay, so the operator can read how plans end.
DEFINE TABLE IF NOT EXISTS session_plan SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON session_plan TYPE record<user>;
DEFINE FIELD IF NOT EXISTS game ON session_plan TYPE record<game>;
DEFINE FIELD IF NOT EXISTS game_name ON session_plan TYPE string;
-- The PSN trophy list the steps' trophy ids belong to: an expired plan's steps are checked against
-- the player's earned trophies on it.
DEFINE FIELD IF NOT EXISTS np_communication_id ON session_plan TYPE option<string>;
DEFINE FIELD IF NOT EXISTS minutes ON session_plan TYPE number;
DEFINE FIELD IF NOT EXISTS summary ON session_plan TYPE string;
-- In order: trophy, trophy_id, minutes, how, why, trick, flexible, and done (earned by the time the
-- plan ended; false while it is active).
-- The items first: defining the array first locks their shape, and the items' definition would then
-- already exist.
DEFINE FIELD IF NOT EXISTS steps.* ON session_plan TYPE object FLEXIBLE;
DEFINE FIELD IF NOT EXISTS steps ON session_plan TYPE array<object> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS total_minutes ON session_plan TYPE number DEFAULT 0;
DEFINE FIELD IF NOT EXISTS warnings ON session_plan TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS if_time_left ON session_plan TYPE option<string>;
-- An assistant connected through MCP made it (save_session_plan): which one.
DEFINE FIELD IF NOT EXISTS assistant ON session_plan TYPE option<string>;
-- active: on screen. ended: the player ended the session before its time was up. dismissed: the
-- player closed it once it was over. replaced: a new plan took its place. expired: its time ran out
-- with no action (it still shows as a recap until the next day).
DEFINE FIELD IF NOT EXISTS status ON session_plan TYPE string DEFAULT 'active' ASSERT $value IN ['active', 'ended', 'dismissed', 'replaced', 'expired'];
-- Why the player closed it, when they said (asked only when no step was done).
DEFINE FIELD IF NOT EXISTS reason ON session_plan TYPE option<string> ASSERT $value = NONE OR $value IN ['not_useful', 'too_long', 'other_game', 'no_time'];
DEFINE FIELD IF NOT EXISTS created_at ON session_plan TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS ended_at ON session_plan TYPE option<datetime>;
DEFINE INDEX IF NOT EXISTS session_plan_user ON session_plan FIELDS user, status;
DEFINE INDEX IF NOT EXISTS session_plan_status ON session_plan FIELDS status;

-- Plans kept on the player before this table: moved here as active (the hourly check expires the
-- old ones), then the player's field goes. A database that never had the field moves nothing. One
-- transaction: the field is cleared and removed only if every plan was copied. A plan stored a
-- missing value as NULL, which option<...> fields refuse: `?? NONE` turns it into a missing one.
BEGIN TRANSACTION;
LET $kept = SELECT id, session_plan FROM user WHERE session_plan != NONE;
FOR $u IN $kept {
    CREATE session_plan CONTENT {
        user: $u.id,
        game: type::record($u.session_plan.game),
        game_name: $u.session_plan.game_name,
        minutes: $u.session_plan.minutes,
        summary: $u.session_plan.summary ?? '',
        steps: $u.session_plan.steps ?? [],
        total_minutes: $u.session_plan.total_minutes ?? 0,
        warnings: $u.session_plan.warnings ?? [],
        if_time_left: $u.session_plan.if_time_left ?? NONE,
        assistant: $u.session_plan.assistant ?? NONE,
        created_at: <datetime> $u.session_plan.created_at,
    };
};
UPDATE user SET session_plan = NONE WHERE session_plan != NONE;
REMOVE FIELD IF EXISTS session_plan ON user;
COMMIT TRANSACTION;
