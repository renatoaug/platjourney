-- APNs devices are bound to the authenticated session that registered them.
DEFINE TABLE IF NOT EXISTS native_push_subscription SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON native_push_subscription TYPE record<user>;
DEFINE FIELD IF NOT EXISTS installation ON native_push_subscription TYPE string;
DEFINE FIELD IF NOT EXISTS token ON native_push_subscription TYPE string;
DEFINE FIELD IF NOT EXISTS environment ON native_push_subscription TYPE string ASSERT $value IN ['sandbox', 'production'];
DEFINE FIELD IF NOT EXISTS session_hash ON native_push_subscription TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON native_push_subscription TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON native_push_subscription TYPE datetime VALUE time::now();
DEFINE INDEX IF NOT EXISTS native_push_installation ON native_push_subscription FIELDS installation UNIQUE;
DEFINE INDEX IF NOT EXISTS native_push_token ON native_push_subscription FIELDS token, environment UNIQUE;
DEFINE INDEX IF NOT EXISTS native_push_user ON native_push_subscription FIELDS user;
