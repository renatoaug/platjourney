---
name: page-game
description: Game detail screen. Use when a screen shows one game (the current game, a title from the library, a recommendation) with its progress, trophies and guide.
---

# Game detail

Every game screen has the same anatomy. Do not invent another one. `example.tsx` is the real title page (`src/pages/title.tsx`), not a copy: follow its structure.

## Top to bottom

1. **Hero** (`.card.hero`): cover art as `.bgimg`, `<UnobtainableBanner>` when the platinum is gone, then `.hero-top` (a live label on the left, the platform on the right), the game name in `.hero-title`, the `.meta` line (difficulty, hours, playthroughs, missables, online) and `.hero-bottom` with `<HeroProgress>` and one primary `.button` (all in `src/components/hero.tsx`).
2. **Session plan** (`#plan-card`, `<PlanCard>`), only for the game being played now.
3. **Showcase** (`<GameShowcase>` in `src/components/game-showcase.tsx`): the gallery of the game's scenes and the "Sobre" card (genres, studio, release, platforms, official site), from the catalog. Either one alone takes the whole width; a game without both shows nothing. On a phone the gallery drops its thumbnails.
4. **Two columns** (`.grid.cols-2.game-columns`): the trophy list on the left (`<TrophyList>`, see the `page-list` skill) and the guide on the right (`<Guide>`). Without a trophy list the guide takes the whole width (`.guide-wide`).

## What changes with ownership

| Game | Live label | Primary action | Trophies |
| --- | --- | --- | --- |
| Current game | SUA JORNADA ATUAL | Conversar com o Nexo | progress and "Pedir dica" |
| Owned title | NA SUA BIBLIOTECA | Conversar com o Nexo | progress and "Pedir dica" |
| Not owned | RECOMENDAÇÃO | Salvar nos interesses | catalog list, no progress, no rarity, no help |

## The four states, always

| State | How |
| --- | --- |
| Loading | `<TitleSkeleton owned>`, never a spinner |
| Guide still being researched | `<GuideSkeleton>` plus `<PendingState>`, and poll until it lands (stop on unmount) |
| Game not found | `<ErrorState>Não achamos esse jogo.</ErrorState>` |
| Guide limit reached for the day | `<EmptyState>` saying when it will be built |

## Varies and does not vary

**Varies:** the live label, the primary action, whether trophies show progress, the copy.
**Does not vary:** the block order, the components, the four states, the two-column split, one primary button in the hero.

## Before saying done

- [ ] Uses `HeroProgress`, `UnobtainableBanner`, `GameShowcase`, `TrophyList`, `Guide`, not local versions
- [ ] Its stories cover the four states
- [ ] The four states exist
- [ ] `bun run lint` passes
- [ ] `bun run ui:check` passes, and the screenshots at 1280 and 375 match the title page: a long game name wraps inside the hero, nothing overlaps the cover
