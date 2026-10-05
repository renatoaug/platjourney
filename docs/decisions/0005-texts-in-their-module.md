# 0005. Texts declared in the module that shows them

- **Status:** Accepted
- **Date:** 2026-09-28

## Context

The app is in Brazilian Portuguese and English. A central dictionary drifts from the screens: keys outlive the text they named, and nobody sees which screen a key belongs to.

## Decision

Every text a player sees is declared at the top of the file that shows it, with `defineMessages({ [Language.PtBR]: …, [Language.En]: … })`, and read with `useMessages` in components or `translator` elsewhere. The server does the same for notices, Telegram and errors, in the player's saved language. Languages are always the `Language` enum. The type check fails when English misses or adds a key or a plural category, and a test checks that both languages use the same placeholders. Texts addressed to the player do not mark their gender.

## Consequences

- A text and its screen change together; removing a screen removes its texts.
- A text several files need belongs to the module that owns the concept and is exported from there.
