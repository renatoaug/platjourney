-- What the guides still miss, per game, for whoever runs the instance to add next:
-- - users: the players who opened the game while it had no guide and the instance does not
--   research guides on its own (AI_RESEARCH=0); requests is how many they are. The game
--   leaves that list once its guide exists.
-- - questions: what players asked Nexo that the guide passages had nothing on (more likely
--   without web search, AI_WEB_SEARCH=0).
DEFINE TABLE IF NOT EXISTS guide_request SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS game ON guide_request TYPE record<game>;
DEFINE FIELD IF NOT EXISTS users ON guide_request TYPE array<record<user>> DEFAULT [];
DEFINE FIELD IF NOT EXISTS requests ON guide_request TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS questions ON guide_request TYPE array<object> DEFAULT [];
DEFINE FIELD IF NOT EXISTS questions[*].question ON guide_request TYPE string;
DEFINE FIELD IF NOT EXISTS questions[*].asked_at ON guide_request TYPE datetime;
DEFINE FIELD IF NOT EXISTS created_at ON guide_request TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON guide_request TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS guide_request_game ON guide_request FIELDS game UNIQUE;
