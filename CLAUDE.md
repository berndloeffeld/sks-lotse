# SKS Lotse — Claude Code Context

SKS Lotse is a web app to prepare for the theoretical exam of the German SKS (Sportküstenschifferschein) sailing license. The official catalog is free text: the learner writes an answer and grades it against the official model answer, optionally helped by an LLM that *suggests* a grade (the Lotsen-Check). Web-only, freemium (remove ads / unlock the Lotsen-Check, set by the operator until payment exists).

This file holds the **rules for working on the code**. Everything descriptive lives in one place each:

| Topic | Owner |
|---|---|
| What the product does, the components, data, auth, deployment as it is now, what's not built yet | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Why a decision was made (and what superseded it) | [docs/adr/](docs/adr/README.md): index with status per ADR |
| Operating production: logs, deploys/rollback, backups, secrets, DSGVO requests, one-time setup, domains | [docs/RUNBOOK.md](docs/RUNBOOK.md) |
| Question catalog: subjects, the Seemannschaft merge, images, the import pipeline | [docs/catalog-pipeline.md](docs/catalog-pipeline.md) |
| Expected load (Mengengerüst), non-functional requirements met and still open | [docs/NON-FUNCTIONAL-REQUIREMENTS.md](docs/NON-FUNCTIONAL-REQUIREMENTS.md) |
| Local setup, quality-gate commands, dependency locks | [README.md](README.md) |
| Mutation testing, Postman/integration tests | [docs/mutation-testing.md](docs/mutation-testing.md), [docs/postman-and-integration-tests.md](docs/postman-and-integration-tests.md) |
| What the product can do today, for product, sales and sailing instructors | [docs/FEATURES.md](docs/FEATURES.md) |

When a change makes one of these wrong, fix it in the same PR — in its owner, not by adding a copy here.

This holds in particular for `docs/FEATURES.md` (a change to what learners or operators can do, incl. prices and what is live) and `docs/NON-FUNCTIONAL-REQUIREMENTS.md` (a change to the expected load, limits, security, availability or performance behaviour): update them in the PR that changes the behaviour, not later.

## Repository layout

