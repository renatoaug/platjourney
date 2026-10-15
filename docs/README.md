# Docs

How PlatJourney works, how to run it and why it is built the way it is. Code rules and the checks before calling a change done are in [`AGENTS.md`](../AGENTS.md); how to contribute is in [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Product

| Doc | What is in it |
|---|---|
| [features.md](features.md) | What PlatJourney does, the demo and the Telegram commands |
| [notifications.md](notifications.md) | What PlatJourney sends on its own (game start, trophies, sessions, progress marks), when, and the rules that keep it from repeating |
| [mobile.md](mobile.md) | Installing PlatJourney on a phone from the browser, and the native app built with Capacitor from the same code |

## Running and extending

| Doc | What is in it |
|---|---|
| [architecture.md](architecture.md) | The parts, how they talk and where the code lives |
| [configuration.md](configuration.md) | Every setting in `.env`, local models and per-feature models |
| [plugins.md](plugins.md) | Adding to an instance without changing the app: components, requests, the page's security policy |
| [database.md](database.md) | Why SurrealDB, every table and how they link (with diagrams), migrations, seeds and the catalog |

## Guides and Nexo

| Doc | What is in it |
|---|---|
| [sources.md](sources.md) | PSN, the web sources behind guides and how they are used |
| [rag.md](rag.md) | How the deep guide is indexed and how Nexo retrieves passages for an answer |
| [evals.md](evals.md) | Measuring Nexo against fixed questions, the evals database and the viewer |

## Decisions

[decisions/](decisions/README.md): one record per decision that shapes the code, with what was decided, why and what it costs.
