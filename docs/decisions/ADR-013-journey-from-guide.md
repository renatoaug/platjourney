# ADR-013: The trophy journey is derived from the guide

- **Status**: Accepted
- **Date**: 2026-11-04
- **Related**: [Trophy journey](../design/13-journey.md)

## Context
Players need to see what to do next and how their progress changes what is left. A first version kept hand-reviewed objectives per PSN edition in new versioned tables. It reached 2 of about 1,200 games, needed an import and an activation for each one, and gave those games a second source of truth next to their guide. Comparing its two documents with the guides showed that its order and placement largely repeated what the guide says, and its texts were less specific than the guide's tips.

## Decision
Derive the journey at read time from the guide and the PSN list, with no table of its own. The suggestion stays `todaysFocus`, so the map, the notices and Nexo name the same target. Sessions keep the existing planner.

## Alternatives considered
- Versioned reviewed models per edition: precise identity by trophy id, but a content operation for each game and a second source of truth.
- A field inside the guide with the extra structure: possible later, if measured use shows that a trophy kind or a time window is what is missing.
- A graph database: the data has almost no hard dependencies; only the platinum depends on other trophies.

## Consequences
Every game with a guide has the journey on release, and a better guide makes a better journey. Trophies are matched by name, as the rest of the guide already is, so a name shared by two trophies stays out of the phases. Chapter windows and recovery are only as good as the guide's milestones, and a trophy the guide does not explain shows its description and the link to Nexo instead.
