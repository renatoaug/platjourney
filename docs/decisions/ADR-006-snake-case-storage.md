# ADR-006: snake_case in the database, camelCase in TypeScript

- **Status**: Accepted
- **Date**: 2026-10-02

## Context

Fields were snake_case, but objects stored inside them (a guide, a title's trophy split, the session plan) kept the camelCase keys of the TypeScript that wrote them, so the database mixed both.

## Decision

Everything stored is snake_case, the keys inside stored objects too. Repositories convert an object's keys to snake_case when they write it and back to camelCase when they read it (`snakeKeys` and `camelKeys` in `apps/server/src/db.ts`), so the rest of the code, the API and the AI service's schemas keep camelCase. Tables and repository modules are singular.

## Consequences

- Queries that reach into a stored object use the snake_case path.
- A copy of the database made before the change needs the same one-off conversion.
