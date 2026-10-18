# ADR-004: A read-only demo player

- **Status**: Accepted
- **Date**: 2026-10-01

## Context

People without a PSN account, or who do not want to connect one yet, had no way to see what the app does.

## Decision

A fictional player, PlatJourneyDemo, with real games, guides and trophy lists, is loaded from the committed `db/demo-seed.json` and opened from the sign-in screen without a password. Everyone shares it, so it only reads: writes are refused with `demo_read_only`, a few harmless ones (marking notices read, the language, the introduction seen) answer without saving, and nothing done for it calls PSN or the AI service.

## Consequences

- The demo always looks the same and costs nothing to run.
- Screens need a read-only state, and the chat shows sample conversations instead of a box.
- The seed is generated (`bun run build-seed`) from a database that has those games and guides; its dates move to the day it is loaded.
