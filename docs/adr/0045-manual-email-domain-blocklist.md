# 0045. Manual email/domain blocklist for spam and abuse

Status: Accepted; amended by the addenda of 2026-09-24 (verifying a code checks the blocklist too) and 2026-10-01 (email entries expire after 24 months, in the export and the Datenschutzerklärung).

## Context

The disposable-email check (`app/core/otp.py::is_disposable_email`, backed by the `disposable-email-domains` package) only catches domains a third-party list already knows about. The operator also needs to manually block a specific address or domain that turns out to be abusive but isn't on that list — including a one-click "block this account" action from the `/admin/users` list, and typing in an address or domain by hand.

Two existing mechanisms look similar but don't fit:

- `ALLOWED_EMAILS` (the private-beta allowlist) and `ADMIN_EMAILS` (ADR-0019) are comma-separated env vars, changed by editing `render.yaml`/the Render dashboard and redeploying. A spam block needs to take effect immediately, from the admin UI, without a deploy.
- Both of those lists also only ever name people who already know they're on it (the operator typed their own admins/beta testers in). A block list must be able to name an address that has no `User` row at all yet — someone who hasn't tried to sign up.

That rules out a settings-string approach (the pattern ADR-0019 chose for admin access, and explicitly preferred there over a DB column) — this one has to be a table, edited through its own admin endpoints.

## Decision

A new table, `blocked_emails` (`app/models/blocked_email.py`), holding rows of `(kind, value, reason, created_at, created_by)` where `kind` is `"email"` (an exact, canonicalized address) or `"domain"` (lowercased). `app/services/blocklist.py` owns normalization, matching, and — since the hot-path check now runs on every `/auth/otp/request` — an in-process cache of the whole table (`app/core/cache.py`, same pattern as the catalog cache, ADR-0009), invalidated on every write so an admin's change is effective on the very next request rather than waiting out the TTL.

No new column on `User`. Whether an account is "blocked" is derived at read time by checking its email against this table — a domain block has to show every matching account as blocked without writing to each of their rows, and a per-user `is_blocked` column would be a second place that state could drift from the table.

Behavior, matched to how the existing checks work:

- A blocked email/domain hitting `POST /auth/otp/request` gets the same silent `202` as an allowlist miss or a disposable address — no enumeration signal for an anonymous caller.
- `POST /auth/me/email/request` (already authenticated) gets an explicit `400`, same asymmetry `is_disposable_email` already has there.
- Blocking a **domain** only stops *future* OTP requests — it doesn't touch any account already logged in on that domain, and doesn't force a re-login for it.
- Blocking a **specific account** (`POST /admin/users/{id}/block`) also bumps `token_version` (ADR-0008), ending its current session immediately, on top of adding its address to the table. Unblocking removes the row but doesn't touch `token_version` — the point of unblocking is to let them log back in, not to force a fresh login on an already-blocked-then-restored account.

New admin endpoints: `GET/POST /admin/blocklist`, `DELETE /admin/blocklist/{id}` (manage entries by hand) and `POST/DELETE /admin/users/{id}/block` (the one-click action from the account list/detail page). All sit under the existing `require_admin` gate (ADR-0019); `add_block` is idempotent, so a repeated click isn't an error.

## Consequences

**Easier:** blocking takes effect immediately from the admin UI, no redeploy; the same table serves both the free-text "block this address/domain" tool and the one-click per-account action, so there's one source of truth for "is this blocked" everywhere it's asked (the OTP check and the admin user list/detail's display field alike).

**Harder / deliberately deferred:** no bulk import, no expiry — an entry stays until an admin removes it by hand. A block keyed on a domain can't be un-done for one specific account within that domain (blocking is per-domain or per-address, not both at once for the same entry) — if that's ever needed, the affected account should just get its own email-kind entry removed while the domain entry stays for everyone else, which the table already supports without a schema change.

**Rejected alternative — extend `ALLOWED_EMAILS`/a new blocklist env var:** would need a redeploy for every change and couldn't name an address with no account yet; also doesn't fit the "block this user" one-click action, which needs a live endpoint to call, not a config edit.

**Rejected alternative — `is_blocked` column on `User`:** doesn't work for domain blocks (would require writing every matching row, and still wouldn't cover an address that never signed up) and duplicates state that's already derivable from the blocklist table — the same reasoning ADR-0019 used to reject an `is_admin` column, for the same underlying concern (a second place authorization-adjacent state can drift from its source of truth).

## Addendum 2026-09-24: a block also stops codes already sent

`POST /auth/otp/verify` now checks the blocklist too, after consuming the code, and answers a blocked address exactly like a wrong code (`401 Invalid or expired code`). Before that, a code requested just before the block still opened a new session for up to `OTP_TTL_MINUTES`. This applies to email and domain entries alike; a domain block still leaves sessions that already exist on that domain alone.

## Addendum 2026-10-01: retention, export and Datenschutzerklärung for email entries

An email entry is personal data — the address, an optional free-text reason about the person, when and by which admin — and it deliberately outlives the account it blocks (deleting the account must not lift the block, or the block is worthless). As decided above it had no expiry, it wasn't in the Art. 15 export (only the derived `is_blocked`), and the Datenschutzerklärung didn't mention it, which broke the rule that personal data is deleted, exported and described.

- **Retention: 24 months after the block, for email entries only** (`blocklist.EMAIL_ENTRY_RETENTION_DAYS`). Long enough that a blocked sender can't just come back after a few weeks, short enough to justify as necessary under Art. 6(1)(f). Domain entries keep "until an admin removes them": a domain names a mail provider or a spam operation, not usually one person, and making the operator re-block a spam domain every two years would buy little privacy.
- **Enforcement in two steps.** `_load` (the cached hot-path set) ignores expired email entries, so the block ends exactly on the day, independent of any job. The rows are deleted by `blocklist.purge_expired`, run on the existing throttled OTP cleanup sweep (`otp_codes._cleanup_expired_codes`, ADR-0010) — no new job, same cadence-bounded cost. The cache isn't invalidated after the purge; it no longer contains those entries anyway.
- **Export**: `blocklist_entries` in `AdminUserExport` lists the live entries matching the account's address — its own email entry and its domain's — with kind, value, reason, created_at and expires_at. Not `created_by`: that's the admin's address, not the learner's data. The export only exists while the account does; a request from someone whose account is already deleted is answered by hand (RUNBOOK → Data-subject requests).
- **Datenschutzerklärung**: own section "Sperrung bei Missbrauch" (purpose, Art. 6 Abs. 1 lit. f, survives account deletion, 24 months, objection under Art. 21).

**Rejected — delete the email entry with the account:** the most frequent reason to block is a throwaway signup that the operator then deletes; tying the entry to the account would undo the block in that exact case.
