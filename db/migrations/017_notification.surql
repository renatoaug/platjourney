-- What Nexo tells the player on its own (tips at the start, on unlocks, route tips, after a
-- session, server warnings), shown under the bell. The full text stays in tip.
DEFINE TABLE IF NOT EXISTS notification SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON notification TYPE record<user>;
-- 'deal': a game in the player's interests went on sale.
DEFINE FIELD IF NOT EXISTS kind ON notification TYPE string ASSERT $value IN ['start', 'unlock', 'session', 'server', 'route', 'deal'];
DEFINE FIELD IF NOT EXISTS content ON notification TYPE string;
DEFINE FIELD IF NOT EXISTS game ON notification TYPE option<record<game>>;
DEFINE FIELD IF NOT EXISTS tip ON notification TYPE option<record<tip>>;
DEFINE FIELD IF NOT EXISTS read_at ON notification TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS created_at ON notification TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON notification TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS notification_user_created ON notification FIELDS user, created_at;
DEFINE INDEX IF NOT EXISTS notification_user_game ON notification FIELDS user, game;
