-- The app's accent color the player picked in Settings (shared/accent.ts); none means lime.
DEFINE FIELD IF NOT EXISTS accent ON user TYPE option<string> ASSERT $value = NONE OR $value IN ['lime', 'cyan', 'cobalt', 'violet', 'magenta', 'amber'];
