# <img src="apps/web/public/logo.svg" alt="" width="40" align="top"> PlatJourney

Your PlayStation platinum journey, guided by Nexo: PlatJourney watches your PSN profile, notices the game you start and the trophies you unlock, and helps you on the web and on Telegram with researched platinum guides, session routes and recommendations from what you actually play.

<p align="center">
  <a href="#running">📚 Get started</a> ·
  <a href="docs/design/02-features.md">✨ Features</a> ·
  <a href="docs/design/01-architecture.md">🏗️ Architecture</a> ·
  <a href="docs/design/03-setup.md">⚙️ Setup</a> ·
  <a href="docs/decisions/">🧭 Decisions</a>
</p>

https://github.com/user-attachments/assets/32fb3419-df6d-4361-a952-4caf3bf5ef21

## Stack

Web in React, API in Bun, AI in Python, data in SurrealDB.

More details, with every tool and version, in [`docs/design/01-architecture.md`](docs/design/01-architecture.md#stack).

## Requirements

- [Bun](https://bun.sh) 1.4.2, the version in `.bun-version`
- [uv](https://docs.astral.sh/uv/) 0.11 or newer, which installs Python 3.14 (`services/ai/.python-version`)
- [Docker](https://docs.docker.com/get-docker/) with Compose, for SurrealDB
- A Telegram bot ([@BotFather](https://t.me/BotFather)), an [IGDB app](https://api-docs.igdb.com/#account-creation) (Twitch developer console), a throwaway PSN account for its NPSSO, and an OpenAI key or a local model server

## Running

[`docs/design/03-setup.md`](docs/design/03-setup.md) has the first run (in Docker or from the code) and every setting in `.env`.

## Use it from your assistant

PlatJourney works as a connector in Claude, ChatGPT and other assistants that speak MCP: they read your trophies, your games, the game you are playing, your interests and the platinum guides, answer from them, and save games to your interests when you ask. Add a connector with your instance's address followed by `/mcp` (for example `https://app.example.com/mcp`), sign in and allow it. Settings → Connected apps lists what you connected and disconnects it. How it works, and every tool: [`docs/design/11-mcp.md`](docs/design/11-mcp.md).

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

`bun install` turns on a pre-push hook that runs lint, typecheck and `test:coverage`, the same as CI (skip once with `git push --no-verify`). Server tests never reach a database and web tests never reach the network: an unmocked call fails locally the same way it would in CI.

CI runs lint, typecheck and the tests with coverage on every pull request.

## Releases

Every merge to `main` is a release: [semantic-release](https://semantic-release.gitbook.io) reads the Conventional Commit titles since the last tag, bumps the version in `package.json` (a `feat` bumps the minor, anything else the patch), writes [`CHANGELOG.md`](CHANGELOG.md), tags `vX.Y.Z` and publishes the GitHub release. The menu shows the running version, and the server logs it on start.

## Docs

Everything about how PlatJourney works, runs and was decided is indexed in [`docs/`](docs/README.md). Code rules and the checks before calling a change done are in [`AGENTS.md`](AGENTS.md).

We follow [Conventional Commits](https://www.conventionalcommits.org).

## Community

- 🐛 [GitHub Issues](https://github.com/renatoaug/platjourney/issues): report a bug or propose a feature
- 🔧 Pull requests are welcome: read [`CONTRIBUTING.md`](CONTRIBUTING.md) first for how to start and the checks
- 🐙 [@renatoaug on GitHub](https://github.com/renatoaug): the maintainer
- 🌐 [rames.io](https://rames.io): more from the maintainer

## License

PlatJourney is licensed under the [Functional Source License 1.1](LICENSE) (FSL-1.1-ALv2): use, study, modify and share it for anything except a competing product or service. Each version becomes Apache 2.0 two years after its release.
