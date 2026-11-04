# Trophy journey

The journey is a map of a game's trophies that follows the player's progress. It reads only what every game already has: the guide (`guide.guide`) and the PSN trophy list. It stores nothing of its own, so every game with a guide has it, with no content round and no reindexing.

## Where each part comes from

| What the player sees | Source |
|---|---|
| Order of the route | `roadmap`, phase by phase, once per trophy, matched by unique exact name |
| Suggested next trophy | `todaysFocus`, the same target the session and trophy notices name |
| Tips for a trophy | `tricks`, `missables`, `onlineTrophies`, `buggy` and the `milestones` tips that name it |
| Goal of the stretch | `goal` of the trophy's first phase |
| "Along the way" | Repeated in several phases or stretches, a campaign-long warning, a PSN counter above one or an early tip that names it |
| Confirmed history | Earned trophies by PSN timestamp, oldest first; undated ones grouped after them |

## How it adapts

A new sync changes the earned flags. The server recomputes the focus, the route moves that trophy to the front of what is left, and the rest keeps the guide's order. Earned trophies leave the route's pending part and go to the history. Selecting a milestone or using the arrows never reorders anything.

Trophies do not say where the player is in the game. The route is a suggestion: it never claims a location, a save state or a guaranteed unlock order. Only PSN completes a trophy, and a full counter alone does not.

## What it does not invent

A trophy with no tip in the guide shows its PSN description, the goal of its phase and the link to ask Nexo, who searches the deep guide. There is no filler text. A name that matches more than one trophy stays out of the route's phases. DLC stays on its own track, outside the platinum route. Hidden trophies keep their name, art and tips protected until the player reveals that game's hidden trophies, a choice saved per account in `user.revealed_trophy_games`.

## Coverage

Measured on 2026-11-04 on a local copy of 1,137 guides, dated 2026-10-21, against their official trophy lists. Production has newer guides, so these numbers are a floor for checklist content.

| Measure | Result |
|---|---|
| Base trophies with a place on the route | median 100%, 99.5% of all trophies |
| Trophies with a tip of their own | median 39%; 20% at the 10th percentile, 76% at the 90th |
| Route plus tips on at least 40% of trophies | 421 games |
| Route with fewer tips | 483 games |
| Only phases, fewer than 3 story milestones | 226 games |
| Fewer than 90% of trophies placed | 7 games |

The share of trophies with a tip is what a content round can raise: it needs the writing step only, since the passages are already indexed.
