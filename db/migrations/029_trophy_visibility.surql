-- A per-account display preference. Absent means hidden; existing users are not rewritten.
DEFINE FIELD IF NOT EXISTS revealed_trophy_games ON user TYPE option<array<string>>;
