-- Requests written before `users` existed have none, and the table is SCHEMAFULL: any later update
-- to the row (a player asking for the guide, a question Nexo could not answer) failed on it. They
-- get an empty list; who asked before was never kept.
UPDATE guide_request SET users = [] WHERE users = NONE;
