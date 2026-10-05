---
name: page-list
description: A list with search, filters and pages (trophies, platinums, interests, notifications, history). Use when a screen or card lists items the player can narrow down.
---

# List with filters

`example.tsx` is the real trophy list (`src/components/trophy-list.tsx`), not a copy: follow its structure.

## Top to bottom

1. **Controls** (`.trophy-controls`): search on the left with `<Icon name="search">` and a real `<input>` with `aria-label`; status as a group of `<button aria-pressed>`; the rarer options folded in a `<details>` with a count of active filters.
2. **Result line** (`role="status"`): "1–8 de 46 troféus · Jogo base". Screen readers hear it when filters change.
3. **Rows**: one `<article>` per item. Media on the left, title and detail, a meta line, and the item action on the right as a `<button>`.
4. **Pagination** (`<nav aria-label>`): fixed page size (8 for trophies), previous and next, `aria-current` on the current page.

Filters persist per viewer in `localStorage`, always inside `try`, and the list works without it.

## The four states, always

| State | How |
| --- | --- |
| Loading | the list's own skeleton built from `<Sk>` with the rows' real classes (`TrophyListSkeleton`, `TipSkeleton`), never a spinner |
| Empty | `<EmptyState action={…}>`: say what will show up here and offer the next step |
| Empty because of a filter | the result line says "Nenhum ... encontrado" and the body suggests clearing or changing the filter |
| Error | `<ErrorState>`, never a blank card |

## Varies and does not vary

**Varies:** the filters, the sort options, the row metadata, the page size, the copy.
**Does not vary:** the block order, search on the left, the result line as `role="status"`, buttons for actions (never a clickable `div`), the four states.

## Before saying done

- [ ] Uses `Sk`, `EmptyState`, `ErrorState`, `Pager` from `src/ui/`, not local markup
- [ ] Its stories cover the four states
- [ ] The four states exist
- [ ] `bun run lint` passes
- [ ] `bun run ui:check` passes, and the screenshots at 1280 and 375 match the trophy list on the game page: a long item name truncates or wraps without pushing the action off the row
