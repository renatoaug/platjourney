# Versioned journey knowledge

The engine and session selector are generic TypeScript. Reviewed game knowledge is stored in `journey_model`, one immutable document per catalog game, PSN edition and content version. `journey_publication` selects the active version. Existing `/api/state` and `/api/title` responses carry `journeyModel` for the actual PSN edition being displayed; an unowned catalog preview uses the returned trophy list's edition, not a guessed release. Nothing is selected by translated game or trophy names.

## Validation and behavior

`schemaVersion: 1` supports the base trophy group, chapter and open-world planning. The validator rejects unknown fields/schema versions, missing bilingual guidance or HTTPS evidence, duplicate keys/identities, invalid dates, broken references and relation cycles. This checks structure and internal consistency, not the truth of the walkthrough: sources still need editorial review. Advisory placement is not a guaranteed unlock sequence or a geographical path optimizer. DLC remains separate and is not used to complete base-game prerequisites.

The repository validates every import and read and checks a canonical SHA-256 checksum. Published content is linked to the requested catalog game and edition. Importing the same payload twice is safe; changing it requires a new content version. Publication is a separate transaction with an expected current version, preventing a stale command from silently replacing another activation. Publication changes take effect at the next API/plan/conversation request; an already displayed view refreshes through its existing request lifecycle.

No active document means the existing guide fallback remains available. A malformed/checksum-mismatched document or failed database read is an explicit request error. It must not silently fall through to generating a session. A stored session keeps its objective keys and content version; if the active version changes, incomplete steps require review/new planning rather than being rewritten. Confirmed completion and hidden-trophy preferences still come from the account's data.

## Explicit import and activation

Run from the repository root using existing database credentials in the environment. The command requires a loopback database connection, so use it on the database host or an already approved secure local connection. Never put credentials in JSON documents or command history. The last argument on writes must exactly match the configured namespace/database; the examples use the standard development target.

```sh
# Pure validation; no database connection or credentials needed.
bun apps/server/scripts/journey-model.ts check db/journeys/npwr22997_00-v2.json

# Stage only; does not change the active route.
bun apps/server/scripts/journey-model.ts import game:152242 db/journeys/npwr22997_00-v2.json platjourney/main
bun apps/server/scripts/journey-model.ts import game:103054 db/journeys/npwr13822_00-v2.json platjourney/main

# Read current publication before choosing the expected version.
bun apps/server/scripts/journey-model.ts show game:152242 NPWR22997_00

# First activation expects none. A repeated command is intentionally not accepted as a fresh activation.
bun apps/server/scripts/journey-model.ts activate game:152242 NPWR22997_00 2 none platjourney/main
bun apps/server/scripts/journey-model.ts activate game:103054 NPWR13822_00 2 none platjourney/main
```

The importer checks that the edition belongs to the catalog game; verify those associations in each target database. The two JSON documents contain the previously reviewed public guide knowledge and sources, with no account data. They are initial transfer artifacts and test inputs, not runtime imports or mandatory templates for future games. An external editorial workflow may produce another compatible document and stage it through the same command without changing application code.

The command defines only the two new tables when necessary; it does not replay unrelated migrations, replace guides, mark trophies or create sessions. Normal server startup also applies these idempotent table definitions. No automatic data seed runs during startup or deployment. Deploying this PR alone therefore does not activate the two reviewed routes: an operator must separately import and activate their data in the target database after reviewing the destination. Until then the ordinary guide fallback applies.

## Rollback and verification

To move from an imported version 3 back to version 2, run `activate <game> <edition> 2 3 <namespace/database>`. To disable version 2 without deleting anything, run `activate <game> <edition> none 2 <namespace/database>`. Reactivation uses the same expected-version rule. Imported versions and account history remain intact. Existing pending session steps retain their stored version guard.

`bun scripts/check-journey-storage.ts` uses a disposable loopback SurrealDB 3.0.5 service on port 18183 (the same service as `check-push-migration.ts`). It checks staging, idempotency, immutable versions, catalog isolation, read validation, compare-and-set activation, rollback, deactivation fallback, schema replay, preserved account rows, and identical evaluation/session selection for new, partial and out-of-order trophy states. Unit/API tests cover malformed documents, wrong editions, corrupted data and publication changes. No live model calls or user progress changes are required.
