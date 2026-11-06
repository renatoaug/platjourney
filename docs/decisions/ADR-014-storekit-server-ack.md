# ADR-014: Finish StoreKit purchases only after the server accepts them

- **Status**: Accepted
- **Date**: 2026-11-06
- **Related**: [Mobile](../design/09-mobile.md), [Plugins](ADR-008-plugins.md)

## Context

The iOS app shares the web frontend, accounts and hosted instance plugins. Digital purchases need native StoreKit behavior without moving private billing policy or payment secrets into the public app. Purchases may finish while the app is offline or waiting for approval.

## Decision

Use a small StoreKit 2 Capacitor bridge and a typed client coordinator. Require the billing server to prepare purchases with a stable appAccountToken and to verify, reconcile and persist signed transactions before the client finishes them. Keep unfinished replay and transaction updates active for a signed-in user regardless of the current screen. Restore is explicit, and provider management stays with the store that owns the subscription.

## Alternatives considered

- Client-only receipt validation cannot safely assign credits, detect cross-account replay or keep refunded purchases current.
- Finishing immediately loses the reliable retry queue when backend delivery fails.
- Falling back to web checkout in native iOS makes old/misconfigured builds initiate a different payment flow without review.

## Consequences

- A new iOS binary is required; Android/browser behavior is unchanged.
- Missing backend configuration leaves purchases unavailable while existing access remains available.
- The private billing plugin owns all financial state and product mapping; the app has no new billing database tables.
- Live Sandbox/TestFlight payment and notification tests remain required after compilation/unit tests.
