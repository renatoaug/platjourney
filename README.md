# <img src="apps/web/public/logo.svg" alt="" width="40" align="top"> PlatJourney

Your PlayStation platinum journey, guided by Nexo: PlatJourney watches your PSN profile, notices the game you start and the trophies you unlock, and helps you on the web and on Telegram with researched platinum guides, session routes and recommendations from what you actually play.

<p align="center">
  <a href="#running">📚 Get started</a> ·
  <a href="docs/features.md">✨ Features</a> ·
  <a href="docs/architecture.md">🏗️ Architecture</a> ·
  <a href="docs/configuration.md">⚙️ Configuration</a> ·
  <a href="docs/decisions/">🧭 Decisions</a>
</p>

## Stack

Web in React, API in Bun, AI in Python, data in SurrealDB: every tool and version is in [architecture](docs/architecture.md#stack).

## Requirements

- [Bun](https://bun.sh) 1.4.2, the version in `.bun-version`
- [uv](https://docs.astral.sh/uv/) 0.11 or newer, which installs Python 3.14 (`services/ai/.python-version`)
- [Docker](https://docs.docker.com/get-docker/) with Compose, for SurrealDB
- A Telegram bot ([@BotFather](https://t.me/BotFather)), an [IGDB app](https://api-docs.igdb.com/#account-creation) (Twitch developer console), a throwaway PSN account for its NPSSO, and an OpenAI key or a local model server

## Running

The quickest way to try it is Docker: fill `.env` and run `bun run docker:up` ([details](docs/configuration.md#everything-in-docker)). To work on the code:

```bash
cp .env.example .env         # fill it in: docs/configuration.md explains every setting
bun install
(cd services/ai && uv sync)

bun run db:up                # SurrealDB in Docker on :8000, data in ./data/surrealdb
bun run migrate              # one idempotent .surql per table in db/migrations
bun run seed                 # the read-only demo player and its games
bun run catalog:expand       # the game catalog from IGDB (once, safe to re-run)
bun run catalog:media        # each game's gallery, studio, site and release day (safe to re-run)
bun run catalog:releases     # the games out around today, for the home's calendar (the server repeats it daily)
bun run embed                # catalog vectors (once, safe to re-run)

bun run dev                  # server, AI service and web, reloading on save
```

Open http://localhost:3000, type your PSN ID and create a password, or open the demo. Each part also starts alone: `bun run dev:server`, `bun run dev:web`, `bun run dev:ai`.

Built and served as in production:

```bash
bun run build                # the web app into apps/web/dist
bun run start                # the server, serving the built app
(cd services/ai && uv run platjourney-ai)
```

`ecosystem.config.cjs` runs the server and the AI service under pm2.

Component catalog on http://localhost:6006:

```bash
bun run storybook
```

## Test

```bash
bun run lint                 # Biome, the design token check, ruff
bun run typecheck            # tsc (server and web), pyright
bun run test                 # server, web and AI service
bun run test:coverage        # the same, failing under 80% per app
bun run stories:check        # every story renders
bun run ui:check             # every screen at 1280 and 375 with axe (app and database running)
bun run ai:eval              # retrieval, scope and answers against the real model (ai:eval answers for one)
bun run ai:eval seed         # load the example eval questions (once, before the viewer)
bun run ai:eval:view         # run suites, compare runs and edit questions on 127.0.0.1:8200
```

`bun install` turns on a pre-push hook that runs lint, typecheck and `test:coverage`, the same as CI (skip once with `git push --no-verify`). Server tests never reach a database: an unmocked call fails locally the same way it would in CI.

CI runs lint, typecheck and the tests with coverage on every pull request.

## Releases

Every merge to `main` is a release: [semantic-release](https://semantic-release.gitbook.io) reads the Conventional Commit titles since the last tag, bumps the version in `package.json` (a `feat` bumps the minor, anything else the patch), writes [`CHANGELOG.md`](CHANGELOG.md), tags `vX.Y.Z` and publishes the GitHub release. The menu shows the running version, and the server logs it on start.

## Docs

- [`AGENTS.md`](AGENTS.md): code rules, conventions and the checks before calling a change done
- [`docs/features.md`](docs/features.md): what PlatJourney does, the demo and the Telegram commands
- [`docs/notifications.md`](docs/notifications.md): what PlatJourney sends on its own (game start, trophies, sessions, progress marks), when, and the rules that keep it from repeating.
- [`docs/mobile.md`](docs/mobile.md): installing PlatJourney on a phone from the browser, and the native app built with Capacitor from the same code.
- [`docs/architecture.md`](docs/architecture.md): the parts, how they talk and where the code lives
- [`docs/configuration.md`](docs/configuration.md): every setting in `.env`, local models and per-feature models
- [`docs/evals.md`](docs/evals.md): measuring Nexo against fixed questions, the evals database and the viewer
- [`docs/database.md`](docs/database.md): why SurrealDB, every table and how they link (with diagrams), migrations, seeds and the catalog
- [`docs/rag.md`](docs/rag.md): how the deep guide is indexed and how Nexo retrieves passages for an answer
- [`docs/sources.md`](docs/sources.md): PSN, the web sources behind guides and how they are used
- [`docs/decisions/`](docs/decisions/): decision records

We follow [Conventional Commits](https://www.conventionalcommits.org).

## Community

- 🐛 [GitHub Issues](https://github.com/renatoaug/platjourney/issues): report a bug or propose a feature
- 🔧 Pull requests are welcome: read [`AGENTS.md`](AGENTS.md) first for the rules and the checks
- 🐙 [@renatoaug on GitHub](https://github.com/renatoaug): the maintainer
- 🌐 [rames.io](https://rames.io): more from the maintainer

## License

PlatJourney is licensed under the [Functional Source License 1.1](LICENSE) (FSL-1.1-ALv2): use, study, modify and share it for anything except a competing product or service. Each version becomes Apache 2.0 two years after its release.
