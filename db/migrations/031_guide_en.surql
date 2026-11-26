-- The guide in English, for players who use the app in English: the same object as `guide`, its
-- text translated and every trophy field kept with the pt-BR name the app matches trophies by.
-- A change to the guide leaves the translation out of date, so it is dropped in the same write and
-- the English reader gets the Portuguese guide until it is translated again.
DEFINE FIELD IF NOT EXISTS guide_en ON guide TYPE option<object> FLEXIBLE;
DEFINE EVENT OVERWRITE guide_en_stale ON guide
  WHEN $event = 'UPDATE' AND $before.guide != $after.guide AND $after.guide_en != NONE
  THEN (UPDATE $after.id SET guide_en = NONE);
