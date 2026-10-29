---
name: page-game
description: Game detail screen. Use when a screen shows one game (the current game, a title from the library, a recommendation) with its progress, trophies and guide.
---

# Game detail

Every game screen has the same anatomy. Do not invent another one. `example.tsx` is the real title page (`src/pages/title.tsx`), not a copy: follow its structure.

## Top to bottom

1. **Backdrop** (`<GameBackdrop>` in `src/components/game-backdrop.tsx`): the game's scene across the whole top of the screen, behind the top bar, still, fading into the page. It portals into the app frame, so it spans the content column whatever the page's width. `<ScenesButton>` in the hero opens the scenes full screen, and the backdrop follows the one picked there.
2. **Hero** (`.hero.immersive`, no card): `<UnobtainableBanner>` when the platinum is gone, `.hero-top` with the scenes button and the platform on the right, the game name in `.hero-title`, the `.meta` chips (difficulty in its band's color, hours, playthroughs, missables, online) and `.hero-bottom` with `<HeroProgress>` (one glass row: count, bar, percent, the platinum's mark). Beside it, `.hero-aside` holds `<NextTrophy>`, or `<GameAbout>` (the facts card) when there is no trophy left to push or the game is not in the library (all in `src/components/hero.tsx`, `next-trophy.tsx`, `game-showcase.tsx`).
3. **Sections bar** (`<GameNav>`): sticky, lights the section in view (Sessão, Guia, Troféus) and, past the hero, carries the game's name and progress.
4. **Session plan** (`#plan-card`, `<PlanCard>`), only for the game being played now: the route as a track of its trophies and the picked step open under it.
5. **Two columns** (`.grid.cols-2.game-columns`): the guide and the trophy list (`<Guide>`, `<TrophyList>`, see the `page-list` skill), each under a HUD title band. On a phone they take turns behind a "Guia | Troféus" switch.

Segmented controls (the guide's tabs, the trophy status, the phone switch) are joined cells with the chosen one filled; `useSlide` from `src/ui/use-slide.ts` slides the fill to the choice.

## What changes with ownership

| Game | Primary action | Trophies |
| --- | --- | --- |
| Current game | "Pedir dica" on the next trophy | progress and "Pedir dica" |
| Owned title | Conversar com o Nexo | progress and "Pedir dica" |
| Not owned | Salvar nos interesses, Ver na PS Store | catalog list, no progress, no rarity, no help |

## The four states, always

| State | How |
| --- | --- |
| Loading | `<TitleSkeleton owned>`, never a spinner |
| Guide still being researched | `<GuideSkeleton>` plus `<PendingState>`, and poll until it lands (stop on unmount) |
| Game not found | `<ErrorState>Não achamos esse jogo.</ErrorState>` |
| Guide limit reached for the day | `<EmptyState>` saying when it will be built |

## Varies and does not vary

**Varies:** the primary action, whether trophies show progress, the copy.
**Does not vary:** the block order, the components, the four states, the two-column split, at most one primary button in the hero.

## Before saying done

- [ ] Uses `GameBackdrop`, `HeroProgress`, `UnobtainableBanner`, `NextTrophy` or `GameAbout`, `GameNav`, `TrophyList`, `Guide`, not local versions
- [ ] Its stories cover the four states
- [ ] The four states exist
- [ ] `bun run lint` passes
- [ ] `bun run ui:check` passes, and the screenshots at 1280 and 375 match the title page: a long game name wraps inside the hero, nothing overlaps the cover
