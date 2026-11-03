---
name: page-game
description: Game detail and personal journey screens, including progress, trophies and guides.
---

# Game detail and journey

Owned games share `Journey` in `src/components/journey.tsx`, whether opened from `/game` (current PSN game) or `/title/*`. A game not owned keeps the discovery anatomy in `src/pages/title.tsx` (`example.tsx`).

## Owned game: top to bottom

1. Existing immersive hero, catalog backdrop/scenes, name, platform and personal `HeroProgress`. `UnobtainableBanner` remains visible when appropriate.
2. The journey opens on the current pending guide suggestion (or the first pending trophy in guide order), inside a landscape using existing game artwork with a neutral fallback. A horizontal, keyboard-operable route focuses on pending milestones across stages; the complete chapter selector and earned history stay accessible in disclosures. Selecting a milestone shows its advice in place without changing progress. Ambient animation respects reduced motion. A connected trophy roadmap uses existing guide phase order and unique exact localized-name matches. Repeated references appear once; unmatched trophies are explicitly unplaced, platinum is the final milestone and DLC remains separate. Earned state comes only from PSN. Existing guide tips, warnings and contextual Nexo actions accompany each trophy; missing advice stays explicit. Hidden pending trophies require an explicit reveal. The server's `todaysFocus` can highlight a suggestion without changing its ranking. Guide order is advisory and never claims the player's confirmed location or a guaranteed unlock sequence.
3. Collapsible session route (`PlanCard` scoped by PSN list id). One active route per account; making another replaces the previous route and the UI states this.
4. `GameColumns` switches between `TrophyList` and the full `Guide` on the journey, preserving filters, sorting, help, guide numbers, sources, nested tabs and pending states. No invented trophy completion.
5. Similar games remain reachable through the sticky section navigation when available.

Nexo links open a dialog above the mounted journey, preserving scroll, filters and expanded sections. Mobile uses the available viewport with safe areas. Returning closes the dialog. Direct `/nexo` still opens the general conversation page and history.

## Game not owned

Preserve the scene backdrop, immersive hero with catalog facts, interest action and store link, guide and catalog trophies. Never show personal progress or offer a personal session plan. A selected-game plan requires ownership on the server.

## Navigation

Primary destinations are Home, Jornada, Guias, Descobrir and Jogos. Home retains its console and artwork at `/`; `/overview` redirects there. Jogos contains the synced PSN library and the ordered interests and deals, and a separate Goals and achievements tab with the annual target, calendar and earned platinums. `/goals` redirects to `/games?tab=goals`. Profile and guide search remain available. General Nexo, history and settings remain accessible from the account menu.

## States and validation

- Loading uses skeletons, never fabricated progress.
- No current game offers Jogos; failed sync is explicit.
- Missing guide uses the existing queued/researching states and polling stops on unmount.
- Failed plan loading must not invite a replacement as though no route exists.
- Keep pt-BR and English messages, semantic tokens, 44px primary touch targets and reduced-motion support from shared components.
- Stories cover progress, zero progress, guide pending, completion, loading, empty and failure across journey and list containers.
- Run lint, types, coverage, build, ui:check and stories:check. Inspect actual phone and desktop pixels, plus contextual chat, keyboard and return behavior before claiming visual validation.
