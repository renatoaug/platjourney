# ADR-016: The route orders each trophy by where it is probably earned

- **Status**: Accepted
- **Date**: 2026-11-10
- **Related**: [ADR-013](ADR-013-journey-from-guide.md), [ADR-015](ADR-015-trophy-steps-from-players.md), [Trophy journey](../design/13-journey.md#places-along-the-game)

## Context
The journey tells a player the order they will earn their trophies. Until now a long trophy (a count, a collection) sat at the end of the guide's range, and a trophy the guide does not place took the spot after its neighbour in PSN's list. Guides write "after the story" as the end of most collections, so on Tomb Raider (24 missions, one story trophy) the route opened on mission 13 and stacked 29 trophies after the story, while players earn most of them around a third of the way in. On Death Stranding, ten trophies the guide does not place (Bom samaritano, A benção do bebê) went to the end; every one of the 13 players who have them earned them in episodes 1 and 2.

## Decision
The route, the suggestion and the server's focus order each open trophy by the step where it is probably earned (`expectedStep` in `shared/journey/places.ts`):

1. **A trophy of a single moment**: where the guide places it, as before.
2. **Any other trophy, from players**: `closingSteps` now works out a step for every trophy without a single moment (counts, collections and trophies the guide does not place). For each player, their story trophies are marks in time; between two marks the step goes in proportion to the time, before the first it grows from 0 (the start of the game, before step 1) since their first unlock of the game, and after a story's last step it is after the story. The median over at least 3 players is the trophy's step, never before the guide's start.
3. **Without enough players**: a count or a collection sits halfway through the guide's range (its start when the guide gives only a start); the player's own PSN counter still projects at their pace. A trophy the guide does not place sits at the story trophy with the closest PSN rarity, as fewer players reach later moments; without a rarity, after the story.
4. **Step 0 is the start of the game** (a prologue before episode 1): the panel says "at the start of the game", and a step past the last says "after the story".

## Alternatives considered
- **Keep the end of the range**: it is the latest a trophy can close, not when it usually does; collections that start in mission 1 all looked like postgame.
- **Order by where a trophy starts**: a count that starts in mission 1 is rarely done there; the route would promise it early and the suggestion would point at it for hours.
- **Rarity for everything**: ADR-015 rejected it for long trophies (players skip them, so they look later than they are); it stays only as the last fallback for trophies nothing else places.
- **A model's estimate (a calibrated classifier over steps)**: useful where a game has few players, as a better prior than halfway; kept for later, behind the same `expectedStep`.

## Consequences
- The route follows what players actually did wherever the app has 3 or more of them (41 of the first 74 guides in the new format), and improves on its own as players sync.
- A game whose guide has few story trophies has few marks, so its estimates are coarse (Tomb Raider's collections land between missions 13 and 15).
- The halfway prior is a guess: it is better than the end, and players' data replaces it trophy by trophy.
