# SKS Lotse — Claude Code Context

SKS Lotse is a web app to prepare for the theoretical exam of the German SKS (Sportküstenschifferschein) sailing license. The official catalog is free text: the learner writes an answer and grades it against the official model answer, optionally helped by an LLM that *suggests* a grade (the Lotsen-Check). Web-only, freemium (remove ads / unlock the Lotsen-Check, set by the operator until payment exists).

This file holds the **rules for working on the code**. Everything descriptive lives in one place each:

| Topic | Owner |
|---|---|
| What the product does, the components, data, auth, deployment as it is now, what's not built yet | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Why a decision was made (and what superseded it) | [docs/adr/](docs/adr/README.md): index with status per ADR |
| Operating production: logs, deploys/rollback, backups, secrets, DSGVO requests, one-time setup, domains | [docs/RUNBOOK.md](docs/RUNBOOK.md) |
| Question catalog: subjects, the Seemannschaft merge, images, the import pipeline | [docs/catalog-pipeline.md](docs/catalog-pipeline.md) |
| Local setup, quality-gate commands, dependency locks | [README.md](README.md) |
| Mutation testing, Postman/integration tests | [docs/mutation-testing.md](docs/mutation-testing.md), [docs/postman-and-integration-tests.md](docs/postman-and-integration-tests.md) |

When a change makes one of these wrong, fix it in the same PR — in its owner, not by adding a copy here.

## Repository layout

```
backend/    FastAPI app (app/api/v1 routes, app/services shared logic, app/core cross-cutting), alembic/, scripts/, tests/
frontend/   React + Vite + TypeScript SPA (src/pages, src/components, src/hooks, src/api, src/store, src/routes)
docs/       ARCHITECTURE.md, RUNBOOK.md, catalog-pipeline.md, adr/, the catalog PDF
postman/    generated API-reference collection + hand-written integration tests
scripts/    repo tooling (Postman generation, integration/mutation tests, dependency locks, Aikido check)
render.yaml Render Blueprint (deployment as code) · docker-compose.yml local Postgres
```

## Product rules that constrain code

- **Login is required**; no anonymous progress. Progress always lives server-side.
- **The official catalog wording is never changed** (amtliches Werk; cite ELWIS as the source). Catalog rows come only from the data migrations ([docs/catalog-pipeline.md](docs/catalog-pipeline.md)), never from the API or by hand. Topic names are transcribed from the catalog, never invented by a script or an LLM.
- **The Lotsen-Check only suggests**; the learner always confirms the grade. It sends nothing but question, official answer and the learner's answer.
- **"Gelernt" is the half-life model** (ADR-0034/0039); the UI never shows its numbers (ADR-0024).
- **Monetization flags are independent**: `ads_removed` and the `token_balance` pay-per-use balance, all four combinations valid (ADR-0006, ADR-0043). The ad script runs only where ads are shown and never on `/admin` (ADR-0027 addendum 2026-09-23).
- **Personal data** added anywhere is deleted with the account (`services/user.py:delete_user_and_progress`), included in the admin export (`services/admin_users.py`) and described in the Datenschutzerklärung.

---

## Branch Strategy

