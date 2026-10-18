# ADR-007: A provider and model per feature

- **Status**: Accepted
- **Date**: 2026-09-27

## Context

Features differ in what they need: the chat answers in real time, guide research reads the web, notices are short and frequent. One model for everything is either too slow, too expensive or too weak somewhere, and running locally should be possible for free.

## Decision

`AI_PROVIDER` picks OpenAI or any OpenAI-compatible local server for every feature, and `AI_MODEL_<FEATURE>=provider[:model]` overrides it for one feature (`chat`, `tip`, `plan`, `recommend`, `guide`, `guide_index`, `server_check`). Web search follows each feature's provider; local models have none. Embeddings have their own provider (`EMBEDDING_PROVIDER`).

## Consequences

- An instance can mix a strong model for the chat with a cheap or local one for notices.
- An OpenAI model needs its price in `costs.py`, or its calls are recorded at $0.
