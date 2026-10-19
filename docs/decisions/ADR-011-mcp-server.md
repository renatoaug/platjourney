# ADR-011: Assistants read the player's data through an MCP server that never calls the model

- **Status**: Accepted
- **Date**: 2026-10-19
- **Related**: [design/11-mcp.md](../design/11-mcp.md), issue #2

## Context

Many players keep an assistant (Claude, ChatGPT) open while they play and ask it about missables or a hard trophy. It does not know their trophy list or the guides PlatJourney researched, so it answers from memory and often gets platinum details wrong. These assistants connect to outside tools through MCP, signing the person in with OAuth 2.1, dynamic client registration and PKCE.

## Decision

The app serves an MCP server at `/mcp` (Streamable HTTP, one JSON-RPC message per POST, no sessions) with read-only tools: profile, current game, trophies, game search, guide, deep guide passages and interests. A tool returns facts from the database, PSN and the embeddings index; it never calls the model, so the assistant writes the answer and a read costs the instance nothing. Sign-in is OAuth served by the app itself: the assistant registers, the player allows it on `/#/connect` from their own session, and the bearer token reads only that player's data. Only hashes of codes and tokens are stored; disconnecting from Settings deletes the token. Plugins can refuse a tool call (`beforeTool`).

## Alternatives considered

- **One "ask Nexo" tool:** every question would be a model call the instance pays for, and the assistant could not combine our facts with its own reasoning.
- **A public REST API:** useful to developers, but players would still need something to call it; MCP is what the assistants already speak.
- **The official MCP SDK:** it brings a schema library and session handling the server does not need; the stateless protocol is a few JSON-RPC methods.

## Consequences

- Players get grounded answers in the assistant they already use, without opening the app, and the instance pays nothing for them.
- The app becomes an OAuth authorization server: its endpoints, codes and token rotation are our code to keep, covered by tests of the whole exchange.
- Tools that would call the model (session routes, picks) stay out of this first set.
- Each tool call reaches PSN or the database: a per-connection budget (`MCP_RATE_LIMIT`) keeps an assistant from hammering the instance.
