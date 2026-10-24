# Setup

How to get PlatJourney running on your machine, in Docker or from the code, and every setting in the root `.env` (`.env.example` lists them with a line on each).

You need the tools and accounts in the README's [Requirements](../../README.md#requirements). The quickest way to try it is [everything in Docker](#everything-in-docker). To work on the code, follow the first run below.

## First run

```bash
cp .env.example .env         # fill it in: every setting is described below
bun install
(cd services/ai && uv sync)

bun run db:up                # SurrealDB in Docker on :8000, data in ./data/surrealdb
bun run migrate              # one idempotent .surql per table in db/migrations
bun run seed                 # the read-only demo player and its games
bun run catalog:expand       # the game catalog from IGDB (once, safe to re-run)
bun run catalog:media        # each game's gallery, studio, site, release day and PlayStation Store link (safe to re-run)
bun run catalog:releases     # the games out around today, for the home's calendar (the server repeats it daily)
bun run catalog:similar      # similar games, expansions and series from IGDB, for recommendations by similarity (safe to re-run)
bun run embed                # catalog vectors (once, safe to re-run)

bun run dev                  # server, AI service and web, reloading on save
```

The PSN NPSSO belongs to the throwaway account and only reads public profiles, so every player's games, trophies and "About me" must be visible to anyone.

Then open http://localhost:3000:

- Type your PSN ID and create a password, or open the demo.
- Connect Telegram from the profile page: it opens the bot with a one-time link.
- An account that came from a seed has no password yet: the first sign-in sets it. Do that (or `bun run password <psn id>`) before anyone else can reach the instance.

## Running

| Command | What it starts |
|---|---|
| `bun run dev` | Server, AI service and web, reloading on save |
| `bun run dev:server`, `dev:web`, `dev:ai` | One part alone |
| `bun run build` then `bun run start` | The built web app, served by the server |
| `(cd services/ai && uv run platjourney-ai)` | The AI service, next to `start` |
| `bun run storybook` | The component catalog on http://localhost:6006 |

`ecosystem.config.cjs` runs the server and the AI service under pm2.

## Everything in Docker

To try PlatJourney without installing Bun and uv: fill `.env`, then

```bash
bun run docker:up            # SurrealDB, the AI service and the server with the built web app
```

and open http://localhost:3000 (only this machine can reach it). The first time, load data into the containers:

| Command | What it does |
|---|---|
| `docker compose exec server bun scripts/seed.ts` | The demo player and its games |
| `docker compose exec server bun scripts/expand-catalog.ts` | The game catalog from IGDB |
| `docker compose exec ai uv run --no-dev python -m platjourney_ai.jobs.embed_catalog` | The catalog's vectors |

- `bun run docker:logs` follows the server and the AI service; `bun run docker:down` stops them.
- The containers read the same `.env`, but reach SurrealDB and each other by their compose names, and run without plugins.
- A container is a snapshot: after changing the code, `bun run docker:up` builds it again. For day-to-day work, `bun run dev` reloads on save.
- Do not run it next to `bun run dev` on the same database and Telegram bot: two servers would both poll Telegram and sweep the same players.

## Required

| Setting | What it is |
|---|---|
| `PSN_NPSSO` | NPSSO of the throwaway PSN account. Treat it like a password |
| `TELEGRAM_BOT_TOKEN` | The bot's token |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | OpenAI key and default model (not needed with local models) |
| `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` | The IGDB app |
| `SURREAL_URL`, `SURREAL_USER`, `SURREAL_PASS`, `SURREAL_NS`, `SURREAL_DB` | SurrealDB; Docker Compose reads the user and password too |
| `AI_URL`, `AI_TOKEN` | Where the AI service listens and the token the server calls it with (`openssl rand -hex 24`); the service refuses to start with a token under 32 characters |

## What the instance spends on its own

By default the app also calls the model without a player asking. Each switch turns part of that off.

| Setting | Default | `0` means |
|---|---|---|
| `AI_RESEARCH` | 1 | No guide research for games without one, no deep guide page search, no server checks. Games opened without a guide are recorded in `guide_request`; `bun run check-servers` checks servers on demand |
| `AI_NOTICES` | 1 | Plain notices on game start and trophies, nothing at session end. With `1`, each player can still turn Nexo's notices off on the profile page |
| `AI_WEB_SEARCH` | 1 | No web search inside answers: Nexo answers from the guide and the deep guide passages, recommendations use the numbers of the guides already written, and uncovered questions are recorded in `guide_request` |

With all three off, the instance only spends when a player chats, asks for a plan or for recommendations.

## Local models

