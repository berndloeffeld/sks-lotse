# 0011. A dev-only OTP peek endpoint, to let external integration tests complete the login flow

Status: Accepted

## Context

The backend's pytest suite (`backend/tests/`) already covers the OTP login flow end-to-end, including `POST /auth/otp/verify`, by monkeypatching `app.services.email.send_otp_email` in-process to capture the code before it would otherwise go to Resend (see `_capture_otp` in `backend/tests/test_auth.py`).

We also wanted a way to run the same kind of integration checks *externally* — a Postman/Newman collection against a real, running local server — for two reasons: it's runnable without a Python environment (useful in CI or for anyone poking at the API by hand), and it doubles as a portfolio artifact (see CLAUDE.md → Architecture Documentation) showing the API's actual behavior, not just its shape.

A real external HTTP client can't do what the pytest suite does: `otp_codes.code_hash` is a one-way HMAC (see `hash_code` in `backend/app/core/otp.py`) — the plaintext code exists only for the instant `request_otp` generates it, then either goes out via Resend or is lost. Options considered:

1. **Read the code from a real inbox** — configure a real Resend key and a real test mailbox locally, have the test runner poll it via Resend's API. Accurate (proves the exact same code path as production), but couples every local test run to an external email provider, a verified sending domain, and mailbox access — heavy for what's meant to be a quick local/CI check, and the tests would be flaky against real-world email delivery latency.
2. **Log the code to the server console in non-production** and have the test runner read it back some other way. Doesn't fit an HTTP-only tool like Postman without extra plumbing (tailing process output), and moves a secret-shaped value into logs for no real benefit over option 3.
3. **A dev-only "peek" endpoint** — `GET /api/v1/auth/otp/_dev-peek?email=`, returning the plaintext code last generated for that email. Simplest to consume from Postman: one more HTTP call, no new tooling.

## Decision

Go with option 3. `GET /api/v1/auth/otp/_dev-peek` (`backend/app/api/v1/auth.py`):

- Stores the plaintext code in an in-memory dict on `app.state` (`_dev_otp_codes`, mirroring the existing `app.state.cache_entries` / `app.state.rate_limit_hits` pattern in `app/core/cache.py` / `app/core/rate_limit.py`), keyed by lowercased email, overwritten on each new `otp/request`. Never persisted, never sent anywhere else.
- Is only ever *populated* when `not settings.is_production` — in production the dict simply never gets an entry, so there's no standing plaintext-code store in the deployed app even in memory.
- 404s outright when `settings.is_production` is true, the same treatment `_docs_kwargs()` (`app/main.py`) already gives Swagger/ReDoc/the raw OpenAPI schema.
- Is declared with `include_in_schema=False`, so it never appears in `openapi.json` and therefore never lands in the auto-generated API-reference Postman collection (`postman/sks-lotse.postman_collection.json`, regenerated from that schema) — it isn't part of the public API surface, just a local test fixture wearing an HTTP endpoint.

The external integration-test Postman collection (`postman/integration-tests.postman_collection.json`) uses it to complete the real `otp/request` → `_dev-peek` → `otp/verify` round-trip against a locally running server (`ENVIRONMENT=development`).

## Consequences

- The external Postman suite can now exercise the *entire* auth flow — including token issuance and logout — not just the parts observable without a code, closing the gap pytest already covered.
- A new, unauthenticated endpoint exists in the codebase, even though it's inert in production. Its blast radius if the production gate were ever accidentally removed: it discloses OTP codes to anyone who can reach the API, i.e. full login bypass — the same category of risk as accidentally shipping Swagger UI, but higher severity, so `settings.is_production` must keep gating it (the existing pytest coverage asserts this both ways: 404 in production, and that nothing gets written to the store at all while production).
- Coupled to the in-memory, single-process assumption already established for rate limiting and caching (see [ADR-0007](0007-in-memory-per-ip-rate-limiting.md), [ADR-0009](0009-in-process-cache-for-question-catalog.md)) — fine for the same reason those are: a single Render instance, dev-only usage.
- Still doesn't prove the real Resend send path works (option 1 would have) — that's unchanged, unverified-by-this-suite territory; a manual check against a real inbox remains the way to confirm email delivery itself.

## Addendum (2026-09-17)

The gate described above was `settings.is_production` (a string equality on `ENVIRONMENT`), which failed *open*: any value other than exactly `production` — a `prod` typo on Render — would have enabled this endpoint, i.e. the login-bypass scenario named under Consequences. Two changes close that: `ENVIRONMENT` is now a closed set (`development`/`test`/`production`) validated at startup, and the endpoint (like the docs) is gated on an opt-in allowlist, `settings.exposes_dev_tooling` (`development`/`test` only), rather than on "not production".

## Addendum (2026-09-22)

One gap remained: `ENVIRONMENT` itself defaults to `development`, so a Render service where the variable was forgotten (a new or cloned service, an edited dashboard) would have enabled this endpoint again. `exposes_dev_tooling` is therefore also false whenever `RENDER` is set (Render sets it on every service itself), and `is_production` is true there — so the `Secure` cookie flag and the production CORS origins can't be lost the same way.
