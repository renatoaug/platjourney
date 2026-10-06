---
name: create-pr
description: Creates pull requests following this repo's conventions — Conventional Commits title and What/Why/Acceptance criteria sections. Use whenever the user asks to open, create, or submit a PR.
---

# Create pull request

Follow these steps, in order.

## 1. Preparation

- Make sure the work is committed on a branch of its own (create one with a `feat/`, `fix/`, `chore/`, etc. prefix if needed), branched off `main`.
- Push the branch before creating the PR.
- The PR base is `main`: `gh pr create --base main ...`.
- **Never** include in commits or in the PR: "Generated with Claude Code" footers, session links (`https://claude.ai/code/...`), `Claude-Session:` trailers, or `Co-Authored-By: Claude`. Technical content only.

## 2. Title

Conventional Commits format:

```
type(scope): lowercase subject
```

- Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `perf`, `test`, `ci`, `build`, `style`, `revert`.
- Use one of the repository's `scope:` labels as the scope (`web`, `server`, `ai`, `telegram`, `guides`, `db`), e.g. `feat(guides): ...`, `fix(telegram): ...`. The `labels.yml` workflow reads the title and adds the `type:` and `scope:` labels; a scope outside that list gets no label.
- The subject **must not start with an uppercase letter**.

## 3. Body

Follow the `.github/PULL_REQUEST_TEMPLATE.md` template:

```markdown
### What?

<what the PR does — concrete changes, as a list when there are several>

### Why?

<motivation: the problem or goal that justifies the change>

### Acceptance criteria

- [x] <what you already validated — e.g. "`bun run lint` and `bun run typecheck` clean">
- [ ] <what the reviewer has to verify — e.g. "on a game page, the quick facts show Dificuldade and Tempo estimado in dark mode">
```

- **If there is an issue, the PR has to close it.** `Closes #NN` on the first line of **What?**, so GitHub links the two and shuts the issue on merge. Several issues get several keywords: `Closes #12, closes #15`. Only skip it when the PR genuinely solves part of an issue — then write `Part of #NN`, and say in **What?** what is still missing.
- Write the body to a temporary file and create the PR with:

  ```bash
  gh pr create --base main --title "<title>" --body-file <file>
  ```

## 4. Acceptance criteria

This is the section that goes wrong most often. It is not a second list of the changes, and it is not "CI passes" written five different ways.

Split it in two, in this order:

1. **What you validated** — tick these (`[x]`). Commands you actually ran, with their result. Never tick a box you did not run.
2. **What only a person can confirm** — leave these unticked (`[ ]`). They are the reason the section exists: they tell the reviewer where to look.

**A PR that changes anything user-visible must carry visual QA items**, and they have to be specific enough to follow without guessing. Name the screen, the state and the theme:

- the screen or view (a game page, the guide, the account page, the Telegram card)
- the state that matters (empty, loading skeleton, error, a game without a guide, a long name that could clip)
- light **and** dark, since the two use different tokens
- mobile, when the layout changes at the breakpoint

Good: `run the app locally, open a game you do not own — the trophy list shows the count and no rarity, in both themes`.

Useless: `the layout is correct`.

A PR with no user-visible change — tooling, CI, a refactor with no rendered output — says so in one line instead of inventing visual criteria: `No user-visible change: nothing to QA visually.` Do not pad the list to look thorough.

## 5. After creating

- Report the PR link back to the user.
