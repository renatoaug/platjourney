-- What players do in the app that leaves nothing else behind: the screens they open, the sections
-- of a page they expand and what they search for. Kept 180 days; the account's rows go with it.
DEFINE TABLE IF NOT EXISTS event SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON event TYPE record<user>;
-- screen (a route opened), open (a section expanded) or search (words typed in a search).
DEFINE FIELD IF NOT EXISTS name ON event TYPE string ASSERT $value IN ['screen', 'open', 'search'];
-- The screen's path, the section's name or the words searched.
DEFINE FIELD IF NOT EXISTS target ON event TYPE string;
-- The screen it happened on.
DEFINE FIELD IF NOT EXISTS path ON event TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON event TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS event_user ON event FIELDS user, created_at;
DEFINE INDEX IF NOT EXISTS event_created ON event FIELDS created_at;
