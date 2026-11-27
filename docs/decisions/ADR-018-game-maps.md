# ADR-018: Game maps are published apart, their spots are ours, their pictures are credited

- **Status**: Accepted
- **Date**: 2026-11-27
- **Related**: `apps/server/src/game-map.ts`, `apps/web/src/components/game-map.tsx`, the `map_collected` table in [04-database](../design/04-database.md)

## Context
Players asked where a game's collectibles are, and the competing apps answer with an interactive map. A map is two things: the picture of the game's world, and the spots on it. Neither belongs in the app's code, maps are large (tens of thousands of tiles per game), and pictures of a game's world come with someone's rights.

## Decision
- A game's map lives outside the app: one folder per catalog game number with `map.json` (categories and spots) and `tiles/{z}/{x}/{y}.webp`, published at `MAP_BASE_URL` (or read from `MAP_DATA_DIR` locally). The app holds no game's data; a game without a folder has no map page.
- Tiles load straight from that host, with the map's `version` in the address; `map.json` is read through the server and kept a few minutes.
- The spots are our own data: placed from guide screenshots and pin maps by aligning them on the game's map, checked across sources, only for what a trophy asks for. We do not copy another map site's database in bulk.
- The picture is the game's official map when that reads best, credited to its owner ("© Rockstar Games") behind the map's info button; a community map is used under its licence and credited as it asks; a public-domain one carries no credit.
- What a player marks as collected goes with the account (`map_collected`), not the device.

## Alternatives considered
- Embedding a map site (MapGenie): no public embed, and its terms forbid reproducing it.
- Drawing our own map from screenshots: built and dropped, the result was far below the official map's quality.
- Bundling maps with the app or the database: too large, and every update would be a release.

## Consequences
- A new game's map is a data job (see the maps scripts), not a code change.
- The official GTA VI map is a rights risk the competing apps take too; if asked to remove it, the community map (gtadb.org, CC BY 4.0) replaces it by changing the tiles and the credit only.
- Spots placed from few sources can be off by a hundred metres; players reporting a wrong spot is the next step to keep them right.
