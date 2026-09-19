# SKS Lotse — Claude Code Context

## What is SKS Lotse?
SKS Lotse is a web app to prepare for the theoretical exam of the German SKS (Sportküstenschifferschein) sailing license. The official exam catalog is free-text (not multiple choice): the learner writes an answer and must judge for themselves whether it's close enough to the official model answer. SKS Lotse uses an LLM to grade the learner's free-text answer against the official answer and explain what was missing or wrong.

**Differentiation vs. existing apps** (SKS-Buddy, official SKS App both already offer AI-graded free text): web-only (no app store) and speech-to-text as an alternative to typing an answer. Monetization is a freemium model — see [Monetization](#monetization) — a reversal of the original single-tier, ad-only concept; worth revisiting given competitors already include AI grading without gating it.

---

## Tech Stack

Target stack. Not all of it exists yet — `docs/ARCHITECTURE.md` → "Not yet built" is the source of truth for what's actually implemented.

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + TypeScript, Zustand |
| Frontend styling | Tailwind CSS ([ADR-0013](docs/adr/0013-frontend-architecture-and-tooling.md)); palette, typography & core UI patterns decided in [ADR-0014](docs/adr/0014-visual-design-system.md) |
| Frontend testing | Vitest + React Testing Library ([ADR-0013](docs/adr/0013-frontend-architecture-and-tooling.md)) |
| Backend | Python 3.12 / FastAPI |
| Database | PostgreSQL 16 (Render, Frankfurt EU) |
| Auth | Required — no anonymous access. SSO (Google/Facebook/X) or email + OTP, JWT-based session |
| Transactional email | Resend (OTP login codes) |
| Answer grading (LLM) | OpenAI API (GPT model) — grades free text against official answer, returns score + explanation |
| Speech-to-text | Web Speech API (browser-native, Chromium-based browsers) — no backend/cloud STT |
| Ads | Google AdSense |
| Analytics | Umami Cloud (Hobby plan, cookieless, EU region — [ADR-0016](docs/adr/0016-umami-cloud-analytics-without-consent-banner.md)) |
| Hosting | Render (Frankfurt EU — all services) |
| CI/CD | GitHub Actions → auto-deploy on push to main |

---

## Repository Structure

```
sks-lotse/
├── backend/
│   ├── app/
│   │   ├── api/v1/     # Route handlers (/api/v1/auth, /api/v1/questions, /api/v1/progress, /api/v1/admin)
│   │   ├── core/       # Config, JWT, OTP, cache, middlewares (rate limit, security headers, canonical domain)
│   │   ├── models/     # SQLAlchemy ORM models
│   │   ├── schemas/    # Pydantic request/response schemas
│   │   ├── services/   # Business logic / external integrations (email today; grading later)
│   │   └── main.py     # FastAPI app entry point
│   ├── alembic/        # Database migrations
│   ├── scripts/        # One-off/dev scripts (catalog import, OpenAPI dump)
│   ├── tests/
│   ├── .env.example    # All backend env vars, with defaults
│   └── requirements*.txt
├── frontend/           # React (Vite) + TypeScript, Zustand
│   ├── src/
│   │   ├── api/        # Thin typed fetch wrapper + shared response types
│   │   ├── components/ # Shared UI (e.g. ChartTile, per ADR-0014)
│   │   ├── hooks/      # Shared React hooks (e.g. useExamVariantUpdate)
│   │   ├── pages/      # LandingPage, LoginPage, StartPage, LearnPage, PracticePage, ProfilePage, AdminPage, ImprintPage, PrivacyPage
│   │   ├── routes/     # ProtectedRoute
│   │   └── store/      # Zustand auth store
│   ├── .env.example
│   └── package.json
├── docs/               # ARCHITECTURE.md, adr/, question catalog source PDF
├── postman/            # Generated API-reference collection + hand-written integration tests
├── scripts/            # Repo tooling (Postman generation, integration tests, Aikido check)
├── .github/            # CI workflow, Dependabot
├── .python-version     # Python version for local dev + CI
├── .pre-commit-config.yaml
├── docker-compose.yml  # Local Postgres
├── render.yaml         # Render Blueprint (deployment as code)
└── CLAUDE.md           # This file
```

---

## Core Flow

1. Learner logs in (SSO via Google/Facebook/X, or email + OTP) — required before using the app.
2. Learner is shown a question from the official SKS catalog.
3. **If the account has AI-based grading unlocked**: learner answers via text input or speech-to-text (Web Speech API transcribes locally in-browser before submit); the answer is sent to the backend, which calls the LLM with the question, the official model answer, and the learner's answer; the LLM returns a graded score (e.g. "80% correct") plus an explanation of what was missing or incorrect.
4. **If not**: the official model answer is shown for the learner to self-compare against — no forced writing step (an optional scratchpad field is never sent), no LLM call. The learner then grades themselves (Richtig / Teilweise Richtig / Falsch), which moves the question's "gelernt" streak exactly like an AI grading would ([ADR-0023](docs/adr/0023-self-assessed-learning-flow.md)). **This is the only grading that exists today** — AI grading and entitlements aren't built yet.
5. Progress is synced server-side against the logged-in account. If the account hasn't paid to remove ads, ads (Google AdSense) are shown.

---

## Question Catalog

- Source: official SKS question catalog, provided as PDF (`docs/Fragenkatalog-SKS.pdf`, questions + official model answers). The exam is offered in two variants by propulsion type — **"Segeln und Motor"** (492 questions: Navigation + Schifffahrtsrecht + Wetterkunde + Seemannschaft I) and **"Motor"** (475 questions: ... + Seemannschaft II) — a learner sits one or the other, not both.
- Some questions reference nautical charts/images — not extracted yet (`image_ref` is always null); for 2 stored questions the official answer is *only* a sketch, so their `answer_text` is empty. Where to store them (Cloudflare R2, TBD) and whether they're needed for MVP is still open.
- **Subjects**: `navigation`, `schifffahrtsrecht`, `wetterkunde`, and — since Seemannschaft I and II are ~65% word-for-word identical (safety equipment, anchoring, MOB, ropework; only rigging/sail-trim vs. engine/boat-type content really differs) — the merged `seemannschaft_allgemein` (shared questions, stored once, in the Seemannschaft I wording — so a pair is only merged if question and answer match word for word, or a human accepted the difference as purely editorial, see [ADR-0026](docs/adr/0026-merge-seemannschaft-only-on-matching-wording.md)), `seemannschaft_segeln` (I-only) and `seemannschaft_motor` (II-only), rather than two subjects with heavy duplication. `app/core/exam_variant.py` maps each of the two exam variants to its full subject set.
- **Topics**: every question can carry a `topic_id` into the `topics` table. Topic *names* are transcribed verbatim from the catalog's own official table of contents (`docs/Fragenkatalog-SKS.pdf`, pages 1–3) into `backend/scripts/data/topics.yaml` — never invented by a script or an LLM. See [ADR-0017](docs/adr/0017-official-topic-taxonomy-and-seemannschaft-merge.md).
- **The catalog seeds itself automatically.** `backend/app/services/catalog_seed.py` (`seed_catalog()`) is the single source of truth for PDF → `questions`/`topics` rows, and it runs as Alembic **data migrations** (`alembic/versions/16af6f481bf6_seed_question_catalog.py`, re-applied by `5499671351cd`) — meaning every `alembic upgrade head` populates the full catalog, including Render's `startCommand` before every deploy. No one has to remember to run a script against production; the schema migration and the data that belongs with it land together. Downgrading `16af6f481bf6` deletes all `questions`/`topics` rows.
- **Syncing is an upsert, never delete + insert** ([ADR-0022](docs/adr/0022-catalog-sync-by-upsert.md)): `build_catalog()` computes the full target state in memory, `sync_catalog()` upserts it keyed on `(subject, number)` / `(subject, slug)`, so question ids — and every learner's `question_progress` — survive a re-sync; only a question that vanished from the catalog is deleted. Seemannschaft rows are first moved to their new key by their *official* numbers (`seemannschaft_1_number`/`_2_number`), since `seemannschaft_allgemein`'s `number` is derived and shifts whenever the duplicates list changes (ADR-0026). `sync_catalog()` writes through table definitions frozen in that module, never the ORM models, so old data migrations keep working when models gain columns. Adding columns is free; renaming/dropping a frozen one needs the old migrations to get their own copy of the logic.
- Getting there is a 3-stage pipeline, but only the proposing halves of stages 2 and 3 are run by hand, from a developer's machine — the migrations call nothing but the DB:
  1. **Parse**: `parse_catalog_pdf()` turns the PDF into raw questions (still `seemannschaft_1`/`seemannschaft_2` at this point). Known parsing limitations are listed in `backend/scripts/import_catalog.py`'s docstring.
  2. **Merge**: `backend/scripts/merge_seemannschaft.py` computes candidate duplicate pairs by plain text-similarity (no LLM) into `scripts/data/seemannschaft_duplicates.yaml` for a human to review by hand; `merge_seemannschaft()` then reads that reviewed file and collapses `seemannschaft_1`/`seemannschaft_2` into the 3 subjects above. A pair whose question or answer isn't word-for-word identical needs an `accepted_difference` rationale or the merge refuses to run; `backend/scripts/diff_seemannschaft_pairs.py` prints a word diff of every such pair for review.
  3. **Classify**: `backend/scripts/manage_topics.py` calls the Anthropic API (`settings.anthropic_api_key`, a local dev-tooling-only credential, separate from `OPENAI_API_KEY`/the grading feature below) to classify questions into the fixed names from `topics.yaml`, writing `scripts/data/topic_assignments/<subject>.yaml` for a human to review by hand (`--missing` classifies only questions without an assignment, e.g. after un-merging a pair); `assign_topics()` then applies that reviewed file. The LLM only ever classifies into existing names — it never invents or renames a topic.
  - Both proposing scripts read the PDF directly — no DB needed. `backend/scripts/import_catalog.py` syncs a local DB with the committed files (same code as the migrations) to check the result.
  - Only the *review artifacts* (`seemannschaft_duplicates.yaml`, `topic_assignments/*.yaml`) need to exist before `alembic upgrade head` can seed a new environment — they're committed to the repo, so this is already true everywhere. Re-running the proposing scripts (and re-reviewing) is only needed if the source PDF or the topic taxonomy itself changes; a new data migration calling `sync_catalog(op.get_bind(), build_catalog())` then ships the updated result.
- `Question.seemannschaft_1_number` / `seemannschaft_2_number` (nullable) preserve the original amtliche "Nummer N" from each variant's own catalog once step 2 renumbers `seemannschaft_allgemein` — both are set for a merged row, exactly one for a `_segeln`/`_motor` row, both `NULL` for the other 3 subjects.
- **Exam variant is an explicit account attribute**, not just inferred from which Seemannschaft subject a learner reads: `User.exam_variant` (nullable, `"motor"` | `"segeln_und_motor"`, set via `PATCH /api/v1/auth/me`). `GET /questions`/`/questions/random` filter to the variant's subjects by default; an explicit `subject` query param always overrides it. Settable from `/learn` (a small header dropdown) and from `/profile`.
- **`/profile`** (frontend, protected route) is the learner's self-service account page: edit optional `first_name`/`last_name`/`gender` (all nullable, blank = "keine Angabe"; `gender` validated against a fixed set the same way as `exam_variant` — see `GenderField` in `backend/app/schemas/auth.py`), switch `exam_variant`, view learning progress (reuses `GET /progress/summary`), change the account's email address, and delete the account. Once a name is set, it's shown instead of the email address wherever the learner's own identity is displayed (`getDisplayName` in `frontend/src/api/types.ts`).
  - Changing email is a verify-before-commit flow, not a bare `PATCH`: `POST /api/v1/auth/me/email/request` sends a confirmation code to the *new* address (reusing the login-OTP machinery in `backend/app/core/otp.py`/the `otp_codes` table), rejecting up front with `409` if that address already belongs to another account (or `403` if `ALLOWED_EMAILS` is set and the address isn't on it); codes are purpose-bound (`otp_codes.purpose`), so an email-change code never works as a login code; `POST /api/v1/auth/me/email/verify` checks the code and commits the change, `409`-ing again if the address was claimed by someone else in the meantime. Rate-limited two ways: per-IP (`backend/app/main.py`, same tightness as `/auth/otp/request`) and per-authenticated-user (`check_and_record` in `backend/app/core/rate_limit.py`, since the per-IP cap alone doesn't stop one account probing many addresses from multiple IPs).
  - `DELETE /api/v1/auth/me` lets a learner delete their own account (confirmed in the UI by retyping their own email, same idiom as the admin GDPR delete tool). The actual deletion logic (`QuestionProgress` rows, then the `User` row) lives in `backend/app/services/user.py:delete_user_and_progress`, shared with the admin-triggered delete in `backend/app/api/v1/admin.py`.

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
- **GDPR admin tools** (`/admin` in the frontend): a learner exercises their Art. 15/16/17/18/20/21 DSGVO rights by emailing the operator (per the Datenschutzerklärung), who fulfills Auskunft/Löschung requests by hand via this page — look a user up by email, export their data as JSON, or delete their account. Gated by the `ADMIN_EMAILS` allowlist (see Environment Variables below), not a DB role — see [ADR-0019](docs/adr/0019-admin-allowlist-and-manual-gdpr-fulfillment.md).

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
- **Required status checks**, matched by job name: `lint`, `test`, `migrations`, `postman-collection`, `aikido`. `lint` and `test` exist in both `backend-ci.yml` and `frontend-ci.yml`, so both workflows' jobs report under those names. `integration-tests` runs on every PR too but is **not** required — check it's green before merging anyway.
- **Branch must be up to date with `main`** (strict mode): once another PR lands, the next one shows as `BEHIND` and can't merge until updated (`gh pr update-branch <N>`), which re-runs CI.
- GitHub's auto-merge is disabled in the repo settings, so `gh pr merge --auto` fails — wait for the checks, then merge.
- Neither workflow has path filters, so the required checks run (and must pass) even on docs-only PRs.

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
- `scripts/check_aikido.sh` also runs as the `aikido` job in `.github/workflows/backend-ci.yml`, using `AIKIDO_CLIENT_ID`/`AIKIDO_CLIENT_SECRET` GitHub Actions repository secrets (Settings → Secrets and variables → Actions on GitHub — separate from the local `.env.aikido` below). The job fails the build if there are open findings; if those secrets aren't set yet, it emits a warning and no-ops instead of failing.
- `aikido` is a required status check on `main` (see Branch Strategy) — a PR with open findings can't merge. If the secrets are unset the job no-ops green, so that gate only holds while they're configured.
- `scripts/check_aikido.sh` queries the Aikido API directly for open findings on the repo (whichever branch Aikido last scanned) — run it locally instead of asking for a dashboard screenshot. Needs `.env.aikido` (gitignored, not committed) with `AIKIDO_CLIENT_ID` / `AIKIDO_CLIENT_SECRET` from an API client created at [app.aikido.dev/settings/integrations/api/aikido/rest](https://app.aikido.dev/settings/integrations/api/aikido/rest).

### Test Coverage
Backend enforces a minimum of **80% coverage (lines + branches)** via `pytest-cov` (`backend/pyproject.toml`, `--cov-branch --cov-fail-under=80`) — `pytest` fails the run if coverage drops below that.

- `.github/workflows/backend-ci.yml` runs the backend test suite (incl. the coverage gate) on every push to `main` and on every PR.
- The `test` job is a required status check on `main` (see Branch Strategy), so a coverage drop blocks the merge.
- API endpoint tests use an in-memory SQLite DB (`backend/tests/conftest.py`, `get_db` override) — no Docker/Postgres needed to run the suite.
- Because of that, the suite never runs the Alembic migrations. The separate `migrations` CI job does, against a real Postgres 16 service: `alembic upgrade head`, `alembic check` (fails if models and migrations have drifted — i.e. a model change without a migration), `alembic downgrade base`, `alembic upgrade head`.

Frontend mirrors the same 80% (lines + branches) bar via Vitest's built-in coverage (`frontend/vite.config.ts`, `test.coverage.thresholds`), run with `npx vitest run --coverage`. `.github/workflows/frontend-ci.yml`'s `test` job runs `tsc -b` plus that command on every push to `main` and every PR — a required check, like the backend's `test`.

### Linting & Formatting
Backend uses `ruff` (`backend/pyproject.toml`, `[tool.ruff]`) for both linting and formatting.

- `ruff check .` and `ruff format --check .` run as part of `.github/workflows/backend-ci.yml`'s `lint` job on every push to `main` and on every PR — a required check.
- Before committing backend changes: `ruff check --fix .` then `ruff format .` — or let pre-commit do it: `.pre-commit-config.yaml` runs ruff on staged backend files and refuses commits on `main` (catches it locally, before the push that branch protection would reject). One-time setup per clone: `pre-commit install` (the package is in `requirements-dev.txt`).

- `B008` (flake8-bugbear: no function calls in argument defaults) is deliberately ignored — it flags FastAPI's `Depends(...)` default-argument pattern, which is correct FastAPI usage, not a bug.

Frontend uses ESLint (`frontend/eslint.config.js` — `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-config-prettier` to defer style to Prettier) for linting and Prettier (`frontend/.prettierrc.json`) for formatting, per [ADR-0013](docs/adr/0013-frontend-architecture-and-tooling.md).

- `npm run lint` (`eslint .`) and `npm run format:check` (`prettier --check .`) run as part of `.github/workflows/frontend-ci.yml`'s `lint` job — a required check, like the backend's.
- Before committing frontend changes: `npm run lint -- --fix` then `npm run format` — or let pre-commit do it: the `frontend-eslint`/`frontend-prettier` local hooks in `.pre-commit-config.yaml` run against staged `frontend/` files. One-time setup per clone: `cd frontend && npm install` (in addition to `pre-commit install`).

### Python version
`.python-version` (repo root) is the single source for local dev and CI (`actions/setup-python` → `python-version-file`). `render.yaml` still pins `PYTHON_VERSION` explicitly (see the comment there) — bump both together.

### Architecture Documentation
This project doubles as a reference sample (incl. for job applications), so architectural reasoning is recorded, not just the resulting code.

- **`docs/ARCHITECTURE.md`**: living current-state overview (components, diagram). Describes *what exists*. Keep it accurate to the actual state of the repo — shrink the "Not yet built" list as things land, don't write aspirationally.
- **`docs/adr/`**: Architecture Decision Records, one file per decision, numbered sequentially (`NNNN-title.md`), using `docs/adr/template.md` (Context / Decision / Consequences). Describes *why*. See [docs/adr/0001-use-architecture-decision-records.md](docs/adr/0001-use-architecture-decision-records.md) for the full rationale.
- Write an ADR when a decision would be genuinely costly to reverse or non-obvious to a future reader (e.g. auth flow, grading-request architecture, deployment topology) — not for routine implementation choices already covered elsewhere in this file.
- Superseding a decision: add a new ADR referencing the old one, mark the old one "Superseded by ADR-NNNN". Don't edit history away.

### Postman Collection
`postman/sks-lotse.postman_collection.json` is generated from the FastAPI app's live OpenAPI schema — never edit it by hand, it will just get overwritten.

- Regenerate after any API change: `./scripts/generate_postman_collection.sh` (needs the backend venv set up and Node/npx available), then commit the result.
- `.github/workflows/backend-ci.yml` (`postman-collection` job) regenerates it in CI and fails the build if the committed file is out of date — a required check, so a stale collection blocks the merge.
- Every request in the collection uses a `{{baseUrl}}` variable (collection variable, default `/`). `postman/local.postman_environment.json.example` and `postman/production.postman_environment.json.example` are static, hand-maintained templates. **Copy each to the same name without `.example`** (gitignored — real copies hold live secrets, e.g. a JWT for testing protected endpoints) and import *those*, then switch between them via Postman's environment dropdown. Update the production URL in the copy if a custom domain is wired up later.
- When importing in Postman: use a plain one-off **Import**, not the Git-sync "Local Mode" — that mode (a) wants to upgrade the file to Postman's v3 YAML format, which would conflict with the JSON the generator script produces and the CI freshness check expects, and (b) writes whatever you enter in the app back to disk, which is exactly how a real secret ended up in a tracked file once already (the `X-Access-Key` this project used before real JWT auth landed — renaming the committed files to `.example` and gitignoring the real ones makes that impossible now).

### Integration Tests (external / non-pytest)
`postman/integration-tests.postman_collection.json` is a separate, hand-written Postman collection — not the OpenAPI-generated API reference above. It black-box tests a real, running local backend over HTTP: auth guards, CORS, security headers, the full OTP login round-trip (request → verify → `/me` → `/logout`), the question catalog/topics/progress endpoints incl. exam-variant filtering, profile updates (`PATCH /auth/me`), the email-change and self-delete flows (purpose-bound codes, per-user cap), the admin GDPR tools (incl. the non-admin 403s), and both OTP rate limits actually tripping. Point of it: runnable without a Python environment, e.g. in CI or by hand.

- Run it with `./scripts/run_integration_tests.sh` (wraps `newman run ... -e postman/local.postman_environment.json`, via `npx`) against an already-running local server (`cd backend && uvicorn app.main:app --reload`). Server requirements: `ADMIN_EMAILS` must include the collection's `adminEmail` (default `integration-admin@example.com`); if `ALLOWED_EMAILS` is set it must include all five `integration-*@example.com` test addresses; use a freshly started server (rate-limit counters, dev-peek codes) on a scratch DB with the catalog seeded, and leave `RESEND_API_KEY` empty so the test addresses never get mail. It creates and deletes throwaway users. CI runs it in `backend-ci.yml`'s `integration-tests` job (real uvicorn + Postgres, `alembic upgrade head` first) — the one CI job that is **not** a required status check (see Branch Strategy), so verify it's green before merging.
- The OTP round-trip needs the real, one-time plaintext code — pytest gets this for free by monkeypatching the email service in-process; an external HTTP client can't. `GET /api/v1/auth/otp/_dev-peek` (`backend/app/api/v1/auth.py`) exists to bridge that gap: it returns the last code generated for an email, 404s outright unless `ENVIRONMENT` is `development` or `test` (an opt-in allowlist, so it fails closed), is never populated at all otherwise either, and is excluded from the OpenAPI schema so it never surfaces in the API reference collection above. See [docs/adr/0011](docs/adr/0011-dev-only-otp-peek-endpoint-for-external-integration-tests.md).
- Not covered: `RedirectSecondaryDomainsMiddleware` (the canonical-domain redirect) — it keys off the `Host` header, which Postman/Newman silently drop rather than send as given (a restricted header, same idea as a browser's `fetch()`). Verify that one manually: `curl -i -H 'Host: sks-lotse.com' {{baseUrl}}/health`.
- Run order matters within the collection (documented in its own description too): Auth Flow's token is reused by Questions and Logout, Logout must come after both since it deliberately invalidates that token, and Rate Limiting must run last since it deliberately exhausts the OTP-endpoint quota for the caller's IP for the next hour.
- **Cookies are off except where they're the point.** `Verify OTP` also sets the httpOnly session cookie (ADR-0012), `get_current_user` reads it before any `Authorization` header, and Newman keeps a cookie jar across requests — so every request that authenticates via Bearer, or deliberately sends no credentials (the `... is rejected` auth guards), sets `"protocolProfileBehavior": {"disableCookies": true}`. Without it, the jar silently authenticates them and the guards pass requests they should reject. Only the requests with "session cookie" in their name leave cookies on, to test the cookie path itself. Do the same for any new request.
- **Keep it up to date — this is enforced, not just a convention.** Unlike `sks-lotse.postman_collection.json`, this one is hand-written, not generated from the OpenAPI schema, so it can't be regenerated. Two things stop it from drifting: (1) `backend/tests/test_integration_collection.py` (part of the normal pytest run) fails when an `/api/v1` route or `/health` has no request in the collection, when a request points at a route that no longer exists, when a request has no `pm.test` assertion, or when a Bearer/`... rejected` request forgets `disableCookies`; (2) CI actually executes the collection against a real server. So **any PR that adds/changes/removes an endpoint or its behavior updates the matching requests and `pm.test` assertions here in the same PR**, the same way `backend/tests/` gets updated — a new endpoint needs at least a happy path, its auth guard (401, plus 403 where role-gated) and its main validation failure. A route declared with `include_in_schema=False` isn't discovered by the coverage test automatically — add it to `_UNDOCUMENTED_ROUTES` there. A change to the server requirements above (new env var the run needs, new test address) is documented in this section, the collection description and `scripts/run_integration_tests.sh`'s header.

### Deployment (Render)
Provisioned as code via `render.yaml` (repo root) — see [docs/adr/0005-render-deployment-topology.md](docs/adr/0005-render-deployment-topology.md) for the backend/DB reasoning and [ADR-0015](docs/adr/0015-frontend-deployment-topology.md) for the frontend. Two web services (backend, Python; frontend, static site) + one managed Postgres, Frankfurt region, production only (no staging yet). Subdomain split: `sks-lotse.de`/`www.sks-lotse.de` → frontend, `api.sks-lotse.de` → backend (the frontend's `VITE_API_BASE_URL`), `sks-lotse.com`/`www.sks-lotse.com` → backend, unchanged, still 301s to `.de`.

One-time manual steps (account-level actions, done by the project owner, not by Claude Code):
1. Connect the GitHub repo to a Render account.
2. "Deploy from Blueprint" using `render.yaml`.
3. Set the `sync: false` secrets (`JWT_SECRET`, `OPENAI_API_KEY`, `ADSENSE_CLIENT_ID`, `RESEND_API_KEY`, `ALLOWED_EMAILS`, `ADMIN_EMAILS`) on the backend service, and `VITE_UMAMI_WEBSITE_ID` (from the Umami Cloud dashboard's tracking-code snippet — not a secret, just kept out of the repo, see [ADR-0016](docs/adr/0016-umami-cloud-analytics-without-consent-banner.md)) on the `sks-lotse-frontend` service, in the Render dashboard — never commit their values.
4. Point the purchased domains (`sks-lotse.de` etc., see Naming / Domain below) at the Render service once it's live.
5. Once the `sks-lotse-frontend` service exists (added to `render.yaml` after step 2 — trigger a Blueprint Sync in the Render dashboard if it doesn't appear on its own): add `sks-lotse.de`/`www.sks-lotse.de` as Custom Domains there, then **remove** them from the backend service (a domain can only be attached to one service). Add `api.sks-lotse.de` to the backend, and add a matching `CNAME api → sks-lotse-backend.onrender.com` in IONOS DNS.

After that, every commit to `main` auto-deploys (`autoDeployTrigger: commit`) on both services.

### Auth & rate limiting
How it works is described in `docs/ARCHITECTURE.md` → Auth (and ADR-0007/0008/0011); the rules to follow when adding code:

- **New `/api/v1` routes require a JWT.** Opt a router in via `dependencies=[Depends(get_current_user)]` (see `backend/app/api/v1/questions.py`), or take `current_user: User = Depends(get_current_user)` per route. The only intentionally open routes are `POST /auth/otp/request` and `POST /auth/otp/verify` (that's how a caller gets a token) and `/health` (Render's health check).
- **Rate limiting is automatic** for everything under `/api/v1` (shared per-IP bucket, `backend/app/core/rate_limit.py`). An expensive or abusable new endpoint (e.g. the LLM grading call) gets its own tighter exact-path rule in `backend/app/main.py`.
- **Accept email addresses via `NormalizedEmail`** (`backend/app/schemas/auth.py`), never plain `EmailStr` — every per-email lookup and quota relies on the lowercased form.
- **Dev/test-only endpoints are gated on `settings.exposes_dev_tooling`** (an allowlist that fails closed), never on `not settings.is_production`, and declared with `include_in_schema=False`.
- **The session token lives in an httpOnly cookie, not `localStorage`** ([ADR-0012](docs/adr/0012-httponly-cookie-for-frontend-session-token.md)) — set/cleared by `verify_otp`/`logout` in `backend/app/api/v1/auth.py`, read by `get_current_user` in `backend/app/core/jwt.py` (cookie first, falling back to `Authorization: Bearer` for Postman/the integration-test suite). The frontend never reads or stores it directly; a new frontend auth call just needs `credentials: "include"` (already the default in `frontend/src/api/client.ts`).

### Data Layer Conventions
Apply these four checks whenever adding or changing a database table — going forward, not just at initial design time:

- **Temporary/transient data needs cleanup.** If a table accumulates rows that are only useful for a bounded time (codes, tokens, sessions, request logs), decide how they get deleted before shipping the feature, not after the table grows unbounded. Doesn't have to be a scheduled job — piggybacking cleanup on an existing write path (delete-on-insert) is a legitimate, infrastructure-free answer for an MVP at this scale; run it as a background task (`BackgroundTasks.add_task`) rather than inline if the delete would otherwise add latency to that request — the task opens its own session via `get_session_factory` (`backend/app/core/database.py`), never the request's `get_db` one — and see the throttling rule below so its frequency doesn't scale with request volume. Example: `otp_codes` cleanup in `request_otp` ([docs/adr/0010](docs/adr/0010-opportunistic-otp-code-cleanup.md)).
- **Index for the read pattern, not just uniqueness.** When a table will see meaningful read volume, check the actual query shape (equality vs. range, which columns together, which column(s) each *distinct* query filters on) and index accordingly — a composite index in filter/sort order usually beats several single-column indexes for queries that share a filter prefix, but a query with an unrelated filter (no shared leading column) still needs its own index; one composite can't cover every access pattern on a table. Also drop a single-column index once a composite index makes it a redundant subset. Example: `otp_codes` ended up with `(email, created_at)` for the two email-scoped lookups, plus a separate `expires_at` index for the cleanup sweep, which filters on neither column those share.
- **Gate opportunistic/periodic maintenance work that piggybacks on request traffic**, so its cost is bounded regardless of how often the triggering endpoint gets called — under heavy load, "once per request" for something that only needs to run every few minutes is wasted work, not free just because it avoided a scheduled job. Use `cache.throttle(app, key, min_interval_seconds)` (`backend/app/core/cache.py`) to cap it to a cadence, the same practical effect as a cron job without standing up a scheduler. Reach for a real scheduler (a Render Cron Job) instead only once the app has one for other reasons — not preemptively for this alone. Example: `otp_codes` cleanup throttled to once per `OTP_CLEANUP_MIN_INTERVAL_SECONDS` ([docs/adr/0010](docs/adr/0010-opportunistic-otp-code-cleanup.md)).
- **Consider caching for read-heavy, rarely-written data**, local (in-process) first — no new infrastructure until there's a concrete reason for it (multiple instances, restarts frequent enough to matter) — but behind an interface that could swap to a shared store like Redis later without callers changing. `backend/app/core/cache.py` is that interface; see [docs/adr/0009](docs/adr/0009-in-process-cache-for-question-catalog.md) and [docs/adr/0007](docs/adr/0007-in-memory-per-ip-rate-limiting.md) (the rate limiter established the same local-first-but-swappable pattern for a different kind of state).

---

## Environment Variables (backend)

`backend/.env.example` lists every backend env var with its default, and `backend/app/core/config.py` (`Settings`) is the authoritative definition — keep both in sync when adding one, rather than listing them again here. `render.yaml` declares which ones production sets. What's not obvious from those files:

- **`ENVIRONMENT`** — one of `development` (default), `test`, `production`; anything else (e.g. a `prod` typo) fails at startup. Render sets `production`. Dev-only tooling (Swagger UI/ReDoc/OpenAPI schema, the OTP `_dev-peek` endpoint) is enabled only for `development`/`test` (`Settings.exposes_dev_tooling`).
- **`JWT_SECRET`** — required, at least 32 characters in every environment, no fallback. Signs JWTs; a key derived from it hashes OTP codes (`backend/app/core/otp.py`). Generate with `openssl rand -hex 32`. Rotating it invalidates all sessions and pending OTP codes.
- **`RESEND_API_KEY`** — the sending domain must be verified at Resend via IONOS DNS records before OTP emails go out. Locally it can stay empty: the API still returns 202 and logs the failed send.
- **`ALLOWED_EMAILS`** — comma-separated allowlist for the private beta; unset = open to everyone. Non-listed addresses get the same generic 202 with no code and no email.
- **`ADMIN_EMAILS`** — comma-separated allowlist gating the GDPR admin tools (`/admin`, see Accounts below). Unlike `ALLOWED_EMAILS`, unset/empty = **no admins** (fails closed) — the inverse default, since an unset var here must never grant access.
- **Tuning knobs** (`OTP_*`, `RATE_LIMIT_*`, `CATALOG_CACHE_TTL_SECONDS`, `JWT_ACCESS_TOKEN_EXPIRES_MINUTES`) — optional; defaults are the production values, the env vars exist so local dev/CI can loosen them.
- **Not an env var:** the disposable-email-domain blocklist is bundled data (`disposable-email-domains` in `requirements.txt`) — Dependabot bumps it.
- **Planned, not yet read by the app:** `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`, `FACEBOOK_OAUTH_CLIENT_ID`/`_SECRET`, `X_OAUTH_CLIENT_ID`/`_SECRET` (SSO isn't built). `ADSENSE_CLIENT_ID` and `OPENAI_API_KEY` are already in `Settings`/`render.yaml` but unused until ads/grading land.
- **`ANTHROPIC_API_KEY`** — only used locally by `backend/scripts/manage_topics.py` (see Question Catalog) to classify questions into topics; not read by the running app, not set on Render.

---

## Naming / Domain

- Name: SKS Lotse
- Domains purchased 2026-09-16 via IONOS: `sks-lotse.de` (primary — target market/language is German), `sks-lotse.com`, `sks-lotse.global`, `sks-lotse.store`
- No conflicting product name found in search (existing competitors: SKS-Buddy, official SKS App, SBF-Fragen by Delius Klasing)
- **Open**: no formal trademark search done (DPMA/EUIPO) — recommended before committing further to branding
- `sks-lotse.de`/`www.sks-lotse.de` are wired to Render as Custom Domains on the **frontend** service (`sks-lotse-frontend`) — moved there from the backend directly; see CLAUDE.md → Deployment (Render), step 5, for the one-time manual switch this needed.
- `sks-lotse.com`/`www.sks-lotse.com` stay wired to the **backend** service and 301-redirect to `sks-lotse.de` via `backend/app/core/canonical_domain.py` (`RedirectSecondaryDomainsMiddleware`) — **not** via IONOS's paid domain forwarding (~8 EUR/month, 12-month minimum, just for SSL on the redirect). Costs nothing beyond the domain itself.
- `api.sks-lotse.de` is a Custom Domain on the **backend** service — what the frontend's `VITE_API_BASE_URL` points at. Not itself meant to be browsed directly (no UI there, just the JSON API).
- `sks-lotse.global` and `sks-lotse.store` are purchased but **not currently used** — no DNS, no Render Custom Domain, not in `SECONDARY_HOSTS`. Add them the same way as `.com` (DNS at IONOS, Render Custom Domain, add to `SECONDARY_HOSTS`) if/when needed.
