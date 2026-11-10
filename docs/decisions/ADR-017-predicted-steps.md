# ADR-017: A decision model estimates where a trophy falls before players do, and some games are played in any order

- **Status**: Accepted
- **Date**: 2026-11-10
- **Related**: [ADR-015](ADR-015-trophy-steps-from-players.md), [ADR-016](ADR-016-route-by-expected-unlock.md), [Trophy journey](../design/13-journey.md#places-along-the-game)

## Context
ADR-016 orders every trophy by where players earn it, but only games with 3 or more players have that data (41 of the first 74 guides in the new format). The rest fall back to halfway through the guide's range and, for a trophy the guide does not place, the story trophy with the closest PSN rarity. Measured against players on 34 games (695 trophies without a single moment), that fallback misses by 27% of the story on average, and by 43% on trophies the guide does not place.

The player's place on the line is the furthest step among their earned story trophies. In a game whose steps can be played in any order (bosses, worlds), beating a late one first moved the player past everything they skipped, and the route called those "behind".

## Decision
1. **A decision model's estimate comes before the fallback.** For each base-game trophy without a single moment, the AI service asks a decision model (Jev, typesafe.ai) a choice over the steps (0, each step, after the story), given the guide's story trophies with their steps and the trophy's text, guide range and PSN rarity. The expected step (probability-weighted mean) is stored in the guide as `predicted_steps` (`services/ai/src/platjourney_ai/steps.py`, `llm.decide`). The order is: 3 or more players, then the estimate, then halfway or rarity. A trophy of a single moment always stays where the guide puts it.
2. **The server asks in the background.** When it serves a guide with places and no estimate, it calls `POST /guides/predict-steps` once an hour per game at most, tagged `guide_steps`; the answer reaches the next page load. Saving the guide again drops the estimate, so a new estimate follows the new places. Without `TYPESAFE_API_KEY`, nothing is asked and the journey keeps its fallback.
3. **`storyline.order: "free"`** marks a game whose steps can be played in any order. There the player's place is how many steps they have done, a step they skipped is never behind them, the suggestion is the first open trophy in the route, and players' marks count steps done instead of the step's number.

## Alternatives considered
- **A general language model with a prompt**: slower and dearer per trophy, and its numbers are not probabilities to average; the decision model answers a whole game in one call for a fraction of a cent.
- **Estimate at request time**: every page load would wait on a model; stored with the guide it is read like any other field.
- **The furthest step in free games, with a graph of what opens what**: the graph (ADR-014) says what a trophy needs, not where the player is; counting steps done is the honest measure when order is free.

## Consequences
- On the 34 games measured, the estimate misses by 19% on average (18% on placed counts, 22% on trophies the guide does not place) against 27%, 21% and 43% for the fallback; it was closer on 358 trophies and the fallback on 213. It did worse on GTA III and Resident Evil 4.
- Every guide with places costs one call (about 15 000 input tokens, under US$0.001) the first time it is opened after being saved.
- Well-known games may be estimated from what the model already knows about them; on obscure games the estimate is probably weaker, and players' data still replaces it trophy by trophy.
- Guides need `order: "free"` written by hand where it applies; without it, a game played in any order keeps the old behaviour.
