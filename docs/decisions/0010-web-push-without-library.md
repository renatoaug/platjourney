# 0010. Send push notifications with Web Push, without a library

- **Status:** Accepted
- **Date:** 2026-10-16

## Context

Notices reached a phone only through Telegram. A player without Telegram heard about a trophy only when opening the app. The web app installs as a PWA, and browsers (Android, desktop, iPhone with the app on the home screen) can receive Web Push. The native app would need Firebase and an Apple developer account, which the instance does not have yet. The server keeps few dependencies, and the common Web Push library pulls in several packages.

## Decision

Notices go to each channel the player picks: Telegram (a switch on the profile) and push on each device that turned it on. Push is Web Push with VAPID, implemented in `apps/server/src/push.ts` with `node:crypto` only (RFC 8291 encryption, RFC 8292 signing), and tested by decrypting what it sends. An instance without VAPID keys has push off. Native push comes later, on the same channel choice.

## Consequences

Players without Telegram get notices on the phone, at no cost and without app stores. The encryption is our code to keep, covered by a test that decrypts it the way a browser does. iPhone users need the home screen step, which the profile explains. The native app shows push as not available until native push lands.
