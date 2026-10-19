# ADR-001: Every model call lives in a Python service

- **Status**: Accepted
- **Date**: 2026-09-20

## Context

Prompts, model calls, embeddings and vector search were spread through the TypeScript server. Prompt work, evals and the libraries around models are stronger in Python, and the cost of each call has to be recorded the same way wherever it happens.

## Decision

`services/ai` (Python, FastAPI) holds every prompt, model call, embedding and vector search. The server gathers the facts (PSN, database, the player's history) and stores results, and calls the service with `ai(path, body)`. Model calls go only through `llm.py`, which records each one in `llm_call` with its tokens, web searches and price, tagged with the user and action the server sends as headers. No prompt or model call is written in TypeScript.

## Consequences

- Two runtimes to install and run (Bun and uv), and a shared token between them.
- Prompts can be tested with mocked models (`bun run ai:test`) and measured against the real one (`bun run ai:eval`).
- Every model call is accounted for in one place.