Trunk-based development:
- `main` — trunk, single source of truth, auto-deploys to Render
- `feature/*` — short-lived feature branches, merge back to main via PR
- No long-lived branches
- Never commit directly to `main`
- Every change, however small, goes on a dedicated `feature/*` branch cut from `main`; open a PR to merge back
- Merge with **squash** (the repo's convention — `main` has one commit per PR, titled `... (#NN)`); the head branch is deleted automatically.

**Branch protection on `main`** (enforced by GitHub, admins included — this is the actual merge gate):
- PR required; no approving review required; force-push and branch deletion blocked.
- **Required status checks**, matched by job name: `lint`, `test`, `migrations`, `postman-collection`. `lint` and `test` exist in both `backend-ci.yml` and `frontend-ci.yml`, so both workflows' jobs report under those names. `integration-tests` runs on every PR too but is **not** required — check it's green before merging anyway. Mutation testing isn't a PR check at all, it runs weekly (see Mutation testing below). There is no Aikido check in CI (see Security Scanning below).
- **Branch must be up to date with `main`** (strict mode): once another PR lands, the next one shows as `BEHIND` and can't merge until updated (`gh pr update-branch <N>`), which re-runs CI.
- GitHub's auto-merge is disabled in the repo settings, so `gh pr merge --auto` fails — wait for the checks, then merge.
- Neither workflow has path filters, so the required checks run (and must pass) even on docs-only PRs. A newer push to a PR branch cancels its still-running CI (`concurrency`); every job has a 15-minute timeout. The frontend `test` job also runs `npm run build` (incl. prerender), the same build Render deploys.

---

## Development Conventions

### Working Directory
All file edits must be made in the canonical project root:

```
/Users/berndloffeld/Projects/sks-lotse
```

Never write to a git worktree path (e.g. `.claude/worktrees/...`). If Claude Code is invoked from a worktree, edits must still target the real project root above.

### Design Principles

#### Avoid pipeline overkill for rare tasks
For infrequent/one-off operations (e.g. importing the SKS question catalog from PDF, which runs once or a few times total), do not build infrastructure — use a plain script instead. No pipelines, queues, task runners, or extra abstraction layers are needed for tasks that run rarely. This aligns with the general principle of avoiding premature abstraction: match the infrastructure to the actual problem, not hypothetical future complexity.

### Naming: English in code and URLs, German in the UI
Route paths, file and component names and code identifiers are English (`/pricing`, `/terms`, `/learn/focus`, `PricingPage`); only what the learner reads is German (labels, copy, page titles). A path that has to change keeps working: add it to `RETIRED_PATHS` in `frontend/src/App.tsx`, and a public one also gets a `type: redirect` in `render.yaml`. Domain terms from the catalog or the law stay as they are: subject keys like `navigation`, the exam variants, and AGB (`AgbPage`, `AgbGate`, `agb_accepted_*`).

### Security Scanning (Aikido)
Aikido Security is connected to this GitHub repo.

- A PR must not be merged while Aikido reports open findings, unless the finding is explicitly triaged/accepted first. **This is checked by hand before each merge** — there is no Aikido job in CI and no required status check for it (removed 2026-09-19: Aikido's free plan rejects API access with "This action is not allowed on the free plan", so the job failed on every PR). The `AIKIDO_CLIENT_ID`/`AIKIDO_CLIENT_SECRET` GitHub Actions secrets are unused now.
- `scripts/check_aikido.sh` queries the Aikido API directly for open findings on the repo (whichever branch Aikido last scanned) — run it locally instead of asking for a dashboard screenshot (needs a plan with API access; otherwise it prints the API error and exits 1 — use the dashboard then). Needs `.env.aikido` (gitignored, not committed) with `AIKIDO_CLIENT_ID` / `AIKIDO_CLIENT_SECRET` from an API client created at [app.aikido.dev/settings/integrations/api/aikido/rest](https://app.aikido.dev/settings/integrations/api/aikido/rest).

### Test Coverage
Backend enforces a minimum of **95% coverage (lines + branches)** via `pytest-cov` (`backend/pyproject.toml`, `--cov-branch --cov-fail-under=95`) — `pytest` fails the run if coverage drops below that. The bar sits a few points under the actual value (~99%) on purpose: high enough to catch untested new code, with room for the odd defensive branch. Raise it when the actual value settles higher; don't lower it to get a PR through — test the code.

- `.github/workflows/backend-ci.yml` runs the backend test suite (incl. the coverage gate) on every push to `main` and on every PR.
- The `test` job is a required status check on `main` (see Branch Strategy), so a coverage drop blocks the merge.
- API endpoint tests use an in-memory SQLite DB (`backend/tests/conftest.py`, `get_db` override) — no Docker/Postgres needed to run the suite.
- Because of that, the suite never runs the Alembic migrations. The separate `migrations` CI job does, against a real Postgres 18 service (same major version as production, pinned in `render.yaml`): `alembic upgrade head`, `alembic check` (fails if models and migrations have drifted — i.e. a model change without a migration), `alembic downgrade base`, `alembic upgrade head`.

Frontend enforces **90% lines / 85% branches** via Vitest's built-in coverage (`frontend/vite.config.ts`, `test.coverage.thresholds`; actual ~97% / ~91%), run with `npx vitest run --coverage`. `.github/workflows/frontend-ci.yml`'s `test` job runs `tsc -b` plus that command on every push to `main` and every PR — a required check, like the backend's `test`.

### Mutation testing
Workflow `.github/workflows/mutation-testing.yml` (jobs `backend`/`frontend`; runs **weekly** on Mondays 03:00 UTC plus manually via `workflow_dispatch`, not per PR — ~5 min / ~3 min; a failed run opens a GitHub issue "Mutation testing failed"): `./scripts/run_mutation_tests.sh gate` runs mutmut over the backend's business logic and fails below a minimum score (87% — a ratchet like the coverage gates: raise it, never lower it to get a PR through). Without `gate` the script just lists the survivors; `handlers` mutates the route handlers in a throw-away copy (mutmut skips decorated functions). The frontend equivalent is `./scripts/run_frontend_mutation_tests.sh gate` (Stryker over the logic modules, minimum 90%, also fails if the runner is broken, i.e. surviving mutants that ran no tests); it needs Vitest on 4.x, see [ADR-0035](docs/adr/0035-vitest-pinned-to-4x-for-stryker.md). Scope, reading survivors: [docs/mutation-testing.md](docs/mutation-testing.md).

**Keep the scope current.** What gets mutated is exactly `only_mutate` in `[tool.mutmut]` of `backend/pyproject.toml` — a module missing from it is silently unchecked. `backend/tests/test_mutation_scope.py` fails when a module in `app/core/`, `app/services/` or `app/api/v1/` is in neither `only_mutate` nor its `EXCLUDED` set (with reasons), or when an entry points at a file that's gone. So in the same PR:
- a new backend module with business logic (`app/core/`, `app/services/`, or an `app/api/v1/` file with undecorated helpers) is **added** to `only_mutate`;
- a renamed or deleted module is updated/removed there;
- deliberately left out (don't add): `config.py`, `main.py`, `database.py`, `models/`, `schemas/`, `catalog_seed.py`, `scripts/` — the test's `EXCLUDED` set holds the ones in the scanned directories.

Frontend: the scope is `mutate` in `frontend/stryker.config.json` (logic modules only — `src/*.ts`, `api/`, `store/`, `hooks/`; components and pages stay out for now). `frontend/src/test/mutationScope.test.ts` fails when a `.ts` file in those directories is in neither `mutate` nor its `EXCLUDED` set, or an entry's file is gone — so a new logic module is **added** to `mutate` in the same PR, and it needs its own test (Stryker only credits tests that cover the mutant).

Logic that lives inline in a route handler isn't covered by the normal run (decorated functions are skipped) — put anything sizeable into an undecorated helper, and check new handlers with `./scripts/run_mutation_tests.sh handlers`.

### Linting & Formatting
Backend uses `ruff` (`backend/pyproject.toml`, `[tool.ruff]`) for both linting and formatting.

- `ruff check .` and `ruff format --check .` run as part of `.github/workflows/backend-ci.yml`'s `lint` job on every push to `main` and on every PR — a required check.
- Before committing backend changes: `ruff check --fix .` then `ruff format .` — or let pre-commit do it: `.pre-commit-config.yaml` runs ruff on staged backend files and refuses commits on `main` (catches it locally, before the push that branch protection would reject). One-time setup per clone: `pre-commit install -t pre-commit -t pre-push` (the package is in `requirements-dev.txt`); the pre-push stage adds `mypy app` and `tsc -b`.

- `mypy app` (`[tool.mypy]` in `backend/pyproject.toml`) runs in the same `lint` job; a `# type: ignore` carries its reason after a second `#`. The frontend compiles with `"strict": true` (`tsc -b` in the `test` job).
- Complexity is capped via `C901`/`PLR0912` (`max-complexity`/`max-branches` = 10) — split a function rather than raising the ceiling. `PLR0913` (argument count) is deliberately off: FastAPI routes take their dependencies as arguments.
- The rule set is `E, F, I, UP, B, S, SIM, C4, RUF, C901, PLR0912` (`backend/pyproject.toml`). `B008` (flake8-bugbear: no function calls in argument defaults) is deliberately ignored — it flags FastAPI's `Depends(...)` default-argument pattern, which is correct FastAPI usage, not a bug. Tests are exempt from the bandit `S101`/`S105` and `RUF001` (asserts, dummy tokens, full-width test digits). A `# noqa` in app code carries its reason after a dash.

Frontend uses ESLint (`frontend/eslint.config.js` — `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-config-prettier` to defer style to Prettier) for linting and Prettier (`frontend/.prettierrc.json`) for formatting, per [ADR-0013](docs/adr/0013-frontend-architecture-and-tooling.md).

- `npm run lint` (`eslint .`) and `npm run format:check` (`prettier --check .`) run as part of `.github/workflows/frontend-ci.yml`'s `lint` job — a required check, like the backend's.
- Before committing frontend changes: `npm run lint -- --fix` then `npm run format` — or let pre-commit do it: the `frontend-eslint`/`frontend-prettier` local hooks in `.pre-commit-config.yaml` run against staged `frontend/` files. One-time setup per clone: `cd frontend && npm install` (in addition to the `pre-commit install` above).

### Python version
`.python-version` (repo root) is the single source for local dev and CI (`actions/setup-python` → `python-version-file`). `render.yaml` still pins `PYTHON_VERSION` explicitly (see the comment there) — bump both together.

### Architecture Documentation
This project doubles as a reference sample (incl. for job applications), so architectural reasoning is recorded, not just the resulting code.

- **`docs/ARCHITECTURE.md`**: living current-state overview (components, diagram). Describes *what exists*. Keep it accurate to the actual state of the repo — shrink the "Not yet built" list as things land, don't write aspirationally.
- **`docs/adr/`**: Architecture Decision Records ([index](docs/adr/README.md) — add each new ADR there, and update both status lines when one supersedes or amends another), one file per decision, numbered sequentially (`NNNN-title.md`), using `docs/adr/template.md` (Context / Decision / Consequences). Describes *why*. See [docs/adr/0001-use-architecture-decision-records.md](docs/adr/0001-use-architecture-decision-records.md) for the full rationale.
- Write an ADR when a decision would be genuinely costly to reverse or non-obvious to a future reader (e.g. auth flow, grading-request architecture, deployment topology) — not for routine implementation choices already covered by these conventions.
- Superseding a decision: add a new ADR referencing the old one, mark the old one "Superseded by ADR-NNNN". Don't edit history away.

### Postman & integration tests
Two collections live in `postman/`; the how-to and the reasoning are in [docs/postman-and-integration-tests.md](docs/postman-and-integration-tests.md).

- `sks-lotse.postman_collection.json` is **generated** from the live OpenAPI schema — never edit it by hand. After any API change run `./scripts/generate_postman_collection.sh` and commit the result: it also regenerates the frontend's API types (`frontend/src/api/schema.gen.ts`, [ADR-0046](docs/adr/0046-api-types-generated-from-openapi.md)); the required `postman-collection` CI job fails when either is stale. A new literal-valued response field is narrowed by hand in `frontend/src/api/types.ts`. Copy the `*.postman_environment.json.example` templates to the same name without `.example` (gitignored, they hold secrets) and use a plain one-off **Import**, never Postman's Git-sync "Local Mode".
- `integration-tests.postman_collection.json` is **hand-written** and black-box tests a running local backend (`./scripts/run_integration_tests.sh`; server requirements are in the script header). **Any PR that adds/changes/removes an endpoint or its behavior updates its requests and `pm.test` assertions in the same PR** — at least a happy path and the main validation failure. The auth guard of every route is checked by `backend/tests/test_auth_guards.py`, not here: the collection keeps one no-token 401 per router (to exercise the guard on a real server) plus the non-admin 403s, the cookie cases and the rate limits. `backend/tests/test_integration_collection.py` fails when a route has no request, a request has no assertion, or a Bearer/`... rejected` request forgets `"protocolProfileBehavior": {"disableCookies": true}` (Newman's cookie jar would otherwise authenticate it); a route with `include_in_schema=False` goes into `_UNDOCUMENTED_ROUTES` there. CI runs the collection in the `integration-tests` job, which is **not** a required check — verify it's green before merging.

### Deployment (Render)
Everything is declared in `render.yaml` ([ADR-0005](docs/adr/0005-render-deployment-topology.md), [ADR-0015](docs/adr/0015-frontend-deployment-topology.md)); how to operate it is in [docs/RUNBOOK.md](docs/RUNBOOK.md). Rules for changes:

- Every commit to `main` deploys once its GitHub checks pass (`autoDeployTrigger: checksPass`). Frontend and backend deploy independently, so an API change must stay backward compatible for one deploy.
- Migrations run in `preDeployCommand` while the previous version still serves traffic: every migration must work with the code that's already running.
- The backend runs exactly **one uvicorn worker** (`--workers 1`). The rate limiter, catalog cache and AI-check caps are in-process memory; don't add workers or instances without moving them to a shared store first.
- A new secret is declared `sync: false` in `render.yaml` and listed in the runbook's secrets table; its value is only ever set in the Render dashboard.

### Auth & rate limiting
How it works is described in `docs/ARCHITECTURE.md` → Auth (and ADR-0007/0008/0011); the rules to follow when adding code:

- **New `/api/v1` routes require a JWT.** Opt a router in via `dependencies=[Depends(get_current_user)]` (see `backend/app/api/v1/questions.py`), or take `current_user: User = Depends(get_current_user)` per route. The only intentionally open routes are `POST /auth/otp/request` and `POST /auth/otp/verify` (that's how a caller gets a token), `GET /pricing` (the unauthenticated landing page needs the current prices too, [ADR-0043](docs/adr/0043-token-based-ai-grading-monetization.md)), and `/health` (Render's health check). `backend/tests/test_auth_guards.py` checks this for every route in the OpenAPI schema (401 without a session, 403 for a learner under `/admin`); a deliberately public new route goes into its `PUBLIC` set.
- **Rate limiting is automatic** for everything under `/api/v1` (shared per-IP bucket, `backend/app/core/rate_limit.py`). An expensive or abusable new endpoint with a static path (e.g. `/auth/otp/verify`) gets its own tighter exact-path rule in `backend/app/main.py`; one with a path parameter can't match an exact-path rule, so it gets a per-user `check_and_record` cap inside the handler instead (e.g. the AI check in `backend/app/api/v1/grading.py`).
- **Accept email addresses via `NormalizedEmail`** (`backend/app/schemas/auth.py`), never plain `EmailStr` — every per-email lookup and quota relies on its canonical form (`canonicalize_email`, `backend/app/core/email_address.py`): lowercase, and for Gmail/Googlemail also without dots and `+tag`, with `googlemail.com` folded to `gmail.com`, so one inbox can't become many accounts. The `ALLOWED_EMAILS`/`ADMIN_EMAILS` allowlists are canonicalized the same way, so they may be written in any spelling. Anything new that compares or looks up an address outside a schema must call `canonicalize_email` itself.
- **Dev/test-only endpoints are gated on `settings.exposes_dev_tooling`** (an allowlist that fails closed), never on `not settings.is_production`, and declared with `include_in_schema=False`.
- **The session token lives in an httpOnly cookie, not `localStorage`** ([ADR-0012](docs/adr/0012-httponly-cookie-for-frontend-session-token.md)) — set/cleared by `verify_otp`/`logout` in `backend/app/api/v1/auth.py`, read by `get_current_user` in `backend/app/core/jwt.py` (cookie first, falling back to `Authorization: Bearer` for Postman/the integration-test suite). The frontend never reads or stores it directly; a new frontend auth call just needs `credentials: "include"` (already the default in `frontend/src/api/client.ts`).

### Data Layer Conventions
Apply these four checks whenever adding or changing a database table — going forward, not just at initial design time:

- **Temporary/transient data needs cleanup.** If a table accumulates rows that are only useful for a bounded time (codes, tokens, sessions, request logs), decide how they get deleted before shipping the feature, not after the table grows unbounded. Doesn't have to be a scheduled job — piggybacking cleanup on an existing write path (delete-on-insert) is a legitimate, infrastructure-free answer for an MVP at this scale; run it as a background task (`BackgroundTasks.add_task`) rather than inline if the delete would otherwise add latency to that request — the task opens its own session via `get_session_factory` (`backend/app/core/database.py`), never the request's `get_db` one — and see the throttling rule below so its frequency doesn't scale with request volume. Example: `otp_codes` cleanup in `issue_code` (`backend/app/services/otp_codes.py`, [docs/adr/0010](docs/adr/0010-opportunistic-otp-code-cleanup.md)).
- **Index for the read pattern, not just uniqueness.** When a table will see meaningful read volume, check the actual query shape (equality vs. range, which columns together, which column(s) each *distinct* query filters on) and index accordingly — a composite index in filter/sort order usually beats several single-column indexes for queries that share a filter prefix, but a query with an unrelated filter (no shared leading column) still needs its own index; one composite can't cover every access pattern on a table. Also drop a single-column index once a composite index makes it a redundant subset. Example: `otp_codes` ended up with `(email, created_at)` for the two email-scoped lookups, plus a separate `expires_at` index for the cleanup sweep, which filters on neither column those share.
- **Gate opportunistic/periodic maintenance work that piggybacks on request traffic**, so its cost is bounded regardless of how often the triggering endpoint gets called — under heavy load, "once per request" for something that only needs to run every few minutes is wasted work, not free just because it avoided a scheduled job. Use `cache.throttle(app, key, min_interval_seconds)` (`backend/app/core/cache.py`) to cap it to a cadence, the same practical effect as a cron job without standing up a scheduler. A real scheduler exists now — the `sks-lotse-daily-report` Render Cron Job (ADR-0032) — so work that needs a fixed schedule rather than "at most every N minutes" can become another cron job; still don't add one for something throttled piggybacking already covers. Example: `otp_codes` cleanup throttled to once per `OTP_CLEANUP_MIN_INTERVAL_SECONDS` ([docs/adr/0010](docs/adr/0010-opportunistic-otp-code-cleanup.md)).
- **Consider caching for read-heavy, rarely-written data**, local (in-process) first — no new infrastructure until there's a concrete reason for it (multiple instances, restarts frequent enough to matter) — but behind an interface that could swap to a shared store like Redis later without callers changing. `backend/app/core/cache.py` is that interface; see [docs/adr/0009](docs/adr/0009-in-process-cache-for-question-catalog.md) and [docs/adr/0007](docs/adr/0007-in-memory-per-ip-rate-limiting.md) (the rate limiter established the same local-first-but-swappable pattern for a different kind of state).

---

## Environment Variables (backend)

`backend/.env.example` lists every backend env var with its default, and `backend/app/core/config.py` (`Settings`) is the authoritative definition — keep both in sync when adding one, rather than listing them again here. `render.yaml` declares which ones production sets. What's not obvious from those files:

- **`ENVIRONMENT`** — one of `development` (default), `test`, `production`; anything else (e.g. a `prod` typo) fails at startup. Render sets `production`. Dev-only tooling (Swagger UI/ReDoc/OpenAPI schema, the OTP `_dev-peek` endpoint) is enabled only for `development`/`test` (`Settings.exposes_dev_tooling`), and never when `RENDER` is set — a Render service always counts as production, even with `ENVIRONMENT` forgotten.
- **`JWT_SECRET`** — required, at least 32 characters in every environment, no fallback. Signs JWTs; a key derived from it hashes OTP codes (`backend/app/core/otp.py`). Generate with `openssl rand -hex 32`. Rotating it invalidates all sessions and pending OTP codes.
- **`RESEND_API_KEY`** — the sending domain must be verified at Resend via IONOS DNS records before OTP emails go out. Locally it can stay empty: the API still returns 202 and logs the failed send.
- **`ALLOWED_EMAILS`** — comma-separated allowlist for the private beta; unset = open to everyone. Non-listed addresses get the same generic 202 with no code and no email.
- **`ADMIN_EMAILS`** — comma-separated allowlist gating the GDPR admin tools (`/admin`, ADR-0019). Unlike `ALLOWED_EMAILS`, unset/empty = **no admins** (fails closed) — the inverse default, since an unset var here must never grant access.
- **Tuning knobs** (`OTP_*`, `RATE_LIMIT_*`, `GRADING_*`, `CATALOG_CACHE_TTL_SECONDS`, `JWT_ACCESS_TOKEN_EXPIRES_MINUTES`) — optional; defaults are the production values, the env vars exist so local dev/CI can loosen them.
- **Not an env var:** the disposable-email-domain blocklist is bundled data (`disposable-email-domains` in `requirements.in`) — Dependabot bumps it.
- **Frontend `VITE_ADSENSE_CLIENT_ID`** — Google AdSense publisher id (`ca-pub-…`), set on the frontend service only; unset = the ad script and the "Cookie-Einstellungen" footer button are absent ([ADR-0027](docs/adr/0027-adsense-with-google-consent-management.md)).
- **Planned, not yet read by the app:** `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`, `FACEBOOK_OAUTH_CLIENT_ID`/`_SECRET`, `X_OAUTH_CLIENT_ID`/`_SECRET` (SSO isn't built).
- **`ANTHROPIC_API_KEY`** — only used locally by `backend/scripts/manage_topics.py` ([docs/catalog-pipeline.md](docs/catalog-pipeline.md)) to classify questions into topics; not read by the running app, not set on Render.
- **`ANTHROPIC_GRADING_API_KEY`** — the running app's key for the AI answer check (`backend/app/services/grader.py`, ADR-0031; empty = the endpoint answers 503). A `sync: false` secret on Render; keep it a different key (own Console workspace) from `ANTHROPIC_API_KEY`.
