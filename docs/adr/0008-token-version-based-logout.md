# 0008. Token-version counter for logout, instead of a blacklist or short-lived tokens

Status: Accepted

## Context

Access tokens are long-lived JWTs (`JWT_ACCESS_TOKEN_EXPIRES_MINUTES`, 7 days by default — see [ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md)) with no refresh-token flow: re-authenticating just means requesting a new OTP. Until now there was no way to end a session early — a leaked or no-longer-wanted token stayed valid for up to its full 7-day TTL, since JWTs are stateless and self-verifying by design.

Options considered for *how to revoke*:
1. **A token blacklist table** — store revoked token IDs (`jti`) until they'd have expired anyway; `get_current_user` checks the token isn't in it. Correct, but adds a table that every request has to query (or a cache in front of it), and needs its own cleanup job to drop expired entries.
2. **Short-lived access tokens + a refresh-token flow** — the conventional fix, but a materially bigger change (new refresh endpoint, refresh-token storage and rotation) for a project that doesn't have a refresh flow at all yet.
3. **A `token_version` counter on `User`** — every issued token embeds the version it was minted with (`tv` claim); `get_current_user` rejects a mismatch. Logout increments the counter, invalidating every token issued for that user in one write, no separate table.

## Decision

Go with the `token_version` counter (`backend/app/models/user.py`, `backend/app/core/jwt.py`). `POST /auth/logout` (authenticated) increments it; `create_access_token` takes the user's current version and embeds it as `tv`; `get_current_user` rejects any token whose `tv` doesn't match the user's current value.

An earlier draft compared a `token_valid_after` timestamp against the JWT's `iat` instead of a version counter. Rejected: JWT `exp`/`iat` are whole-second `NumericDate` values (RFC 7519) while the database timestamp has microsecond precision, so a token minted in the same wall-clock second as a logout couldn't be reliably told apart from one minted just before it — forcing an awkward tie-break (treat same-second as revoked) and a flaky-under-race edge case. An integer equality check has no such rounding boundary.

## Consequences

- One integer column, one comparison per request, no new table, no cleanup job, no new infrastructure.
- Logout is all-or-nothing per user: it revokes every token issued for that user, not just the one used to call it (there's no per-device/per-session tracking to revoke selectively — acceptable for a single-session-per-user MVP).
- Still no way to revoke a single token among several concurrently valid ones for the same user; that would need per-token identifiers (back to option 1) if multi-device session management is ever needed.
- The 7-day TTL still bounds exposure for a token that's leaked but never reported — this only helps once someone (the user, or code acting for them) actually calls logout.
