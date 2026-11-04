-- Reviewed knowledge is independent of application builds. Imports never activate themselves.
DEFINE TABLE IF NOT EXISTS journey_model SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS game ON journey_model TYPE record<game> READONLY;
DEFINE FIELD IF NOT EXISTS edition ON journey_model TYPE string READONLY;
DEFINE FIELD IF NOT EXISTS version ON journey_model TYPE int ASSERT $value > 0 READONLY;
DEFINE FIELD IF NOT EXISTS checksum ON journey_model TYPE string READONLY;
DEFINE FIELD IF NOT EXISTS payload ON journey_model TYPE object FLEXIBLE READONLY;
DEFINE FIELD IF NOT EXISTS created_at ON journey_model TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS journey_model_version ON journey_model FIELDS game, edition, version UNIQUE;
