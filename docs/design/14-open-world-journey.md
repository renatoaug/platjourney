# Open-world journey pilot

Assassin’s Creed Odyssey (`NPWR13822_00`) tests the shared journey against parallel objectives rather than a chapter route. `shared/journey/odyssey.ts` inventories 51 base trophies. Additional tales and expansion groups remain visible separately but never enter the base recommendation, ongoing goals or platinum dependencies. The stored guide is unchanged.

## Reviewed evidence

Reviewed on 2026-11-03 using the existing catalog association and stored guide, [PowerPyx](https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/), [PlayStationTrophies](https://www.playstationtrophies.org/game/assassins-creed-odyssey/guide/), [Neoseeker](https://www.neoseeker.com/assassins-creed-odyssey/Achievements_%26_Trophies/Achievement_Trophy_Guide), and [Ubisoft’s 1.1.4 notes](https://www.ubisoft.com/en-au/game/assassins-creed/news/3KW6ZY3smNzX7gKsHFnsuO/assassins-creed-odyssey-114-patch-notes-updates). The latter confirms that the ship trophy description changed; the reviewed advice uses legendary status rather than the old guide’s blanket maximum-upgrade wording. Version 2 binds the exact edition/group/trophy ID; translated names no longer determine identity. Missing or duplicate identities fail closed. The PSN list is returned for catalog previews separately from their chat identifier.

The stored guide contains 11 phases: four cover the 51 base trophies, while the rest cover extra content. Its early tips and milestones already support more long-term preparation than the legacy three-item selection exposed. None of its phase positions is promoted to a hard dependency. Historical bug claims, fixed XP/time farming rates and destructive save-recovery suggestions are not imported as current guarantees. Sources disagree about which repeatable island tasks count; the reviewed advice conservatively suggests local side quests and distinguishes them from message-board contracts. The exact remaining quest availability is not observable.

## Separate planning policies

`JourneyModel.planning` explicitly selects chapter or open-world policy. Requiem retains its chapter-specific opportunities and recovery. Odyssey has no current chapter or region estimate. Story milestones only choose the next story reference and flag missing earlier story records for verification. A later milestone never marks optional activities as missed or requiring chapter replay.

`requires` represents hard completion dependencies (the platinum requires the other 50 base objectives). `evidenceAny` instead records sufficient evidence that a related system was unlocked; missing evidence means **check**, not blocked. An available action still requires checking the current save’s resources, equipment, journal and level. Unlock evidence does not prove current inventory or a fresh save’s state.

The path keeps a stable editorial order. The next suggestion prioritizes the next story reference, then actions with supporting unlock evidence, parallel preparation, and actions whose availability must be checked. This is a deterministic starting policy, not a shortest route or a claim of optimal efficiency. No travel distance, duration, remaining count or character level is invented. Completion always comes from the supplied earned flag, never a full counter or an inferred prerequisite.

## Continuous attention

Eleven pending base objectives are explicitly continuous: romance opportunities, message-board tasks, regional island quests, map exploration, underwater sites, mercenary rank, cult clues, spear upgrades, level progression, legendary lieutenants and ship upgrades. They remain available independently of the selected path stop and disappear only when their own achievement is confirmed. Hidden objectives stay hidden; the visible count can therefore be smaller than eleven. No per-collectible manual tracking is required.

Only the reviewed romance objective carries the opportunity-loss warning. An absent trophy does not establish that all opportunities were lost, including after story completion. The app asks the player to consult available in-game opportunities rather than prescribing a new save.

## Session selection

`shared/journey/session.ts` selects from the same evaluated candidates for reviewed editions. It excludes earned, hidden-without-consent, verification-only and later objectives, platinum and DLC. Missing or ambiguous base lists fail closed with an actionable conflict instead of replacing an existing plan. Other editions retain the existing model-generated session flow.

Requested minutes are **reserved time blocks**, not estimates of objective duration. At most one focus per reserved hour (rounded up, capped at three) limits context switching; it does not promise completion. Each step retains the PSN edition, reviewed model version and objective key within the existing flexible `session_plan.steps` object. The web and MCP views identify this timing as `budget`. Guidance comes from reviewed actions, availability checks, preparation/recovery and sources; this path makes no model call. The account's ownership, one-active-plan, replacement, expiry, dismissal and feedback rules remain unchanged.

On a subsequent read, confirmed unlocks re-evaluate the saved selection. Completed steps require their own earned flag. Missing earlier story records do not become completed, blocked steps are not presented as the next action, and newly eligible tasks are not silently inserted into the stored plan. A changed model, incomplete context or revoked spoiler preference safely withholds affected guidance. The original identities remain stored for correct completion/history tracking. Old plans without reviewed metadata retain their old behavior until the player explicitly requests a new plan. Catalog previews do not create personal sessions.

This is a bounded slice of eligible objectives, not a duration optimizer: the save's location, quest availability, remaining counters and task duration are still unknown. Every session asks the player to verify availability before committing the reserved block. Region/quest clarification and measured task durations remain future work.

## Validation and limits

Synthetic tests cover start, middle, story completion, optional unlocks out of order, unchanged path/input, unknown quest availability, the eleven ongoing objectives, full counters without completion, missing/ambiguous base lists, DLC name/ID collisions, catalog edition handling, hidden objectives and no automatic platinum. Requiem regressions run alongside them. Visual checks use the real catalog preview without changing account data or revealing hidden trophies.

The model does not read the game's save, character level, current quest, ship inventory, counters or map. It does not dynamically extract new sources, optimize geographic travel, generate per-encounter instructions or solve version/region differences across unreviewed editions. Live gameplay validation remains necessary. The full legacy guide remains available and can still contain older advice; this pilot does not silently reprocess it.

## Reviewed opportunity windows (version 2)

The story spine retains the prologue and nine episodes. Five opportunities are interleaved using the [trophy guide](https://www.powerpyx.com/assassins-creed-odyssey-trophy-guide-roadmap/): first ship upgrade with ship access after episode 1, equipping the legendary item awarded by episode 2, a romance opportunity during episode 3 with later alternatives, and the discovery/Olympic questlines during episode 7. Each relation stores an explanation and source URL. These are opportunity placements, not a promised unlock order or evidence that the relevant mission is active in the current save. Existing resource/journal checks still apply.

Other activities explicitly display flexible order. Their ordering remains editorial until individual availability or dependency relationships have supporting evidence; nothing implies they must wait until after the story. Eleven continuous objectives remain visible independently of map position. No location, level, lost opportunity or remaining count is inferred. DLC stays on the separate extra-content track and never enters base platinum requirements or the reviewed session candidate set.

This is a bounded evidence improvement, not a complete mission graph. The secondary PlayStationTrophies guide was inaccessible during this review; no new facts were accepted from it. Future additions need edition-specific identity, claim-level evidence, explicit unknowns and tests of out-of-order progress before receiving personalized guidance.
