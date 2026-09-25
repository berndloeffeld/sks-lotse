# 0043. Token-based AI-grading monetization, with fixed prices

Status: Accepted — partially supersedes [ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md) (the AI-grading add-on is now pay-per-use, not a boolean unlock) and [ADR-0031](0031-ai-answer-check-with-claude-haiku.md) (drops the `ai_grading_enabled` entitlement it introduced); both stand otherwise. Its "keep the weekly budget alongside tokens" decision is reversed by [ADR-0044](0044-drop-weekly-ai-check-budget.md). Amended by [ADR-0048](0048-stripe-hosted-checkout-with-webhook-fulfilment.md): token packages are bought via Stripe Checkout (the "no payment provider yet" scope note below is historical).

## Context

`ai_grading_enabled` and `ads_removed` were plain booleans the operator flipped by hand on `/admin`, "until payment exists" (ADR-0006, ADR-0031). No payment integration exists, and pricing was explicitly left open. The operator now wants to move the AI-based grading add-on from a boolean unlock to pay-per-use **tokens** (1 token = 1 automatically graded answer) instead of a subscription, keep "Werbefrei" as a one-time fee, and fix real prices.

Scope decided for this change specifically (see also ADR-0006/0031, which cover the rest of the entitlement design):
- Automatically grading an entire exam in one go does not exist yet (only self-assessment does, ADR-0029/[0037](0037-exam-richtig-answers-feed-the-lernstand.md)) and is **not** built here. Its intended price (25 tokens instead of 30, one per question) is recorded below so it's fixed once that feature lands.
- No payment-provider integration (e.g. Stripe) yet — purchases stay an off-platform, operator-handled process, exactly like the boolean flags before it. The data model is shaped so a future Stripe webhook can write to it the same way a manual admin grant does now.
- The existing weekly AI-check budget (`ai_checks_used`/`ai_checks_weekly_limit`, ADR-0036) stays **in addition to** the token balance, as a second, independent abuse brake — not replaced by it.
- Prices are operator-editable at runtime (`/admin/settings`), not hard-coded, so they can be tuned without a deploy.

## Decision

- **`users.token_balance`** (int, default 0) replaces the `ai_grading_enabled` boolean. `POST /questions/{id}/ai-grade` (`app/api/v1/grading.py`) requires `token_balance >= 1`, reserves one token via `app/services/token_wallet.py` (row-locked reserve/refund, mirroring `app/services/ai_quota.py`'s pattern for the weekly budget) right before the LLM call, and refunds it if the call fails — same "a check that never happened costs nothing" guarantee as the weekly budget. The response's `tokens_remaining` complements `remaining_this_week`. A too-low balance answers **402 Payment Required** (previously 403 for "not unlocked").
- **`purchases`** table (`app/models/purchase.py`): one ledger row per grant — token packages, the Werbefrei fee, the signup bonus, and a bare admin correction (`product`, `tokens_granted`, `amount_eur_cents`, `granted_by` — `signup` | `admin_manual` | future `stripe`, `admin_user_id`, `stripe_payment_intent_id` for later). One model for every kind of grant, so a future payment webhook takes the same path a manual admin grant does today, and so account deletion has one place to reason about retention (see Consequences).
- **Prices live in `app_settings`** (`app/core/pricing.py`, `app/services/pricing.py`), the same key-value table the weekly-budget default already uses, with a code default as fallback — no new table, no seeding migration. Read by the admin settings endpoint and a **new, deliberately unauthenticated** `GET /api/v1/pricing` (cached in-process for 60s — simpler than explicit cache invalidation from the settings-update endpoint, given how rarely prices change) that the landing page and an in-app upsell can call before login. This joins `POST /auth/otp/request`, `POST /auth/otp/verify` and `/health` as the only intentionally open routes (CLAUDE.md → Auth & rate limiting).
- **Fixed starting prices** (admin-editable afterwards):

  | Product | Amount | Price |
  |---|---|---|
  | Werbefrei (one-time) | — | 5,00 € |
  | Signup bonus | 6 tokens | free |
  | Paket S | 20 tokens | 2,99 € |
  | Paket M | 50 tokens | 5,99 € |
  | Paket L | 100 tokens | 9,99 € |
  | Paket XL | 200 tokens | 16,99 € |
  | (future) full-exam auto-grading | 25 tokens (vs. 30 individually) | — |

  The signup bonus (6 tokens) is deliberately small: enough to try a few checks, not enough that creating a second account (email verification + OTP) is worth it instead of buying a package.
- **No purchase flow yet.** The public prices are a teaser only ("bald verfügbar") — the frontend shows no buy button. Until a payment provider is wired up, the operator credits tokens/Werbefrei by hand via `PATCH /admin/users/{id}` (`grant_tokens`, `grant_amount_eur_cents`), exactly as the two booleans were flipped by hand before.

## Consequences

- `ai_grading_enabled` is dropped from the schema/API entirely (migration `1f2fe299ee32`) rather than kept alongside `token_balance` — one entitlement signal, not two that could disagree.
- **Account deletion retention**: a `purchases` row backed by real money (`amount_eur_cents IS NOT NULL`) is **anonymized** (its `user_id` cleared) rather than deleted on account deletion, since German bookkeeping law (§147 AO/§257 HGB) can require keeping payment records for years — not legal advice, review with counsel before this is relied on commercially. A row with no money behind it (the signup bonus, a goodwill admin correction) is deleted like the rest of the account's data. `services/user.py::delete_user_and_progress` also severs `admin_user_id` on any purchases this account granted to *other* users, so a deleted admin's own row doesn't block the delete via that FK.
- **AGB/Datenschutzerklärung need updating** before this goes live: the AGB's placeholder "future paid features" language (§4/§8) has to name real products, prices, and how the off-platform purchase/Widerrufsrecht works for digital goods; §10 already commits to re-asking for consent on "the introduction of payment obligations" — bumping `CURRENT_AGB_VERSION` re-triggers that for every existing account. The Datenschutzerklärung needs a section for the new purchase records. Not done as part of this ADR's code change; tracked as follow-up work.
- Rejected: keeping the weekly-budget mechanism as the sole brake and dropping it in favor of tokens — tokens cap *spend*, not *request rate*, so both stay (see Context).
- Rejected: a dedicated `packages` DB table for prices — `app_settings`'s existing key/value shape is enough for four fixed package slots (CLAUDE.md → avoid pipeline overkill for a small, rarely-changed config surface).
- Revisit when: a payment provider is chosen (Stripe is the assumed target given the data model, but not committed to) — that follow-up also finally builds the full-exam auto-grading feature the 25-token price above is reserved for.
