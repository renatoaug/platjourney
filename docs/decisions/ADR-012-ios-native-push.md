# ADR-012: Session-bound APNs alongside Web Push

- **Status**: Accepted
- **Date**: 2026-10-31
- **Related**: [Mobile](../design/09-mobile.md), [Database](../design/04-database.md)

## Context
The Capacitor app already reuses the web interface, but Web Push does not register native iOS devices. Notices opened the general history, which could hide an older tip or a tip outside the remembered filter.

## Decision
Use the official Capacitor push plugin and a server-side HTTP/2 APNs transport. Store native registrations separately, bound to the authenticated account and session. A revoked or expired session cannot receive new pushes. Route notices to an owner-checked saved tip. Keep provider credentials in operator configuration and disable native delivery when they are absent.

## Alternatives considered
- Firebase would introduce another service and credentials for an iOS-only preparation.
- Account-only token ownership would continue delivering after a session was revoked.
- Loading history pages until a tip appears would be slow and unreliable with active filters.

## Consequences
- One UI and one delivery dispatcher serve browser and iOS, with independent transport failure handling.
- A device renews registration on launch/resume; token and installation secrets must stay out of logs.
- Development and distribution builds need matching, separate APNs instance environments. Real delivery and store readiness still require device testing and approved signing credentials.
