# Decision records

One file per decision that shapes the code: what was decided, why, and what it costs. A record is not edited once accepted; a later decision that changes it is a new record that says which one it replaces.

| # | Decision | Status |
|---|---|---|
| [0001](0001-python-ai-service.md) | Every model call lives in a Python service | Accepted |
| [0002](0002-surrealdb.md) | SurrealDB for data and vectors | Accepted |
| [0003](0003-accounts-tied-to-psn-id.md) | Accounts tied to the PSN ID, proof only to take one over | Accepted |
| [0004](0004-read-only-demo.md) | A read-only demo player | Accepted |
| [0005](0005-texts-in-their-module.md) | Texts declared in the module that shows them | Accepted |
| [0006](0006-snake-case-storage.md) | snake_case in the database, camelCase in TypeScript | Accepted |
| [0007](0007-model-per-feature.md) | A provider and model per feature | Accepted |
| [0008](0008-plugins.md) | Plugins add to an instance without changing the app | Accepted |

New records copy [`template.md`](template.md).
