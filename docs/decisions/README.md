# Decision records

The project's decision log: short, dated, immutable records of structural decisions. They answer *"why is it like this?"* months later, and keep settled discussions from being reopened by someone who did not know they were settled.

Two kinds, same format:

- **ADR** (Architecture Decision Record) — technical choices: `ADR-NNN-slug.md`
- **PDR** (Product Decision Record) — product direction and scope: `PDR-NNN-slug.md`

The depth behind a record (diagrams, every table, every setting) lives in [`docs/design/`](../design/). Records are the memory; the design notes are the depth.

## Rules

1. **Records are immutable.** Reversing a decision means writing a *new* record and marking the old one `Superseded by ADR-NNN` in its Status line — never editing history.
2. **Write it in the same pull request.** A change that resolves a structural question ships with its record, written while the context is loaded.
3. **Keep it to half a page.** Four sections: Context, Decision, Alternatives considered, Consequences. If it needs more, link a design note or an issue.
4. **Number sequentially** within each prefix.
5. **State the decision as a rule someone can follow**, not as a summary of a discussion.

## Template

```markdown
# ADR-NNN: <Title>

- **Status**: Accepted | Superseded by ADR-NNN
- **Date**: YYYY-MM-DD
- **Related**: design notes, issues, other records

## Context
What was the situation and the forces at play? (2–5 sentences)

## Decision
What we decided, stated as a rule someone can follow.

## Alternatives considered
What else was on the table and why it lost. (bullets)

## Consequences
What this makes easier, what it makes harder, what to watch. (bullets)
```

## Index

| Record | Title | Status |
|---|---|---|
| [ADR-001](ADR-001-python-ai-service.md) | Every model call lives in a Python service | Accepted |
| [ADR-002](ADR-002-surrealdb.md) | SurrealDB for data and vectors | Accepted |
| [ADR-003](ADR-003-accounts-tied-to-psn-id.md) | Accounts tied to the PSN ID, proof only to take one over | Accepted |
| [ADR-004](ADR-004-read-only-demo.md) | A read-only demo player | Accepted |
| [ADR-005](ADR-005-texts-in-their-module.md) | Texts declared in the module that shows them | Accepted |
| [ADR-006](ADR-006-snake-case-storage.md) | snake_case in the database, camelCase in TypeScript | Accepted |
| [ADR-007](ADR-007-model-per-feature.md) | A provider and model per feature | Accepted |
| [ADR-008](ADR-008-plugins.md) | Plugins add to an instance without changing the app | Accepted |
| [ADR-009](ADR-009-similar-games-graph.md) | Recommendations by similar games from a graph, the model's picks on demand | Accepted |
| [ADR-010](ADR-010-web-push-without-library.md) | Send push notifications with Web Push, without a library | Accepted |
| [ADR-011](ADR-011-mcp-server.md) | Assistants read the player's data through an MCP server that never calls the model | Accepted |
