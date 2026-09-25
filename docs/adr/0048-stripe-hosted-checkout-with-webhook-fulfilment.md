# 0048. Stripe Hosted Checkout with webhook fulfilment

Status: Accepted — amends [ADR-0043](0043-token-based-ai-grading-monetization.md): token packages can now be bought by the learner via Stripe, no longer only credited by hand. Werbefrei stays a manual grant ("bald verfügbar").

## Context

ADR-0043 fixed the token packages and prices and shaped the ledger (`purchases`, `granted_by`, `stripe_payment_intent_id`) so a payment provider could write to it later. The operator now wants learners to buy S/M/L/XL themselves. The operator also wants to test with real Stripe in production before any learner sees a buy button.

## Decision

- **Stripe Hosted Checkout** (`mode="payment"`), opened by `POST /payments/checkout`, which returns the Stripe URL; the SPA sends the browser there itself (a `fetch` doesn't follow a redirect to another origin usefully).
- **`price_data` instead of Price ids.** The amount comes from `app_settings` (`/admin/settings` stays the only place prices are set); the Stripe *product* only supplies name, description and image (`docs/stripe/README.md`). The token amount is written into the session's `metadata` at creation, so a price change while the learner is on the Stripe page shifts nothing.
- **A three-step flag `STRIPE_CHECKOUT`** (`off` | `admins` | `on`, a typo fails at startup). `admins` lets `ADMIN_EMAILS` buy for real, so the whole flow can be verified in production first. It also fails closed when the secret key or the package's product id is missing.
- **Fulfilment only in the webhook** (`checkout.session.completed` and `…async_payment_succeeded`, signature-verified), never on the success redirect — that URL is reachable without paying. Only `payment_status == "paid"` credits.
- **Idempotent over the Payment Intent**: a lookup catches redelivery, a unique index on `purchases.stripe_payment_intent_id` catches two parallel deliveries (the `IntegrityError` is rolled back and counts as done).
- **The webhook is independent of the flag**, so a session opened while the flag was on is still credited after it is switched off.
- **Confirmation mail**: after the credit, a background task sends the learner a confirmation (package, price, time, payment reference, the waiver, link to the AGB) through Resend — the confirmation on a durable medium the waiver needs (§ 356 Abs. 5 Nr. 2, § 312f Abs. 3 BGB). It is sent only when this delivery actually credited, so a redelivery doesn't mail twice; a send failure is logged (`confirmation mail … failed, send it by hand`) and doesn't undo the credit.
- **Withdrawal waiver**: the request must carry `waive_withdrawal: true` (§ 356 Abs. 5 BGB, "beim Kauf gesondert eingeholt" in the AGB); it is also stored in the session metadata.
- The Stripe client is created without an API version (the SDK's pinned one).

## Consequences

- Prices exist in one place; the Stripe dashboard's product prices are unused.
- A learner who deleted their account between paying and the webhook is logged and not credited; the refund is manual (runbook).
- Refunds don't take tokens back automatically; an admin corrects the balance on `/admin`.
- Rejected: Price ids (a second source of truth for prices), crediting on the success redirect (forgeable), a Stripe `customer` object per user (not needed for one-time payments).
- Before `STRIPE_CHECKOUT=on`: privacy policy (Stripe as recipient/third country), AGB (purchase via Stripe), bump `CURRENT_AGB_VERSION` — see the runbook checklist.
