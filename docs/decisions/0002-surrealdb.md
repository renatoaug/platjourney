# 0002. SurrealDB for data and vectors

- **Status:** Accepted
- **Date:** 2026-09-01

## Context

The data is a graph of players, games, trophy lists and guides, and the deep guide and the recommendations need vector search over game and passage embeddings.

## Decision

SurrealDB 3 stores everything: record links between tables and vector similarity in the same database, run locally in Docker (`docker-compose.yml`). The schema is one idempotent `.surql` per table in `db/migrations`.

## Consequences

- One database for relations and vectors; no separate vector store to keep in sync.
- Vectors from different embedding models do not compare: changing the model means embedding the catalog and the passages again (`bun run embed --all`).
- Plain HTTP and the SDKs both work; the Python client talks CBOR so strings are never read as record ids.
