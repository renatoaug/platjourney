# Trophy journey

The journey is a map of a game's trophies that follows the player's progress. It reads only what every game already has: the guide (`guide.guide`) and the PSN trophy list. It stores nothing of its own, so every game with a guide has it, with no content round and no reindexing.

## Where each part comes from

| What the player sees | Source |
|---|---|
| Order of the route | `roadmap`, phase by phase, once per trophy, matched by unique exact name; with `storyline` and `trophyPlaces`, what is left goes by the step where each trophy should fall (`shared/journey/places.ts`) |
| Suggested next trophy | `todaysFocus`, the same target the session and trophy notices name |
| Tips for a trophy | `tricks`, `missables`, `onlineTrophies`, `buggy` and the `milestones` tips that name it |
| Steps that name the trophy | The lines of `roadmap.goal`, `earlyTips`, `collectibles` and general `milestones` tips that name it, at most three |
| Phase plan | `goal` of the selected trophy's first phase, in one folded block apart from the trophy's advice |
| "Along the way" | Repeated in several phases or stretches, a campaign-long warning, a PSN counter above one or an early tip that names it |
| Confirmed history | Earned trophies by PSN timestamp, oldest first; undated ones grouped after them |

## How it adapts

A new sync changes the earned flags and the counters. The server recomputes the focus: a missable open in the first phase with something left, then a PSN counter at 80% or more of its target from any phase (one horde left beats the next story trophy), then the next trophy in the guide's order. A trick does not move a trophy ahead, since a phase can span half the story. The route keeps the guide's order and marks the focus where it falls. Earned trophies leave the route's pending part and go to the history. Selecting a milestone or using the arrows never reorders anything.

Trophies do not say where the player is in the game. The route is a suggestion: it never claims a location, a save state or a guaranteed unlock order. Only PSN completes a trophy, and a full counter alone does not.

## What it does not invent

A trophy the guide does not explain shows its PSN description and the link to ask Nexo, who searches the deep guide. There is no filler text, and a phase's plan never appears as a trophy's advice. A one-word name only counts as a mention in bold, since it may be an ordinary word, and a step or a line of the phase plan that names a trophy still hidden stays out. A name that matches more than one trophy stays out of the route's phases. DLC stays on its own track, outside the platinum route. Hidden trophies keep their name, art and tips protected until the player reveals that game's hidden trophies, a choice saved per account in `user.revealed_trophy_games`.

## Coverage

Measured on 2026-11-04 on a local copy of 1,137 guides, dated 2026-10-21, against their official trophy lists. Production has newer guides, so these numbers are a floor for checklist content.

| Measure | Result |
|---|---|
| Base trophies with a place on the route | median 100%, 99.5% of all trophies |
| Trophies with a tip of their own | 40% |
| Trophies with no tip, but named in a guide step | 36% |
| Trophies with neither, mostly story ones | 24% |
| Share of a game's trophies with specific text | median 84%; 48% at the 10th percentile, 100% at the 90th |
| Route plus tips on at least 40% of trophies | 421 games |
| Route with fewer tips | 483 games |
| Only phases, fewer than 3 story milestones | 226 games |
| Fewer than 90% of trophies placed | 7 games |

The share of trophies with specific text is what a content round can raise: it needs the writing step only, since the passages are already indexed.

## Places along the game

A guide can say where each base-game trophy sits: `storyline` names the game's steps (`{ unit: "Missão", total: 35 }`) and `trophyPlaces` gives each trophy the step where it unlocks (`from`) or, for a count or a collection, the range it is worked on (`from`, `to`). A step past `total` is after the story.

- **Where the player is**: the furthest step among the earned trophies of a single moment. A count can close anywhere, so it does not count. It is an estimate, never a claim about the save.
- **Where an open trophy falls**: a trophy of a single moment, where it unlocks. A count, where its PSN counter reaches the target at the pace so far (never before the player nor its own start, and after the story when that pace would not close it in time); with no counter or no pace yet, the end of its range.
- **The route** orders what is left by that step, a trophy of the moment before a count on the same step. A trophy the guide does not place keeps its spot after the placed one before it.
- **The suggestion** is the nearest trophy at or after the player's step, after a missable of the current phase and a counter at 80% or more. With nothing ahead, the first one left behind.

Guides without places keep the roadmap's order and the phase rule above.