```
.github/    workflows (backend-ci, frontend-ci, mutation-testing, maintenance-mode, reset-admin-2fa)
backend/    FastAPI app (app/api/v1 routes, app/services shared logic, app/domain product rules, app/core infrastructure/cross-cutting), alembic/, scripts/, tests/
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
- **Monetization flags are independent**: `ads_removed` and the `token_balance` pay-per-use balance, all four combinations valid (ADR-0006, ADR-0043). The ad script runs only where ads are shown and never on `/pricing` or `/admin` (ADR-0027 addendum 2026-09-23).
- **Personal data** added anywhere is deleted with the account (`services/user.py:delete_user_and_progress`), included in the admin export (`services/admin_users.py`) and described in the Datenschutzerklärung.

---

## Branch Strategy

Trunk-based development:
- `main` — trunk, single source of truth, auto-deploys to Render
- `feature/*` — short-lived feature branches, merge back to main via PR
- No long-lived branches
- Never commit directly to `main` — every change, however small, goes on a dedicated `feature/*` branch cut from `main`, merged back via PR
- Merge with **squash** — the only merge method enabled in the repo settings (merge commits and rebase are off), so `main` has one commit per PR, titled `... (#NN)`; the head branch is deleted automatically.

**Branch protection on `main`** (enforced by GitHub, admins included — this is the actual merge gate):
- PR required; no approving review required; force-push and branch deletion blocked.
- **Required status checks**, matched by job name: `backend-lint`, `backend-test`, `migrations`, `postman-collection`, `integration-tests` (`backend-ci.yml`) and `frontend-lint`, `frontend-test` (`frontend-ci.yml`). Job names are unique across workflows on purpose: a required check is matched by name only, so a name two workflows share is satisfied by whichever reports first. A renamed job has to be renamed in the branch protection in the same go, or every PR waits for a check that never comes. Mutation testing isn't a PR check at all, it runs daily (see Mutation testing below). There is no Aikido check in CI, and none is required before merging (see Security Scanning below). CodeQL (GitHub's Default Setup for Python, JavaScript/TypeScript and Actions, configured in the repo settings rather than as a workflow file) also reports on PRs but isn't a required check either.
- **Branch must be up to date with `main`** (strict mode): once another PR lands, the next one shows as `BEHIND` and can't merge until updated (`gh pr update-branch <N>`), which re-runs CI.
- GitHub's auto-merge is disabled in the repo settings, so `gh pr merge --auto` fails — wait for the checks, then merge.
- Neither workflow has path filters, so the required checks run (and must pass) even on docs-only PRs. A newer push to a PR branch cancels its still-running CI (`concurrency`); every job has a 15-minute timeout. The `frontend-test` job also runs `npm run build` (incl. prerender), the same build Render deploys.

---

## Development Conventions

### Working Directory
All file edits must be made in the canonical project root:

```
/Users/berndloffeld/Projects/sks-lotse
```

Never write to a git worktree path (e.g. `.claude/worktrees/...`) — if Claude Code is invoked from a worktree, edits must still target the real project root above. A `PreToolUse` hook (`.claude/hooks/block-worktree-edits.sh`, wired in `.claude/settings.json`) blocks this mechanically; this section is the fallback if hooks are ever off.

### Avoid pipeline overkill for rare tasks
For infrequent/one-off operations (e.g. importing the SKS question catalog from PDF, which runs once or a few times total), do not build infrastructure — use a plain script instead. No pipelines, queues, task runners, or extra abstraction layers are needed for tasks that run rarely. This aligns with the general principle of avoiding premature abstraction: match the infrastructure to the actual problem, not hypothetical future complexity.

### Naming: English in code and URLs, German in the UI
Route paths, file and component names and code identifiers are English (`/pricing`, `/terms`, `/learn/focus`, `PricingPage`); only what the learner reads is German (labels, copy, page titles). A path that has to change keeps working: add it to `RETIRED_PATHS` in `frontend/src/App.tsx`, and a public one also gets a `type: redirect` in `render.yaml`. Domain terms from the catalog or the law stay as they are: subject keys like `navigation`, the exam variants, and AGB (`AgbPage`, `AgbGate`, `agb_accepted_*`).

### Security Scanning (Aikido)
Aikido rescans the repo about every three days, on its own schedule — **not a merge gate** (no CI job, no required check; removed 2026-09-19 when Aikido's free plan stopped allowing API access from CI, so the job failed every PR). An alert is still handled right away: it takes priority over feature work in flight, triaged the same day it arrives. Steps, `scripts/check_aikido.sh` usage and the API credentials it needs: [docs/RUNBOOK.md](docs/RUNBOOK.md) → Security alerts (Aikido).

The dependency audit that *is* a merge gate: `pip-audit` over `backend/requirements-dev.txt` in `backend-lint`, and `npm audit --omit=dev --audit-level=high` (what ships to the browser, high/critical only) in `frontend-lint`. A finding there blocks every PR until the dependency is bumped (re-lock via `scripts/lock_backend_requirements.sh`); if no fixed version exists yet, `pip-audit --ignore-vuln <ID>` in the workflow with the reason in a comment, removed again once a fix ships.

### Test Coverage
Both sides enforce a line + branch coverage minimum: backend in `backend/pyproject.toml` (`--cov-fail-under`, via `pytest-cov`), frontend in `frontend/vite.config.ts` (`test.coverage.thresholds`). Those files hold the numbers; the gates run in the required `backend-test`/`frontend-test` jobs. The rules:

- **The minimum is a ratchet**, set a few points under the actual value: raise it when the actual value settles higher; never lower it to get a PR through — test the code.
- API endpoint tests use an in-memory SQLite DB (`backend/tests/conftest.py`, `get_db` override), so the suite never runs the Alembic migrations. The `migrations` CI job does, against the production Postgres major version (`alembic upgrade head`, `alembic check`, `downgrade base`, `upgrade head`): a model change without a migration fails there.

### Mutation testing
Runs daily, not per PR (`.github/workflows/mutation-testing.yml`); how it works, the commands, the current scores and how to read survivors: [docs/mutation-testing.md](docs/mutation-testing.md). The rules:

- **The minimum score is a ratchet** (`MUTATION_MIN_SCORE` in the two `scripts/run_*mutation_tests.sh`): raise it when the score settles higher, never lower it to get a change through. A failed daily run opens an issue; treat it like a red CI.
- **Keep the scope current, in the same PR.** Backend: exactly `only_mutate` in `[tool.mutmut]` of `backend/pyproject.toml`. A new module with business logic in `app/domain/`, `app/core/`, `app/services/` (or an `app/api/v1/` file with undecorated helpers) is **added** there; a renamed or deleted one is updated or removed; one deliberately left out goes into the `EXCLUDED` set of `backend/tests/test_mutation_scope.py` with its reason — that test fails otherwise. Frontend: `mutate` in `frontend/stryker.config.json` and the `EXCLUDED` set of `frontend/src/test/mutationScope.test.ts`, same rule; a new logic module needs its own test (Stryker only credits tests that cover the mutant).
- **mutmut skips decorated functions**, i.e. route handlers: put anything sizeable into an undecorated helper, and check new handlers with the script's `handlers` mode.
- Vitest stays on 4.x until Stryker's runner supports 5 ([ADR-0035](docs/adr/0035-vitest-pinned-to-4x-for-stryker.md)).

### Linting & Formatting
Backend uses `ruff` (`backend/pyproject.toml`, `[tool.ruff]`) for both linting and formatting.

- `ruff check .` and `ruff format --check .` run as part of `.github/workflows/backend-ci.yml`'s `backend-lint` job on every push to `main` and on every PR — a required check.
- Before committing backend changes: `ruff check --fix .` then `ruff format .` — or let pre-commit do it: `.pre-commit-config.yaml` runs the venv's ruff (a `local` hook, so its version is the one `requirements-dev.txt` locks) on staged backend files and refuses commits on `main` (catches it locally, before the push that branch protection would reject). One-time setup per clone: `pre-commit install --install-hooks -t pre-commit -t pre-push` (the package is in `requirements-dev.txt`); the pre-push stage adds `mypy app` and `tsc -b`.

- `mypy app` (`[tool.mypy]` in `backend/pyproject.toml`) runs in the same `backend-lint` job; a `# type: ignore` carries its reason after a second `#`. The frontend compiles with `"strict": true` (`tsc -b` in the `frontend-test` job).
- Complexity is capped via `C901`/`PLR0912` (`max-complexity`/`max-branches` = 10) — split a function rather than raising the ceiling. `PLR0913` (argument count) is deliberately off: FastAPI routes take their dependencies as arguments.
- The rule set is `E, F, I, UP, B, S, SIM, C4, RUF, C901, PLR0912` (`backend/pyproject.toml`). `B008` (flake8-bugbear: no function calls in argument defaults) is deliberately ignored — it flags FastAPI's `Depends(...)` default-argument pattern, which is correct FastAPI usage, not a bug. Tests are exempt from the bandit `S101`/`S105` and `RUF001` (asserts, dummy tokens, full-width test digits). A `# noqa` in app code carries its reason after a dash.

Frontend uses ESLint (`frontend/eslint.config.js` — `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-config-prettier` to defer style to Prettier) for linting and Prettier (`frontend/.prettierrc.json`) for formatting, per [ADR-0013](docs/adr/0013-frontend-architecture-and-tooling.md). `eslint-plugin-jsx-a11y`'s recommended rules are the only accessibility bar — no separate WCAG target is defined.

- `npm run lint` (`eslint .`) and `npm run format:check` (`prettier --check .`) run as part of `.github/workflows/frontend-ci.yml`'s `frontend-lint` job — a required check, like `backend-lint`.
- Before committing frontend changes: `npm run lint -- --fix` then `npm run format` — or let pre-commit do it: the `frontend-eslint`/`frontend-prettier` local hooks in `.pre-commit-config.yaml` run against staged `frontend/` files. One-time setup per clone: `cd frontend && npm install` (in addition to the `pre-commit install` above).

### Python version
`.python-version` (repo root) is the single source for local dev and CI (`actions/setup-python` → `python-version-file`). `render.yaml` still pins `PYTHON_VERSION` explicitly (see the comment there) — bump both together.

### Architecture Documentation
This project doubles as a reference sample (incl. for job applications), so architectural reasoning is recorded, not just the resulting code.

- **`docs/ARCHITECTURE.md`**: living current-state overview (components, diagram). Describes *what exists*. Keep it accurate to the actual state of the repo — shrink the "Not yet built" list as things land, don't write aspirationally.
- **`docs/adr/`**: Architecture Decision Records ([index](docs/adr/README.md) — add each new ADR there, and update both status lines when one supersedes or amends another; an ADR's `Status:` line and its index row must match character for character, `backend/tests/test_docs.py` compares them, and pre-commit runs that test whenever a doc is staged), one file per decision, numbered sequentially (`NNNN-title.md`), using `docs/adr/template.md` (Context / Decision / Consequences). Describes *why*. See [docs/adr/0001-use-architecture-decision-records.md](docs/adr/0001-use-architecture-decision-records.md) for the full rationale.
- Write an ADR when a decision would be genuinely costly to reverse or non-obvious to a future reader (e.g. auth flow, grading-request architecture, deployment topology) — not for routine implementation choices already covered by these conventions.
- Superseding a decision: add a new ADR referencing the old one, mark the old one "Superseded by ADR-NNNN". Don't edit history away.

### Postman & integration tests
Two collections live in `postman/`; how to run and import them, the server requirements and the reasoning are in [docs/postman-and-integration-tests.md](docs/postman-and-integration-tests.md). The rules:

- `sks-lotse.postman_collection.json` is **generated** — never edit it by hand. After any API change run `./scripts/generate_postman_collection.sh` and commit the result; it also regenerates `frontend/src/api/schema.gen.ts` ([ADR-0046](docs/adr/0046-api-types-generated-from-openapi.md)), and the required `postman-collection` job fails when either is stale (the `PostToolUse` hook `.claude/hooks/remind-postman-regen.sh` only nudges). A new literal-valued response field is narrowed by hand in `frontend/src/api/types.ts`. Real environment files (copies of the `*.example` templates) hold secrets and stay gitignored; import with a plain one-off **Import**, never Postman's Git-sync "Local Mode".
- `integration-tests.postman_collection.json` is **hand-written**. **Any PR that adds/changes/removes an endpoint or its behavior updates its requests and `pm.test` assertions in the same PR** — at least a happy path and the main validation failure, plus a non-admin 403 under `/admin`. A renamed or removed response field, or changed fixed data, breaks assertions no unit test sees: grep the collection for the old name or value before pushing. Every Bearer or `... rejected` request sets `"protocolProfileBehavior": {"disableCookies": true}`; a route with `include_in_schema=False` goes into `_UNDOCUMENTED_ROUTES` of `backend/tests/test_integration_collection.py`, which enforces all of this.

### Deployment (Render)
Everything is declared in `render.yaml` ([ADR-0005](docs/adr/0005-render-deployment-topology.md), [ADR-0015](docs/adr/0015-frontend-deployment-topology.md)); how to operate it is in [docs/RUNBOOK.md](docs/RUNBOOK.md). Rules for changes:

- Every commit to `main` deploys once its GitHub checks pass (`autoDeployTrigger: checksPass`). Frontend and backend deploy independently, so an API change must stay backward compatible for one deploy.
- Migrations run in `preDeployCommand` while the previous version still serves traffic: every migration must work with the code that's already running.
- The backend runs exactly **one uvicorn worker** (`--workers 1`). The rate limiter, catalog cache and AI-check caps are in-process memory; don't add workers or instances without moving them to a shared store first.
- A new secret is declared `sync: false` in `render.yaml` and listed in the runbook's secrets table; its value is only ever set in the Render dashboard.

### Auth & rate limiting
How it works is described in `docs/ARCHITECTURE.md` → Auth (and ADR-0007/0008/0011); the rules to follow when adding code:

- **New `/api/v1` routes require a JWT.** Opt a router in via `dependencies=[Depends(get_current_user)]` (see `backend/app/api/v1/questions.py`), or take `current_user: User = Depends(get_current_user)` per route. The only intentionally open routes are `POST /auth/otp/request` and `POST /auth/otp/verify` (that's how a caller gets a token), `POST /payments/webhook` (Stripe calls it; the `Stripe-Signature` header authenticates it, [ADR-0048](docs/adr/0048-stripe-hosted-checkout-with-webhook-fulfilment.md)), `GET /pricing` (the unauthenticated landing page needs the current prices too, [ADR-0043](docs/adr/0043-token-based-ai-grading-monetization.md)), and `/health` (Render's health check). `backend/tests/test_auth_guards.py` checks this for every route in the OpenAPI schema (401 without a session, 403 for a learner under `/admin`); a deliberately public new route goes into its `PUBLIC` set.
- **Rate limiting is automatic** for everything under `/api/v1` (shared per-IP bucket, `backend/app/core/rate_limit.py`). An expensive or abusable new endpoint with a static path (e.g. `/auth/otp/verify`) gets its own tighter exact-path rule in `backend/app/main.py`; one with a path parameter can't match an exact-path rule, so it gets a per-user `check_and_record` cap inside the handler instead (e.g. the AI check in `backend/app/api/v1/grading.py`).
- **Accept email addresses via `NormalizedEmail`** (`backend/app/schemas/auth.py`), never plain `EmailStr` — every per-email lookup and quota relies on its canonical form (`canonicalize_email`, `backend/app/core/email_address.py`): lowercase, and for Gmail/Googlemail also without dots and `+tag`, with `googlemail.com` folded to `gmail.com`, so one inbox can't become many accounts. The `ALLOWED_EMAILS`/`ADMIN_EMAILS` allowlists are canonicalized the same way, so they may be written in any spelling. Anything new that compares or looks up an address outside a schema must call `canonicalize_email` itself.
- **Dev/test-only endpoints are gated on `settings.exposes_dev_tooling`** (an allowlist that fails closed), never on `not settings.is_production`, and declared with `include_in_schema=False`.
- **The session token lives in an httpOnly cookie, not `localStorage`** ([ADR-0012](docs/adr/0012-httponly-cookie-for-frontend-session-token.md)) — set/cleared by `verify_otp`/`logout` in `backend/app/api/v1/auth.py`, read by `get_current_user` in `backend/app/core/jwt.py` (cookie first, falling back to `Authorization: Bearer` for Postman/the integration-test suite). The frontend never reads or stores it directly; a new frontend auth call just needs `credentials: "include"` (already the default in `frontend/src/api/client.ts`).

### Data Layer Conventions
Apply these four checks whenever adding or changing a database table — going forward, not just at initial design time:

- **Temporary/transient data needs cleanup.** If a table accumulates rows that are only useful for a bounded time (codes, tokens, sessions, request logs), decide how they get deleted before shipping the feature, not after the table grows unbounded. Doesn't have to be a scheduled job — piggybacking cleanup on an existing write path (delete-on-insert) is a legitimate, infrastructure-free answer for an MVP at this scale; run it as a background task (`BackgroundTasks.add_task`) rather than inline if the delete would otherwise add latency to that request — the task opens its own session via `get_session_factory` (`backend/app/core/database.py`), never the request's `get_db` one — and see the throttling rule below so its frequency doesn't scale with request volume. Example: `otp_codes` cleanup in `issue_code` (`backend/app/services/otp_codes.py`, [docs/adr/0010](docs/adr/0010-opportunistic-otp-code-cleanup.md)).
- **Index for the read pattern, not just uniqueness.** When a table will see meaningful read volume, check which column(s) each distinct query filters on and index accordingly — a composite index covers a shared filter prefix, but a query with an unrelated filter still needs its own index, and a composite makes a redundant single-column index worth dropping. Example: `otp_codes` ended up with `(email, created_at)` for the two email-scoped lookups, plus a separate `expires_at` index for the cleanup sweep, which filters on neither column those share.
- **Gate opportunistic/periodic maintenance work that piggybacks on request traffic**, so its cost is bounded regardless of how often the triggering endpoint gets called — under heavy load, "once per request" for something that only needs to run every few minutes is wasted work, not free just because it avoided a scheduled job. Use `cache.throttle(app, key, min_interval_seconds)` (`backend/app/core/cache.py`) to cap it to a cadence, the same practical effect as a cron job without standing up a scheduler. A real scheduler exists now — the `sks-lotse-daily-report` Render Cron Job (ADR-0032) — so work that needs a fixed schedule rather than "at most every N minutes" can become another cron job; still don't add one for something throttled piggybacking already covers. Example: `otp_codes` cleanup throttled to once per `OTP_CLEANUP_MIN_INTERVAL_SECONDS` ([docs/adr/0010](docs/adr/0010-opportunistic-otp-code-cleanup.md)).
- **Consider caching for read-heavy, rarely-written data**, local (in-process) first — no new infrastructure until there's a concrete reason for it (multiple instances, restarts frequent enough to matter) — but behind an interface that could swap to a shared store like Redis later without callers changing. `backend/app/core/cache.py` is that interface; see [docs/adr/0009](docs/adr/0009-in-process-cache-for-question-catalog.md) and [docs/adr/0007](docs/adr/0007-in-memory-per-ip-rate-limiting.md) (the rate limiter established the same local-first-but-swappable pattern for a different kind of state).

---

## Environment variables

`backend/app/core/config.py` (`Settings`) is the authoritative definition; `backend/.env.example` and `frontend/.env.example` list every variable with its default and what it does; `render.yaml` declares what production sets, and the runbook's secrets table how each is rotated. The rules:

- A new variable goes into `Settings` and `.env.example` in the same PR (a new secret also follows the rule in Deployment (Render) above).
- An allowlist that grants rights fails closed: `ADMIN_EMAILS` unset/empty means **no admins** (the inverse of `ALLOWED_EMAILS`, where unset means open). Keep it that way for anything similar.
- Enum-like settings (`ENVIRONMENT`, `CHART_EXERCISES`, `STRIPE_CHECKOUT`) reject unknown values at startup; a typo must never fall back to a default.
- `CHART_EXERCISES` is declared in `render.yaml`, not the dashboard: switching it is a PR together with `docs/FEATURES.md` ([ADR-0052](docs/adr/0052-chart-exercises-from-reviewed-yaml.md)).
- `ANTHROPIC_GRADING_API_KEY` (the running app's Lotsen-Check) stays a different key, in its own Console workspace, from `ANTHROPIC_API_KEY` (local topic classification only, never set on Render).
