# AGENTS.md

## Front end

React + TypeScript in `apps/web/src/`, built with Vite into `apps/web/dist/`, which the server serves. Hash routes (`#/goals`) through `react-router`.

### Where things are

- **Tokens**: `apps/web/src/styles/theme.css`. Components use only the semantic level (`--color-*`, `--font-*`, `--text-*`, `--radius-*`). Corners come in three sizes by role: `--radius-tag` (labels, badges), `--radius-control` (buttons, inputs, chips, tabs, boxes inside a card) and `--radius-card` (cards, panels, sheets, toasts), plus `--radius-pill` and `--radius-round`; no other radius. The raw palette (`--palette-*`) lives only in that file; a new identity or a light theme changes only it. Tailwind (`src/styles/tailwind.css`) has no values of its own: its utilities (`bg-surface`, `text-fg-muted`, `rounded-card`, `tablet:`) read the same tokens. There is no preflight.
- **CSS**: each component owns its styles in a file next to it with the same name (`guide.tsx` and `guide.css`) and imports it as its last import: `import './guide.css'`. There is no app-wide stylesheet to append to.
  - **`src/styles/`**: what has no component: reset, elements and utilities (`base.css`), buttons, fields, chips and tabs (`controls.css`), cards, rows, tiles, tags and bars (`surfaces.css`), the page frame (`page.css`). Loaded once by `main.tsx` and the Storybook preview, through `index.css`.
  - **Layers**: every file wraps its rules in a cascade layer: `@layer base` in `src/styles/`, `@layer ui` in `src/ui/`, `@layer screens` everywhere else (and in the ops plugins). The order is declared in `src/styles/index.css`, so a screen overrides a shared piece no matter which file loads first. Inside a layer, an override needs a more specific selector (`.nexo-brief.card`), never a later position.
  - A component that uses another component's classes imports that component (or its CSS file), so its styles reach Storybook too.
- **Generic pieces**: `apps/web/src/ui/` (Icon, Cover, Markdown, toast, tooltip, skeletons, empty/error/pending states, pager, source note). They know nothing about the product.
- **Product components**: `apps/web/src/components/`. Screens: `apps/web/src/pages/`. App shell, state and routing: `apps/web/src/app/` (`useApp()` for the signed-in player and `/api/state`, `useInterests()` for the interests). Helpers and API types: `apps/web/src/lib/`.
- **Storybook**: `bun run storybook`. Every component has a `*.stories.tsx` next to it with its states and sample data (`src/fixtures/index.ts`). **Look there and in both folders before writing a component**; it almost always exists.
- **Screen patterns**: `.claude/skills/page-*/`. **Read the pattern's skill before building a screen.** Each `example.tsx` is a symlink to the real screen.
- **Texts**: the interface is in pt-BR and English. Every text a player sees is declared at the top of the file that shows it, `const messages = defineMessages({ [Language.PtBR]: {...}, [Language.En]: {...} })` from `apps/web/src/i18n/`; languages are always the `Language` enum, never a loose `'pt-BR'` or `'en'`, and read with `const t = useMessages(messages)` in components or `translator(messages)` outside React render; `t(key, params)` fills `{name}` placeholders and picks plurals from `count`. A text several files need belongs to the module that owns the concept and is exported from there, not copied. Dates and numbers use `lib/format.ts` or `Intl` with `getLocale()`. The server does the same for notices, Telegram and error messages: each module declares its texts with `defineMessages` from `apps/server/src/i18n.ts` and reads them with `translator(messages, user)`, in the player's saved language. What the model writes is not translated. The type check fails when English misses or adds a key or a plural category, and a test reads every `defineMessages` to check that both languages use the same placeholders.

### The five usual mistakes

1. A raw color, a `--palette-*` token or a variable nobody defines (a renamed token) in CSS or markup, or a CSS rule glued to the one before it with no empty line between. The lint fails on all of them (`bun scripts/css-spacing.ts --write` adds the empty lines).
2. Rewriting a piece that exists in `src/ui/` or `src/components/` under another name.
3. A list or screen without its four states: loading, empty, empty because of a filter, error.
4. A spinner instead of the component's skeleton built from `<Sk>`.
5. A `div` with `onClick`. An action is a `<button>`, navigation is a `<Link>`.

A component that fetches keeps the request in a thin container and renders a presentational part that takes data through props, so its stories need no network.

### Before saying "done"

1. `bun run lint` passes.
2. `bun run typecheck` passes.
3. `bun run test:coverage` passes: it is what CI runs (server, web and service tests with coverage floors), and it is slower than `bun run test`, so timing bugs in tests show up there first.
4. `bun run build`, then `bun run ui:check` passes: it screenshots every screen at 1280 and 375 into `apps/web/.ui-check/` and fails on serious axe violations, horizontal scroll and JS errors. Needs the app and the database running.
5. For a component: its story covers its states, and `bun run stories:check` passes (every story renders without errors). For a screen: its four states exist and the anatomy matches its skill.
6. Open the 1280 and 375 screenshots and compare them with the skill's example. Say what matched and what did not, not only what you saw. Lint and build pass on a broken layout.

## File names

