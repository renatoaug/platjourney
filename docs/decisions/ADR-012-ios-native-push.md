# ADR-012: Session-bound APNs alongside Web Push

- **Status**: Accepted
- **Date**: 2026-10-31
- **Related**: [Mobile](../design/09-mobile.md), [Database](../design/04-database.md)

## Context
The Capacitor app already reuses the web interface, but Web Push does not register native iOS devices. Notices opened the general history, which could hide an older tip or a tip outside the remembered filter.

## Decision
Use the official Capacitor push plugin and a server-side HTTP/2 APNs transport. Use one `push_subscription` table with `transport = webpush | apns` and flat, validated fields specific to each transport. APNs registrations are bound to the authenticated account and session; legacy Web Push retains its existing account-only lifecycle. A revoked or expired session cannot receive new pushes. Route notices to an owner-checked saved tip. Keep provider credentials in operator configuration and disable native delivery when they are absent.

## Alternatives considered
- Firebase would introduce another service and credentials for an iOS-only preparation.
- Account-only token ownership would continue delivering after a session was revoked.
- Loading history pages until a tip appears would be slow and unreliable with active filters.

## Consequences
- One UI and one delivery dispatcher serve browser and iOS, with independent transport failure handling.
- A device renews registration on launch/resume; token and installation secrets must stay out of logs.
- Development and distribution builds need matching, separate APNs instance environments. Real delivery and store readiness still require device testing and approved signing credentials.

An opt-out persists a per-account pending revocation until both native cleanup and the server DELETE succeed. Cleanup is attempted even when the network fails; launch, resume, reconnect and the Settings retry action retry the pending DELETE without registering again. Failed status reads or revocations show an unconfirmed state rather than confirming that notifications are off. DELETE carries the expected account ID, checked against the authenticated owner, so a stale request cannot revoke a newly signed-in account's device.

## Migration

Migration `028_push_transport.surql` upgrades existing Web Push rows in place, retaining IDs, endpoints, encryption keys and creation timestamps. It does not invent session hashes or installation secrets and does not require browser re-subscription. `DEFINE FIELD OVERWRITE` changes the existing schema and an UPDATE classifies legacy rows; changing an `IF NOT EXISTS` definition would not migrate a deployed database. The migration is transactional and repeatable, including after APNs registrations exist. The first backfill updates modification timestamps; subsequent runs do not rewrite classified rows.

`destination_key` and `registration_key` are database-derived, populated for both transports and uniquely indexed with `transport`. This avoids incomplete prefix reads through indexes containing optional fields in SurrealDB 3.0.5. The legacy endpoint-only unique index remains: only Web Push rows can contain endpoints. Defaults and assertions accept older Web Push writers that omit the discriminator; native-shaped records without `transport=apns` are rejected. Unknown transports, mixed shapes and incomplete APNs records are rejected. No FCM support is implied.

Returning to an older server is not a supported automatic rollback: its sender does not filter by transport and would read APNs rows as Web Push subscriptions. This PR supplies no down migration or database rollback procedure.

`bun scripts/check-push-migration.ts` checks the actual migrations, legacy writers, repeated mixed-table migration, indexes, atomic token transfer, session revocation against a disposable local SurrealDB 3.0.5 instance. It never uses production configuration. The prior archive built from `eb7b518` predates this schema revision and is historical, not a validated archive of this revision.
