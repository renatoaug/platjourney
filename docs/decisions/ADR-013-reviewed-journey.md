# ADR-013: Reviewed objectives shared by journey and focus

- **Status**: Accepted
- **Date**: 2026-11-03
- **Related**: [Reviewed journey pilot](../design/13-reviewed-journey.md)

## Context
A phase's trophy names are not a chronological walkthrough. Rendering them as a path can postpone an opportunity and omit preparation. Trophy unlocks establish completed objectives, but do not report location, inventory, save branch or skill bars.

## Decision
Keep a generic pure evaluator and validation in `shared/journey/`, with edition-scoped, source-linked knowledge in versioned database documents, loaded through the existing game APIs. The web journey and server focus consume the same result. Distinguish advisory order and preparation from hard dependencies. Unknown state remains unknown; only confirmed unlocks complete trophies. Introduce this through the reviewed Requiem pilot without replacing stored guides or player data.

## Alternatives considered
- Regenerate a longer phase list: retains ambiguous timing and may overwrite existing guide enrichment.
- Generate a fresh route on each unlock: adds variable claims and latency without making unknown player state observable.
- Introduce another graph database: unnecessary for this bounded dependency model.

## Consequences
The pilot is deterministic, testable and source-reviewable. Knowledge needs editorial maintenance and coverage checks. Reviewed sessions select a bounded subset of the same candidates and retain objective identity/version. Allocated minutes are explicitly reserved time, never invented completion estimates. Re-evaluation updates eligible focus and confirmed completion without silently rewriting the saved selection. Unreviewed editions retain the existing generator.

## Open-world validation

Odyssey adds a separate planning policy rather than applying chapter recovery to an open world. Hard completion prerequisites remain distinct from sufficient unlock evidence; absent quest, inventory or level data stays unknown. Both policies return the same objective/candidate shape for shared session selection. See [the open-world pilot](../design/14-open-world-journey.md).

## Versioned storage

Reviewed knowledge is data, not a game-specific TypeScript module. The operator validates and imports immutable versions into `journey_model`, then explicitly activates one through `journey_publication`. Exact game/edition identity, schema validation and checksums are enforced on reads. The application contains no registry of supported game names or model constants. The initial reviewed documents in `db/journeys/` are import artifacts and regression inputs only, never production bundle imports or automatic startup seeds. New reviewed editions and revisions can be imported without an application release as long as they use the supported schema.

Activation and rollback are separate from importing and from deploying code. API, session and conversation boundaries refresh the active model, without a permanent process cache. Already saved reviewed plans retain their version guard and require rebuilding when their pending steps belong to a different active version. Missing publications preserve the ordinary guide fallback; invalid data or database failures fail explicitly. See [the operational procedure](../design/15-journey-storage.md).
