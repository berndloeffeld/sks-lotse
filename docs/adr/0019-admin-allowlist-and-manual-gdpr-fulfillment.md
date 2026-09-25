# 0019. Admin email allowlist and manual GDPR fulfillment

Status: Accepted; amended by [ADR-0047](0047-totp-step-up-for-admin-area.md) (the admin area also needs a recent TOTP check)

## Context

`frontend/src/pages/PrivacyPage.tsx` already promises learners their DSGVO rights — Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21) — exercised by emailing the operator. Until now there was no way to actually act on such a request except a manual DB query. We need a real mechanism for the two rights that matter most in practice: Auskunft/Datenübertragbarkeit (export what's stored) and Löschung (delete the account).

This is a solo-developed project (see ADR-0001, ADR-0002) with a single operator and, for the foreseeable future, a single admin. Two design questions needed an answer:

1. How does the app recognize an admin — a new authorization concept, or something reusing existing infrastructure?
2. Who performs a delete/export — the learner themselves (self-service), or the operator, on request?

## Decision

**Email allowlist, not a DB role.** A new `ADMIN_EMAILS` setting (`backend/app/core/config.py`), parsed the same way as the existing `ALLOWED_EMAILS` private-beta allowlist, but with **inverted default semantics**: unset/empty means *no one* is an admin (fail closed), whereas `ALLOWED_EMAILS` unset means *everyone* passes (open). A new `require_admin` dependency (`backend/app/core/jwt.py`) composes the existing `get_current_user` (valid JWT) with this allowlist check. No migration, no second authorization model living in the database next to `token_version`-based session state.

**Admin-driven manual fulfillment, not learner self-service.** The learner still emails the operator, as the Datenschutzerklärung already says; the operator (now authenticated as an admin) looks the account up by email on a new `/admin` page, and exports or deletes it. There is no "delete my account" / "download my data" button for the learner themselves.

Scope for this iteration: only Auskunft/Portabilität (one export endpoint covers both — it returns the same JSON either way) and Löschung. Berichtigung and Widerspruch remain manual-only (direct DB edit on the rare request) — not worth a UI for how infrequently they're expected to occur at this stage.

## Consequences

**Easier:** ships without a schema change, reuses the exact allowlist pattern already proven for `ALLOWED_EMAILS`, and the admin surface is small (one page, three endpoints) because it's built for exactly one operator acting on exactly one account at a time.

**Harder / deliberately deferred:** the allowlist approach doesn't scale to "some admins can only view, others can also delete" — that needs a real role/permission model, which is a schema change whenever it's actually needed. Self-service deletion (a materially larger, riskier surface — irreversible, unauthenticated-adjacent in the sense that a learner could trigger it accidentally) is deferred; if it's ever wanted, it's a different, bigger feature, not an extension of this one.

**Rejected alternative — `is_admin` column on `User`:** more flexible (supports multiple differently-scoped admins later), but requires a migration and introduces a second place authorization state can drift from the JWT/session model, for a benefit (multiple admins) that doesn't exist yet on a solo-developer project. Revisit if/when a second admin is actually needed.

**Cascade-delete note (implementation detail worth recording):** `question_progress.user_id` has `ondelete="CASCADE"` at the DB level, but that only fires reliably against Postgres — the backend test suite runs on SQLite in-memory, which doesn't enforce FK actions the way the ORM-level `session.delete()` might assume. The delete endpoint therefore deletes `question_progress` rows explicitly before the `User` row, rather than relying on the FK, so behavior is identical (and test-covered) on both engines.