The AI service can run on your own machine, for free, with any server that speaks the OpenAI API: [LM Studio](https://lmstudio.ai) or [mlx-lm](https://github.com/ml-explore/mlx-lm) (fastest on Apple Silicon), [llama.cpp](https://github.com/ggml-org/llama.cpp), [Ollama](https://ollama.com).

| Setting | What it is |
|---|---|
| `AI_PROVIDER=local` | Every feature on the local server |
| `EMBEDDING_PROVIDER=local` | The vectors too |
| `LOCAL_BASE_URL` | The server's address (e.g. `http://localhost:1234/v1`) |
| `LOCAL_MODEL`, `LOCAL_EMBEDDING_MODEL` | Model names on that server |
| `LOCAL_REASONING_EFFORT` | `none` by default: thinking models on a laptop can think for minutes |
| `LOCAL_MAX_TOKENS` | Caps each reply (2000), so a model stuck repeating itself stops |

- Local models have no web search: pair them with `AI_RESEARCH=0`.
- Calls are still recorded in `llm_call`, at $0.
- After changing the embedding model, run `bun run embed --all`: vectors from different models do not compare.

## A model per feature

`AI_MODEL_<FEATURE>=provider` or `provider:model` overrides `AI_PROVIDER` for one feature, e.g. `AI_MODEL_CHAT=openai:gpt-5.5`, `AI_MODEL_TIP=local`.

| Feature | What it is |
|---|---|
| `chat` | Nexo's answers |
| `tip` | Nexo's notices |
| `plan` | Session routes |
| `recommend` | Recommendations |
| `guide` | Guide research |
| `guide_index` | Finding deep guide pages |
| `server_check` | Online server checks |
| `judge` | The model that grades Nexo's answers in the evals ([evals](08-evals.md)) |
| `search` | Putting the player's question in English before the deep guide search ([retrieval](07-rag.md)); unset on OpenAI it is `gpt-5.4-nano` |

Web search follows each feature's provider. An OpenAI model needs its price in `services/ai/src/platjourney_ai/costs.py`, or its calls are recorded at $0.

## Accounts and access

| Setting | Default | What it is |
|---|---|---|
| `SESSION_DAYS` | 30 | How long a sign-in lasts |
| `COOKIE_SECURE` | 0 | `1` when served over HTTPS |
| `AUTH_SKIP_VERIFICATION` | 0 | `1` skips the "About me" check when claiming an account. Local development only |
| `ACCESS_HASH_SECRET` | empty | Records where accounts are used from, as an HMAC of the IP (`openssl rand -hex 32`). Empty records nothing |
| `ACCESS_KEEP_DAYS` | 180 | Days an unused address is kept |
| `TRUST_PROXY` | 0 | `1` reads the address from Cloudflare's `CF-Connecting-IP`, or else the last `X-Forwarded-For` hop. Only behind a proxy that sets them |
| `API_RATE_LIMIT` | empty | Requests per minute one address may send to the API, every route together; over it, 429 with `Retry-After`. Set it well above what one player's screens send. Empty or 0 turns it off |
| `MCP_RATE_LIMIT` | 60 | Tool calls per minute one connected assistant may make on `/mcp`; over it, the tool answers that it is busy. 0 turns it off |
| `MCP_REFRESH_DAYS` | 14 | Days a connected assistant stays signed in without being used; each use renews it |

## Push notifications

| Setting | Default | What it is |
|---|---|---|
| `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY` | empty | The instance's key pair for Web Push; `bun run --cwd apps/server push:keys` makes one. Empty turns push off and the profile shows only Telegram. A new pair makes every device turn push on again |
| `PUSH_CONTACT` | mailto:admin@localhost | A `mailto:` or `https:` address sent to the push services with every message, so they can reach whoever runs the instance |

## Optional

| Setting | Default | What it is |
|---|---|---|
| `POLL_MINUTES` | 15 | How often each player's PSN profile is checked |
| `PORT` | 3000 | The server's port |
| `PLUGINS`, `PLUGINS_WEB` | empty | Plugin modules to load ([plugins](06-plugins.md)) |
| `MOBILE_URL` | empty | The instance the native app opens, read by `cap sync` ([mobile](09-mobile.md)); empty ships the web build inside the app |
| `WEB_DEV_URL` | empty | Development only: the Vite server the page is proxied from (`bun run dev` sets it) |
| `AI_HOST`, `AI_PORT` | 127.0.0.1, 8100 | Where the AI service listens |
| `SURREAL_PORT` | 8000 | The host port Docker Compose publishes SurrealDB on (`127.0.0.1` only) |
| `UI_URL` | http://localhost:3000 | Development only: the app `apps/web/scripts/ui-check.ts` checks |
| `UI_USER` | the first user | Development only: the PSN online id `ui-check.ts` signs in as |
| `UI_VERBOSE` | empty | Development only: any value makes `ui-check.ts` list the elements behind each accessibility violation |
| `CHAT_MAX_OUTPUT_TOKENS` | 1500 | Caps each Nexo answer |
| `EMBEDDING_MODEL` | text-embedding-3-small | OpenAI embedding model (with `EMBEDDING_PROVIDER=openai`) |
| `EVAL_SURREAL_URL`, `EVAL_SURREAL_USER`, `EVAL_SURREAL_PASS`, `EVAL_SURREAL_NS`, `EVAL_SURREAL_DB` | the `SURREAL_*` values, database `evals` | Where the evals keep their questions and runs ([evals](08-evals.md)) |
| `EVAL_VIEW_PORT` | 8200 | The eval viewer's port |
