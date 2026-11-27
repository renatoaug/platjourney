# ADR-018: Game maps are published apart, their spots are ours, their pictures are credited

- **Status**: Accepted
- **Date**: 2026-11-27
- **Related**: `apps/server/src/game-map.ts`, `apps/web/src/components/game-map.tsx`, the `map_collected` table in [04-database](../design/04-database.md)

## Context
Players ask where a game's collectibles are, and a map answers that better than text. A map is two things: the picture of the game's world, and the spots on it. Neither belongs in the app's code, maps are large (tens of thousands of tiles per game), and each picture comes with its own licence.

## Decision
- A game's map lives outside the app: one folder per catalog game number with `map.json` (categories and spots) and `tiles/{z}/{x}/{y}.webp`, published at `MAP_BASE_URL` (or read from `MAP_DATA_DIR` locally). The app holds no game's data; a game without a folder has no map page.
- Tiles load straight from that host, with the map's `version` in the address; `map.json` is read through the server and kept a few minutes.
- The spots are our own data: placed from guide screenshots and pin maps by aligning them on the game's map, checked across sources, only for what a trophy asks for. We do not copy another map site's database in bulk.
- Each map's picture carries the credit its source asks for, behind the map's info button (`attribution` in `map.json`); a public-domain picture carries none.
- What a player marks as collected goes with the account (`map_collected`), not the device.

## Alternatives considered
- Embedding a third-party map site: none offers an embed for this, and their content is theirs.
- Drawing our own map from screenshots: built and dropped, the result was far below the official map's quality.
- Bundling maps with the app or the database: too large, and every update would be a release.

## Consequences
- A new game's map is a data job (see the maps scripts), not a code change.
- A map's picture can be swapped for another source by publishing new tiles and credit, with no change to the app.
- Spots placed from few sources can be off by a hundred metres; players reporting a wrong spot is the next step to keep them right.
