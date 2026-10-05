# 0003. Accounts tied to the PSN ID, proof only to take one over

- **Status:** Accepted
- **Date:** 2026-09-15

## Context

A player is a PSN profile. Asking for proof of ownership at sign-up (a code in the profile's "About me") is a hurdle at the moment the product has to win them over.

## Decision

The first time a PSN ID is typed, its owner chooses a password and is in. Proof is asked only to take an account over: whoever puts a short code in "About me" can reset the account registered for that PSN ID, optionally starting it clean. The PSN account id, not the online id, is the identity, so renamed IDs keep their account.

## Consequences

- Anyone can register someone else's public PSN ID; the real owner can always take it back.
