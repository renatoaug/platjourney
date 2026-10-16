-- A browser or installed app that receives notices as push (Web Push). One row per device: the
-- endpoint its push service gave and the keys that encrypt each message for it. A push service
-- that answers 404 or 410 has dropped the device, and its row goes.
DEFINE TABLE IF NOT EXISTS push_subscription SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON push_subscription TYPE record<user>;
DEFINE FIELD IF NOT EXISTS endpoint ON push_subscription TYPE string;
DEFINE FIELD IF NOT EXISTS p256dh ON push_subscription TYPE string;
DEFINE FIELD IF NOT EXISTS auth ON push_subscription TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON push_subscription TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON push_subscription TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS push_subscription_endpoint ON push_subscription FIELDS endpoint UNIQUE;
DEFINE INDEX IF NOT EXISTS push_subscription_user ON push_subscription FIELDS user;
