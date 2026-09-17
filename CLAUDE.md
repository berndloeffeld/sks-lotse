# SKS Lotse — Claude Code Context

## What is SKS Lotse?
SKS Lotse is a web app to prepare for the theoretical exam of the German SKS (Sportküstenschifferschein) sailing license. The official exam catalog is free-text (not multiple choice): the learner writes an answer and must judge for themselves whether it's close enough to the official model answer. SKS Lotse uses an LLM to grade the learner's free-text answer against the official answer and explain what was missing or wrong.

**Differentiation vs. existing apps** (SKS-Buddy, official SKS App both already offer AI-graded free text): web-only (no app store) and speech-to-text as an alternative to typing an answer. Monetization is a freemium model — see [Monetization](#monetization) — a reversal of the original single-tier, ad-only concept; worth revisiting given competitors already include AI grading without gating it.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + TypeScript |
| Backend | Python 3.12 / FastAPI |
| Database | PostgreSQL 16 (Render, Frankfurt EU) |
| Auth | Required — no anonymous access. SSO (Google/Facebook/X) or email + OTP, JWT-based session |
| Answer grading (LLM) | OpenAI API (GPT model) — grades free text against official answer, returns score + explanation |
| Speech-to-text | Web Speech API (browser-native, Chromium-based browsers) — no backend/cloud STT |
| Ads | Google AdSense |
| Analytics | Countly Flex Free (EU private cloud, bis 500 MAU) |
| Hosting | Render (Frankfurt EU — all services) |
| CI/CD | GitHub Actions → auto-deploy on push to main |

---

## Repository Structure

```
sks-lotse/
├── backend/
│   ├── app/
│   │   ├── api/        # Route handlers (/api/v1/...)
│   │   ├── core/       # Config, security, JWT, dependencies
│   │   ├── models/     # SQLAlchemy ORM models
│   │   ├── schemas/    # Pydantic request/response schemas
│   │   ├── services/   # Business logic (grading, catalog import)
│   │   └── main.py     # FastAPI app entry point
│   ├── alembic/        # Database migrations
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/      # Route-level components
│   │   ├── components/ # Reusable UI components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── store/      # Zustand state management
│   │   ├── api/        # API client + TypeScript types
│   │   └── main.tsx
│   └── package.json
├── docs/               # Markdown documentation, question catalog source PDFs
├── CLAUDE.md           # This file
└── .github/workflows/  # GitHub Actions CI/CD
```

---

## Core Flow

1. Learner logs in (SSO via Google/Facebook/X, or email + OTP) — required before using the app.
2. Learner is shown a question from the official SKS catalog.
3. **If the account has AI-based grading unlocked**: learner answers via text input or speech-to-text (Web Speech API transcribes locally in-browser before submit); the answer is sent to the backend, which calls the LLM with the question, the official model answer, and the learner's answer; the LLM returns a graded score (e.g. "80% correct") plus an explanation of what was missing or incorrect.
4. **If not**: the official model answer is shown directly for the learner to self-compare against — no writing step, no LLM call.
5. Progress is synced server-side against the logged-in account. If the account hasn't paid to remove ads, ads (Google AdSense) are shown.

---

## Question Catalog

- Source: official SKS question catalog, provided as PDF (questions + official model answers).
- Needs a one-off (or repeatable) import pipeline: PDF → structured question/answer records in the database.
- Some questions reference nautical charts/images — these need to be extracted and stored (Cloudflare R2, TBD — not yet decided whether needed for MVP).

---

## Monetization

Freemium, with two independent paid add-ons (not bundled — a learner can buy either, both, or neither):

- **Remove ads** (Google AdSense) — default (free) accounts see ads.
- **Unlock AI-based grading** — default (free) accounts don't get LLM scoring; they write (or just read) the question and are shown the official model answer directly for self-assessment instead (see Core Flow).

All four combinations are valid: ads+no AI grading, ads+AI grading, no ads+no AI grading, no ads+AI grading. Pricing model (one-time vs. subscription) and price points: TBD.

See [docs/adr/0006-mandatory-login-and-feature-gated-monetization.md](docs/adr/0006-mandatory-login-and-feature-gated-monetization.md) for the reasoning behind this and the reversal of the original single-tier model.

---

## Accounts

- Login is required to use the app at all — no anonymous access.
- Sign-in via SSO (Google, Facebook, or X) or email + OTP (passwordless).
- JWT-based session after sign-in. Progress is always synced server-side against the account (no browser-only anonymous progress).
- Entitlements (ads removed? AI grading unlocked?) are attached to the account — see [Monetization](#monetization).

---

## Branch Strategy

Trunk-based development:
- `main` — trunk, single source of truth, auto-deploys to Render
- `feature/*` — short-lived feature branches, merge back to main via PR
- No long-lived branches
- Never commit directly to `main`
- Every change, however small, goes on a dedicated `feature/*` branch cut from `main`; open a PR to merge back

---

## Development Conventions

### Working Directory
All file edits must be made in the canonical project root:

```
/Users/berndloffeld/Projects/sks-lotse
```

Never write to a git worktree path (e.g. `.claude/worktrees/...`). If Claude Code is invoked from a worktree, edits must still target the real project root above.

### Security Scanning (Aikido)
Aikido Security is connected to this GitHub repo.

- A PR must not be merged while Aikido reports open findings, unless the finding is explicitly triaged/accepted first.
- **Not yet technically enforced**: the repo is private on GitHub's free plan, which does not support branch protection / required status checks. This is a manual check for now — verify Aikido is green before merging a PR.
- Revisit once on GitHub Pro (or equivalent): add Aikido's check as a required status check in branch protection on `main`.
- `scripts/check_aikido.sh` queries the Aikido API directly for open findings on the repo (whichever branch Aikido last scanned) — run it instead of asking for a dashboard screenshot. Needs `.env.aikido` (gitignored, not committed) with `AIKIDO_CLIENT_ID` / `AIKIDO_CLIENT_SECRET` from an API client created at [app.aikido.dev/settings/integrations/api/aikido/rest](https://app.aikido.dev/settings/integrations/api/aikido/rest).

### Test Coverage
Backend enforces a minimum of **80% coverage (lines + branches)** via `pytest-cov` (`backend/pyproject.toml`, `--cov-branch --cov-fail-under=80`) — `pytest` fails the run if coverage drops below that.

- `.github/workflows/backend-ci.yml` runs the backend test suite (incl. the coverage gate) on every push to `main` and on every PR.
- **Not yet a hard merge gate**: same GitHub free-plan limitation as Aikido above — no required status checks on a private repo. Verify the workflow is green before merging a PR.
- API endpoint tests use an in-memory SQLite DB (`backend/tests/conftest.py`, `get_db` override) — no Docker/Postgres needed to run the suite.
- Because of that, the suite never runs the Alembic migrations. The separate `migrations` CI job does, against a real Postgres 16 service: `alembic upgrade head`, `alembic check` (fails if models and migrations have drifted — i.e. a model change without a migration), `alembic downgrade base`, `alembic upgrade head`.

### Linting & Formatting
Backend uses `ruff` (`backend/pyproject.toml`, `[tool.ruff]`) for both linting and formatting.

- `ruff check .` and `ruff format --check .` run as part of `.github/workflows/backend-ci.yml` on every push to `main` and on every PR — same not-yet-a-hard-gate caveat as above.
- Before committing backend changes: `ruff check --fix .` then `ruff format .` — or let pre-commit do it: `.pre-commit-config.yaml` runs ruff on staged backend files and refuses commits on `main` (a local stand-in for the branch protection the free plan lacks). One-time setup per clone: `pre-commit install` (the package is in `requirements-dev.txt`).

### Python version
`.python-version` (repo root) is the single source for local dev and CI (`actions/setup-python` → `python-version-file`). `render.yaml` still pins `PYTHON_VERSION` explicitly (see the comment there) — bump both together.
- `B008` (flake8-bugbear: no function calls in argument defaults) is deliberately ignored — it flags FastAPI's `Depends(...)` default-argument pattern, which is correct FastAPI usage, not a bug.

### Architecture Documentation
This project doubles as a reference sample (incl. for job applications), so architectural reasoning is recorded, not just the resulting code.

- **`docs/ARCHITECTURE.md`**: living current-state overview (components, diagram). Describes *what exists*. Keep it accurate to the actual state of the repo — shrink the "Not yet built" list as things land, don't write aspirationally.
- **`docs/adr/`**: Architecture Decision Records, one file per decision, numbered sequentially (`NNNN-title.md`), using `docs/adr/template.md` (Context / Decision / Consequences). Describes *why*. See [docs/adr/0001-use-architecture-decision-records.md](docs/adr/0001-use-architecture-decision-records.md) for the full rationale.
- Write an ADR when a decision would be genuinely costly to reverse or non-obvious to a future reader (e.g. auth flow, grading-request architecture, deployment topology) — not for routine implementation choices already covered elsewhere in this file.
- Superseding a decision: add a new ADR referencing the old one, mark the old one "Superseded by ADR-NNNN". Don't edit history away.

### Postman Collection
`postman/sks-lotse.postman_collection.json` is generated from the FastAPI app's live OpenAPI schema — never edit it by hand, it will just get overwritten.

- Regenerate after any API change: `./scripts/generate_postman_collection.sh` (needs the backend venv set up and Node/npx available), then commit the result.
- `.github/workflows/backend-ci.yml` (`postman-collection` job) regenerates it in CI and fails the build if the committed file is out of date — same not-yet-a-hard-gate caveat as the other CI checks above.
- Every request in the collection uses a `{{baseUrl}}` variable (collection variable, default `/`). `postman/local.postman_environment.json.example` and `postman/production.postman_environment.json.example` are static, hand-maintained templates. **Copy each to the same name without `.example`** (gitignored — real copies hold live secrets, e.g. a JWT for testing protected endpoints) and import *those*, then switch between them via Postman's environment dropdown. Update the production URL in the copy if a custom domain is wired up later.
- When importing in Postman: use a plain one-off **Import**, not the Git-sync "Local Mode" — that mode (a) wants to upgrade the file to Postman's v3 YAML format, which would conflict with the JSON the generator script produces and the CI freshness check expects, and (b) writes whatever you enter in the app back to disk, which is exactly how a real secret ended up in a tracked file once already (the `X-Access-Key` this project used before real JWT auth landed — renaming the committed files to `.example` and gitignoring the real ones makes that impossible now).

### Integration Tests (external / non-pytest)
`postman/integration-tests.postman_collection.json` is a separate, hand-written Postman collection — not the OpenAPI-generated API reference above. It black-box tests a real, running local backend over HTTP: auth guards, CORS, security headers, the full OTP login round-trip (request → verify → `/me` → `/logout`), and the OTP rate limit actually tripping. Point of it: runnable without a Python environment, e.g. in CI or by hand.

- Run it with `./scripts/run_integration_tests.sh` (wraps `newman run ... -e postman/local.postman_environment.json`, via `npx`) against an already-running local server (`cd backend && uvicorn app.main:app --reload`). Not wired into CI yet — a manual/on-demand check for now, same not-yet-a-hard-gate situation as the other checks in this file.
- The OTP round-trip needs the real, one-time plaintext code — pytest gets this for free by monkeypatching the email service in-process; an external HTTP client can't. `GET /api/v1/auth/otp/_dev-peek` (`backend/app/api/v1/auth.py`) exists to bridge that gap: it returns the last code generated for an email, 404s outright when `ENVIRONMENT=production`, is never populated at all in that case either, and is excluded from the OpenAPI schema so it never surfaces in the API reference collection above. See [docs/adr/0011](docs/adr/0011-dev-only-otp-peek-endpoint-for-external-integration-tests.md).
- Not covered: `RedirectSecondaryDomainsMiddleware` (the canonical-domain redirect) — it keys off the `Host` header, which Postman/Newman silently drop rather than send as given (a restricted header, same idea as a browser's `fetch()`). Verify that one manually: `curl -i -H 'Host: sks-lotse.com' {{baseUrl}}/health`.
- Run order matters within the collection (documented in its own description too): Auth Flow's token is reused by Questions and Logout, Logout must come after both since it deliberately invalidates that token, and Rate Limiting must run last since it deliberately exhausts the OTP-endpoint quota for the caller's IP for the next hour.
- **Keep it up to date.** Unlike `sks-lotse.postman_collection.json`, this one is hand-written, not generated from the OpenAPI schema — nothing regenerates or freshness-checks it automatically. When auth/CORS/rate-limit/questions/security-header behavior changes, update the matching request and its `pm.test` assertions here by hand, in the same PR as the code change, the same way `backend/tests/` gets updated alongside it.

### Deployment (Render)
Provisioned as code via `render.yaml` (repo root) — see [docs/adr/0005-render-deployment-topology.md](docs/adr/0005-render-deployment-topology.md) for the reasoning. One web service (backend) + one managed Postgres, Frankfurt region, production only (no staging yet).

One-time manual steps (account-level actions, done by the project owner, not by Claude Code):
1. Connect the GitHub repo to a Render account.
2. "Deploy from Blueprint" using `render.yaml`.
3. Set the `sync: false` secrets (`JWT_SECRET`, `OPENAI_API_KEY`, `ADSENSE_CLIENT_ID`, `RESEND_API_KEY`, `ALLOWED_EMAILS`) in the Render dashboard — never commit their values.
4. Point the purchased domains (`sks-lotse.de` etc., see Naming / Domain below) at the Render service once it's live.

After that, every commit to `main` auto-deploys (`autoDeployTrigger: commit`).

### Auth & rate limiting
Every `/api/v1/*` route requires a valid JWT (`Authorization: Bearer ...`) except `POST /auth/otp/request` and `POST /auth/otp/verify` (which can't require one — that's how a caller gets one) — see `backend/app/core/jwt.py` (`get_current_user`) and `backend/app/api/v1/questions.py` for how a router opts in via `dependencies=[Depends(get_current_user)]`. `/health` has no auth at all, for Render's own reachability checks.

Each user has a `token_version` counter (`backend/app/models/user.py`); every issued access token embeds the version it was minted with, and `get_current_user` rejects a token whose embedded version doesn't match the user's current one. `POST /auth/logout` (authenticated) increments it, which invalidates every access token issued for that user up to that point in one step — no separate token blacklist table. There's still no refresh-token flow (re-authenticating means requesting a new OTP), but a leaked/compromised token can now be revoked without waiting out its full TTL.

There used to be a temporary `X-Access-Key` header gate in front of the whole API (`backend/app/core/security.py`) as a stopgap before real auth existed — it's been removed now that JWT auth covers the API; `ACCESS_GATE_KEY` is no longer a valid env var.

`backend/app/core/rate_limit.py` adds a per-IP request cap on top of auth: a generous blanket limit across all of `/api/v1` (guards against basic scraping/bots without affecting normal use), plus a much tighter override specifically on `/auth/otp/request` (bounds cost/spam on the email-sending path). In-memory, not Redis, no reverse proxy in front — see [docs/adr/0007](docs/adr/0007-in-memory-per-ip-rate-limiting.md) for why.

### Data Layer Conventions
Apply these four checks whenever adding or changing a database table — going forward, not just at initial design time:

- **Temporary/transient data needs cleanup.** If a table accumulates rows that are only useful for a bounded time (codes, tokens, sessions, request logs), decide how they get deleted before shipping the feature, not after the table grows unbounded. Doesn't have to be a scheduled job — piggybacking cleanup on an existing write path (delete-on-insert) is a legitimate, infrastructure-free answer for an MVP at this scale; run it as a background task (`BackgroundTasks.add_task`) rather than inline if the delete would otherwise add latency to that request, and see the throttling rule below so its frequency doesn't scale with request volume. Example: `otp_codes` cleanup in `request_otp` ([docs/adr/0010](docs/adr/0010-opportunistic-otp-code-cleanup.md)).
- **Index for the read pattern, not just uniqueness.** When a table will see meaningful read volume, check the actual query shape (equality vs. range, which columns together, which column(s) each *distinct* query filters on) and index accordingly — a composite index in filter/sort order usually beats several single-column indexes for queries that share a filter prefix, but a query with an unrelated filter (no shared leading column) still needs its own index; one composite can't cover every access pattern on a table. Also drop a single-column index once a composite index makes it a redundant subset. Example: `otp_codes` ended up with `(email, created_at)` for the two email-scoped lookups, plus a separate `expires_at` index for the cleanup sweep, which filters on neither column those share.
- **Gate opportunistic/periodic maintenance work that piggybacks on request traffic**, so its cost is bounded regardless of how often the triggering endpoint gets called — under heavy load, "once per request" for something that only needs to run every few minutes is wasted work, not free just because it avoided a scheduled job. Use `cache.throttle(app, key, min_interval_seconds)` (`backend/app/core/cache.py`) to cap it to a cadence, the same practical effect as a cron job without standing up a scheduler. Reach for a real scheduler (a Render Cron Job) instead only once the app has one for other reasons — not preemptively for this alone. Example: `otp_codes` cleanup throttled to once per `OTP_CLEANUP_MIN_INTERVAL_SECONDS` ([docs/adr/0010](docs/adr/0010-opportunistic-otp-code-cleanup.md)).
- **Consider caching for read-heavy, rarely-written data**, local (in-process) first — no new infrastructure until there's a concrete reason for it (multiple instances, restarts frequent enough to matter) — but behind an interface that could swap to a shared store like Redis later without callers changing. `backend/app/core/cache.py` is that interface; see [docs/adr/0009](docs/adr/0009-in-process-cache-for-question-catalog.md) and [docs/adr/0007](docs/adr/0007-in-memory-per-ip-rate-limiting.md) (the rate limiter established the same local-first-but-swappable pattern for a different kind of state).

---

## Environment Variables (backend)

```
DATABASE_URL=
ENVIRONMENT=
JWT_SECRET=
JWT_ACCESS_TOKEN_EXPIRES_MINUTES=
RESEND_API_KEY=
EMAIL_FROM_ADDRESS=
ALLOWED_EMAILS=
OTP_LENGTH=
OTP_TTL_MINUTES=
OTP_MAX_ATTEMPTS=
OTP_RESEND_COOLDOWN_SECONDS=
OTP_REQUEST_WINDOW_MINUTES=
OTP_MAX_REQUESTS_PER_WINDOW=
OTP_CODE_RETENTION_HOURS=
OTP_CLEANUP_MIN_INTERVAL_SECONDS=
RATE_LIMIT_OTP_MAX_REQUESTS=
RATE_LIMIT_OTP_WINDOW_SECONDS=
RATE_LIMIT_DEFAULT_MAX_REQUESTS=
RATE_LIMIT_DEFAULT_WINDOW_SECONDS=
CATALOG_CACHE_TTL_SECONDS=
OPENAI_API_KEY=
ADSENSE_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
FACEBOOK_OAUTH_CLIENT_ID=
FACEBOOK_OAUTH_CLIENT_SECRET=
X_OAUTH_CLIENT_ID=
X_OAUTH_CLIENT_SECRET=
```

`ENVIRONMENT` defaults to `development` (matches local/CI); set to `production` on Render (see `render.yaml` — not a secret, committed directly) to disable Swagger UI/ReDoc/the raw OpenAPI schema (`backend/app/main.py`).

`JWT_SECRET` is a **required** env var with no insecure fallback — signs JWTs and hashes OTP codes (`backend/app/core/otp.py`). `Settings()` fails at import if it's unset at all; if it's under 32 characters while `ENVIRONMENT=production`, the app raises at startup too — a length floor rather than an exact-string blocklist, so it isn't limited to catching specific placeholder values someone thought to enumerate (`backend/app/core/config.py`). Generate a real value with `openssl rand -hex 32` (64 characters).

Email/OTP delivery is via [Resend](https://resend.com) (`RESEND_API_KEY`) — the sending domain must be verified there via IONOS DNS records before OTP emails can go out. `EMAIL_FROM_ADDRESS` defaults to `noreply@sks-lotse.de`, so it only needs to be set explicitly if that changes. `JWT_ACCESS_TOKEN_EXPIRES_MINUTES` defaults to 10080 (7 days) — there's no refresh-token flow yet, so re-authenticating is just requesting a new OTP; 7 days was chosen to bound the exposure window of a leaked token, though logout (see Auth & rate limiting above) can now revoke one immediately instead of only relying on that TTL. `ALLOWED_EMAILS` is a comma-separated allowlist for a pre-launch/private beta (case-insensitive) — leave it unset in local dev and until you actually want to restrict who can log in; `POST /auth/otp/request` silently no-ops (same generic response, no code created, no email sent) for any address not on the list. Separately and unconditionally, `otp/request` also rejects known disposable/throwaway email domains (the `disposable-email-domains` package, `backend/app/core/otp.py`) — no env var, just bundled data; bump the pinned version in `requirements.txt` occasionally since the point of the package is a current list. The OAuth client id/secret pairs above are still unused placeholders — SSO login hasn't been built yet, only email+OTP.

The OTP flow's tuning knobs (`backend/app/core/otp.py`, `backend/app/api/v1/auth.py`) are all optional env vars, defaulting to the values the code originally hardcoded: `OTP_LENGTH` (6-digit codes), `OTP_TTL_MINUTES` (10), `OTP_MAX_ATTEMPTS` (5 verify attempts before a code is rejected), `OTP_RESEND_COOLDOWN_SECONDS` (60, per-email resend cooldown), `OTP_REQUEST_WINDOW_MINUTES`/`OTP_MAX_REQUESTS_PER_WINDOW` (60/5, bounds sustained per-email abuse beyond the cooldown), `OTP_CODE_RETENTION_HOURS` (24, how long an expired code stays before cleanup deletes it — see [ADR-0010](docs/adr/0010-opportunistic-otp-code-cleanup.md)) and `OTP_CLEANUP_MIN_INTERVAL_SECONDS` (300, throttles that cleanup sweep). The per-IP rate limiter (`backend/app/core/rate_limit.py`, wired in `backend/app/main.py`, see [ADR-0007](docs/adr/0007-in-memory-per-ip-rate-limiting.md)) is similarly tunable: `RATE_LIMIT_OTP_MAX_REQUESTS`/`RATE_LIMIT_OTP_WINDOW_SECONDS` (20/3600) for `/auth/otp/request`, `RATE_LIMIT_DEFAULT_MAX_REQUESTS`/`RATE_LIMIT_DEFAULT_WINDOW_SECONDS` (300/300) as the blanket cap on the rest of `/api/v1`. `CATALOG_CACHE_TTL_SECONDS` (3600) controls how long `backend/app/api/v1/questions.py` caches the question catalog in-process before a re-import becomes visible. All of these exist so local dev/CI can loosen them (avoiding slow or flaky test runs) without touching production's stricter defaults.

---

## Naming / Domain

- Name: SKS Lotse
- Domains purchased 2026-09-16 via IONOS: `sks-lotse.de` (primary — target market/language is German), `sks-lotse.com`, `sks-lotse.global`, `sks-lotse.store`
- No conflicting product name found in search (existing competitors: SKS-Buddy, official SKS App, SBF-Fragen by Delius Klasing)
- **Open**: no formal trademark search done (DPMA/EUIPO) — recommended before committing further to branding
- `sks-lotse.de` is wired to Render (Custom Domain + IONOS DNS: `A @ → 216.24.57.1`, `CNAME www → sks-lotse-backend.onrender.com`) and live.
- `sks-lotse.com` is wired the same way and 301-redirects to `sks-lotse.de` via `backend/app/core/canonical_domain.py` (`RedirectSecondaryDomainsMiddleware`) — **not** via IONOS's paid domain forwarding (~8 EUR/month, 12-month minimum, just for SSL on the redirect). Costs nothing beyond the domain itself.
- `sks-lotse.global` and `sks-lotse.store` are purchased but **not currently used** — no DNS, no Render Custom Domain, not in `SECONDARY_HOSTS`. Add them the same way as `.com` (DNS at IONOS, Render Custom Domain, add to `SECONDARY_HOSTS`) if/when needed.

---

## Project Management

- Linear: TBD (not yet set up)
- Current phase: Phase 0 — concept & functional basics (this file)
- Next phase: Phase 1 — question catalog import pipeline + core grading flow