Every file is kebab-case: `trophy-list.tsx`, `use-interests.ts`, `server-status.ts`, `trophy-list.stories.tsx`. Components keep PascalCase names inside (`export function TrophyList`); only the file name changes. Python modules are snake_case. Biome fails on any other file name.

Relative imports in the server and the scripts name the TypeScript file itself (`from './i18n.ts'`), never a `.js` that does not exist: Bun runs TypeScript directly. The web app imports without an extension, as Vite expects.

## Database

Everything stored in SurrealDB is snake_case: tables, fields and the keys inside stored objects (`guide.guide.has_missables`, `title.groups.base.defined_by_type`, `user.session_plan.total_minutes`). Tables are singular (`guide`, `title`, `user`) and so are the repository modules (`repository/guide.ts`). TypeScript keeps camelCase: a repository converts an object's keys to snake_case when it writes it and back when it reads it (`snakeKeys` / `camelKeys` in `apps/server/src/db.ts`), so the rest of the code, the API and the AI service's model schemas never see the stored form. Queries that reach into a stored object use the snake_case path.

Every table has `created_at` (`TYPE datetime DEFAULT time::now() READONLY`). A table whose rows change after they are created also has `updated_at` (`TYPE datetime DEFAULT time::now() VALUE time::now()`); tables that are only written once and deleted (`tip`, `message`, `guide_chunk`, `auth_session`, `recommendation`, `llm_call`) do not. The database sets both, so code never writes them. Timestamps that mean something else (`earned_at`, `last_updated_at`, `last_seen_at`) are separate fields. Every date field ends in `_at`, inside stored objects too (`questions[*].asked_at`).

Every change to what is stored (a table, a field, an index, a field's type or meaning, a key inside a stored object) updates `docs/database.md` in the same commit or PR: the field in its area's Mermaid diagram, the table's row in the reference tables (one row per, unique on, what the field means and who writes it) and the general rules at the top when the change touches them. Render the diagram before pushing.

## Tests

Tests live next to the code they cover, never inside `src/`: `apps/server/tests/` (`bun test`, run with `bun run test:server`) and `services/ai/tests/` (pytest, `bun run ai:test`). `bun run test` runs both.

## AI service

Every prompt, model call, embedding and vector search lives in `services/ai` (Python 3.14, FastAPI). The server gathers the facts (PSN, database, the player's history) and stores results; it calls the service with `ai(path, body)` from `apps/server/src/ai.ts`, and the cost tag set with `tagged()` travels as headers so each call is recorded against its user and action. Never add a prompt or an OpenAI call to TypeScript.

- Features: `src/platjourney_ai/<feature>.py` with its routes in `routers/<feature>.py`. Model calls only through `llm.py` (`respond`, `research_json`, `embed`), so their cost is recorded. Payloads from the server are `Wire` models in `schemas.py`.
- Tests in `tests/` mock the model; `bun run ai:test`. Evals in `evals/` run against the real model and database and cost tokens; `bun run ai:eval` before changing a prompt or the retrieval, run and compare them in `bun run ai:eval:view` ([docs/evals.md](docs/evals.md)). Evals only read the app's database; their questions and runs live in the `evals` database.
- `bun run lint` and `bun run typecheck` also run ruff and pyright (strict) on the service.

## Pull requests and commits

Never mention Claude Code (or any AI) in PRs, commits or anything versioned in this repository. In particular, do **not** add:

- the `🤖 Generated with [Claude Code](https://claude.com/claude-code)` footer
- session links `https://claude.ai/code/session_...`
- the `Claude-Session:` trailer in commit messages
- `Co-Authored-By: Claude ...`

PR descriptions and commit messages carry only the technical content: the problem, the change and how it was validated.

## Documentation

How to run and configure PlatJourney is in `README.md` and `docs/`. A decision that shapes the code (a new service, a storage rule, how something is charged) gets a record in `docs/decisions/`, copied from `docs/decisions/template.md`.

Do not hard-wrap Markdown (README, AGENTS.md, skills, templates): each paragraph or list item stays on one line and the editor wraps it on display. Code blocks and tables keep their usual format.

## Commits

Messages follow Conventional Commits, with a scope when it makes sense: `feat(web): ...`, `fix(db): ...`, `docs(readme): ...`. The subject is lowercase, imperative, has no trailing period, does not repeat the scope and uses no dash (`feat(web): dashboard and chat`, not `feat(web): web app — dashboard and chat`). Few commits, each one a complete change, described in the body when it is not obvious.

## PR conventions

To open a PR, use the `/create-pr` skill; it applies every rule below.

- The title follows Conventional Commits: `type(scope): subject` (scope when it makes sense), with a lowercase subject. It becomes the release note: every merge to `main` is a release (`.github/workflows/release.yml`), a `feat` bumps the minor version and any other type the patch.
- The body follows the template in `.github/PULL_REQUEST_TEMPLATE.md`: the **What?**, **Why?** and **Acceptance criteria** sections.
- The PR base is `main`.
- **Acceptance criteria** separate what was already validated (checked) from what only a person can confirm (unchecked). A PR that changes something visible needs visual QA items naming the screen, the state and the theme.
- If there is an issue, the PR closes it: `Closes #NN` on the first line of **What?**. When it solves only part of it, `Part of #NN` and what is still missing.
