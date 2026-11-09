# ADR-015: Where a long trophy closes, worked out from players' unlock times

- **Status**: Proposed
- **Date**: 2026-11-09
- **Related**: [ADR-013](ADR-013-journey-from-guide.md), [ADR-014](ADR-014-trophy-dependencies.md), [Trophy journey](../design/13-journey.md#places-along-the-game)

## Context
The route orders what is left by where each trophy falls along the campaign (`trophyPlaces`). For a trophy of a single moment, guides say where it unlocks. For a long one (a count, a collection, an upgrade to level 30), guides say where it can start and almost never where a normal run closes it. The first structure round placed 32 such trophies at their start, so the route showed them among the next to fall; those places were removed. Saying where a long trophy closes is something no guide does, and the data to work it out already passes through the app: every PSN sync returns each earned trophy's `earnedDateTime`, and the app keeps only the platinum's.

## Decision
Keep every player's unlock times and work out, per game, where each long trophy closes from the players who earned it:

1. **Unlocks are stored.** A table `unlock` (one row per user, PSN list and trophy) keeps `earned_at` from each sync. A one-off backfill reads the earned list of every title in every registered player's library from PSN, past unlocks included, slowly and in the background.
2. **A player's step at an unlock** is the place of the latest single-moment trophy they had earned by then, from the guide's `trophyPlaces`.
3. **A long trophy's step** is the median of those steps over the players who earned it, kept with how many players it came from (`trophy_step`: game, trophy, step, players), and recomputed when unlocks change. The route uses it as the trophy's `to` when the guide gives none, and the panel says how it was worked out ("Usually closes in chapter 7 · 12 players").
4. **Without enough players** (fewer than 3), or without places in the guide, a long trophy has no closing step: it keeps the guide's order and the panel only says where it can start ("You can start it in chapter 3"), never "Happens".

The player's own PSN counter still projects at their pace, and wins over the median for that player.

## Alternatives considered
- **Ask the content pipeline to research the closing step**: guides rarely state it; a model filling the gap would be guessing.
- **Order by PSN rarity**: rarity says how many finished a trophy, not when; long trophies that many skip look later than they are.
- **Read public profiles beyond the app's players**: PSN has no way to list who played a game, and crawling profiles is not something the players agreed to.

## Consequences
- Long trophies get a real, explainable place on the route, and it improves on its own as players join and sync. Games without any guide places still gain nothing until a guide places their story trophies.
- A trophy earned offline carries the time of its later sync, which can put it late for that player; the median over several players dilutes it, and fewer than 3 players never set a step.
- A new table holds every unlock of every player: it is personal data, deleted with the account like the rest, and only aggregates (step and player count) ever reach other players.
- The backfill costs one PSN call per title per player, a few thousand calls, paced to stay under PSN's limits.
