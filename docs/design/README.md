# Design

How PlatJourney is built, in reading order. Each note describes the code as it is today.

| Note | Covers |
|---|---|
| [01-architecture.md](01-architecture.md) | The parts, how they talk and where the code lives |
| [02-features.md](02-features.md) | What PlatJourney does, the demo and the Telegram commands |
| [03-setup.md](03-setup.md) | The first run in Docker or from the code, every setting in `.env`, local models and per-feature models |
| [04-database.md](04-database.md) | Why SurrealDB, every table and how they link (with diagrams), migrations, seeds and the catalog |
| [05-notifications.md](05-notifications.md) | What PlatJourney sends on its own (game start, trophies, sessions, progress marks), when, and the rules that keep it from repeating |
| [06-plugins.md](06-plugins.md) | Adding to an instance without changing the app: components, requests, the page's security policy |
| [07-rag.md](07-rag.md) | How the deep guide is indexed and how Nexo retrieves passages for an answer |
| [08-evals.md](08-evals.md) | Measuring Nexo against fixed questions, the evals database and the viewer |
| [09-mobile.md](09-mobile.md) | Installing PlatJourney on a phone from the browser, and the native app built with Capacitor from the same code |
| [10-sources.md](10-sources.md) | PSN, the web sources behind guides and how they are used |
