-- What the PlayStation Store asks for a game in a region, read once a day for the games someone saved
-- in their interests (deals.ts). One row per game and region, overwritten at each read; prices in
-- cents. Only Brazil (BR) is read today.
DEFINE TABLE IF NOT EXISTS store_price SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS game ON store_price TYPE record<game>;
-- The store's country, upper case (BR, US).
DEFINE FIELD IF NOT EXISTS region ON store_price TYPE string DEFAULT 'BR';
DEFINE FIELD IF NOT EXISTS base ON store_price TYPE int;
DEFINE FIELD IF NOT EXISTS price ON store_price TYPE int;
DEFINE FIELD IF NOT EXISTS discount ON store_price TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS ends_at ON store_price TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS plus ON store_price TYPE bool DEFAULT false;
-- What PS Plus members pay when the store gives them a lower price.
DEFINE FIELD IF NOT EXISTS plus_price ON store_price TYPE option<int>;
-- The PS Plus tier whose catalog includes it: essential, extra or deluxe.
DEFINE FIELD IF NOT EXISTS plus_tier ON store_price TYPE option<string>;
DEFINE FIELD IF NOT EXISTS currency ON store_price TYPE string DEFAULT 'BRL';
DEFINE FIELD IF NOT EXISTS created_at ON store_price TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON store_price TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS store_price_game_region ON store_price FIELDS game, region UNIQUE;
