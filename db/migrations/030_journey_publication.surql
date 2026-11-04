-- Only the operator import tool writes this pointer. NULL explicitly disables reviewed knowledge.
DEFINE TABLE IF NOT EXISTS journey_publication SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS game ON journey_publication TYPE record<game>;
DEFINE FIELD IF NOT EXISTS edition ON journey_publication TYPE string;
DEFINE FIELD IF NOT EXISTS model ON journey_publication TYPE null | record<journey_model>;
DEFINE FIELD IF NOT EXISTS version ON journey_publication TYPE null | int;
DEFINE FIELD IF NOT EXISTS created_at ON journey_publication TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON journey_publication TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS journey_publication_edition ON journey_publication FIELDS game, edition UNIQUE;
