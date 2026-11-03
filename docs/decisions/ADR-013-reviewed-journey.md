# ADR-013: Reviewed objectives shared by journey and focus

- **Status**: Accepted
- **Date**: 2026-11-03
- **Related**: [Reviewed journey pilot](../design/13-reviewed-journey.md)

## Context
A phase's trophy names are not a chronological walkthrough. Rendering them as a path can postpone an opportunity and omit preparation. Trophy unlocks establish completed objectives, but do not report location, inventory, save branch or skill bars.

## Decision
Keep edition-scoped, source-linked objective knowledge and a pure evaluator in `shared/journey/`. The web journey and server focus consume the same result. Distinguish advisory order and preparation from hard dependencies. Unknown state remains unknown; only confirmed unlocks complete trophies. Introduce this through the reviewed Requiem pilot without replacing stored guides or player data.

## Alternatives considered
- Regenerate a longer phase list: retains ambiguous timing and may overwrite existing guide enrichment.
- Generate a fresh route on each unlock: adds variable claims and latency without making unknown player state observable.
- Introduce another graph database: unnecessary for this bounded dependency model.

## Consequences
The pilot is deterministic, testable and source-reviewable. Knowledge needs editorial maintenance and coverage checks. Session planning still needs a separate integration before it can be described as a time-bounded slice of this route; sharing the focus alone does not provide that guarantee.
