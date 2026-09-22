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
| Answer check (LLM) | Anthropic API (Claude Haiku), stateless, suggests a grade + feedback ([ADR-0031](docs/adr/0031-ai-answer-check-with-claude-haiku.md)) |
| Speech-to-text | Web Speech API (browser-native, Chromium-based browsers) — no backend/cloud STT |
| Ads | Google AdSense |
| Analytics | Umami Cloud (Hobby plan, cookieless, EU region — [ADR-0016](docs/adr/0016-umami-cloud-analytics-without-consent-banner.md)) |
| Uptime monitoring | Better Stack; public status page at [sks-lotse.betteruptime.com](https://sks-lotse.betteruptime.com) (dashboard-configured) |
| Hosting | Render (Frankfurt EU — all services) |
| CI/CD | GitHub Actions → auto-deploy on push to main |

---

## Repository Structure

```
sks-lotse/
├── backend/
│   ├── app/
│   │   ├── api/v1/     # Route handlers (/api/v1/auth, /questions + /topics, /progress, /exams, /admin)
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
│   │   ├── pages/      # LandingPage, LoginPage, StartPage, LearnPage, PracticePage, FocusPracticePage, ExamPage, ExamRunPage, ProfilePage, AdminPage, ImprintPage, PrivacyPage
│   │   ├── routes/     # ProtectedRoute
│   │   └── store/      # Zustand auth store
│   ├── .env.example
│   └── package.json
├── docs/               # ARCHITECTURE.md, adr/, postman-and-integration-tests.md, question catalog source PDF
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
4. **If not**: the official model answer is shown for the learner to self-compare against — no forced writing step (an optional scratchpad field is never sent), no LLM call. The learner then grades themselves (Richtig / Teilweise Richtig / Falsch), which moves the question's memory half-life exactly like an AI grading would ([ADR-0023](docs/adr/0023-self-assessed-learning-flow.md)). Accounts with `ai_grading_enabled` (set by the operator on `/admin` (`PATCH /admin/users/{id}`) until payment exists) additionally get an "Antwort prüfen lassen" button that asks Claude Haiku for a *suggested* grade + feedback ([ADR-0031](docs/adr/0031-ai-answer-check-with-claude-haiku.md)), limited to a weekly budget (week starts Monday; default 100, set on `/admin/settings`, overridable per account on `/admin`, [ADR-0036](docs/adr/0036-weekly-ai-check-budget-with-admin-overrides.md)); the learner still confirms the grade themselves.
5. **Prüfungssimulation** (`/exam`): a random Fragebogen (30 questions, 9/7/5/9 by subject, 90 minutes enforced server-side, no tips) is answered in full, then self-assessed question by question, with the same "Antwort vom Lotsen bewerten lassen" AI check available there as in practice (`ai_grading_enabled` accounts, drawing from the same weekly budget as ADR-0031); history and statistics (in `/profile`) are kept per account. Once the last question is graded, the "Richtig" answers count like practice gradings for the half-life ("Teilweise"/"Falsch" don't lower it, [ADR-0037](docs/adr/0037-exam-richtig-answers-feed-the-lernstand.md)). Only the Fragebogen — the Kartenaufgabe isn't simulated ([ADR-0029](docs/adr/0029-exam-simulation.md)).
6. Learners can mark topics as **Fokus** (star on `/learn`); the Fokus band shows how many of those questions are sicher gelernt (half-life model, next bullet) or teilweise gelernt. The band starts the **Fokus session** (`/learn/fokus`): all not-yet-gelernt questions of the Fokus topics in one run, independent of topic, the one whose last "Richtig" is longest ago first (never-answered questions first, then never-correct ones; `question_progress.last_correct_at`). A Fokus topic drops out permanently once all its questions are learned ([ADR-0028](docs/adr/0028-focus-topics.md)). Focus marks are deleted with the account and part of the admin DSGVO export.
7. **"Gelernt" is a half-life estimate, not a streak** ([ADR-0034](docs/adr/0034-half-life-model-for-gelernt.md)): each grading re-estimates the question's memory half-life ("Richtig" grows it, scaled by the spacing since the last grading; "Teilweise"/"Falsch" shrink it); a question is gelernt while the half-life is ≥ 7 days and the estimated recall probability is ≥ 0.7, and resurfaces once it decays below. Constants live in `backend/app/core/progress.py`. The UI never shows the numbers (ADR-0024).
8. Progress is synced server-side against the logged-in account. If the account hasn't paid to remove ads, ads (Google AdSense) are shown.

---

## Question Catalog

- Source: official SKS question catalog, provided as PDF (`docs/Fragenkatalog-SKS.pdf`, questions + official model answers). The exam is offered in two variants by propulsion type — **"Segeln und Motor"** (492 questions: Navigation + Schifffahrtsrecht + Wetterkunde + Seemannschaft I) and **"Motor"** (475 questions: ... + Seemannschaft II) — a learner sits one or the other, not both.
- **Images**: 23 charts/sketches embedded in the PDF (light configurations, weather maps, mooring/manoeuvre sketches) are extracted by `backend/scripts/extract_catalog_images.py` into `frontend/public/catalog/` and assigned to their question (and to the question or the official answer) in the reviewed `backend/scripts/data/question_images.yaml`; `questions.question_images`/`answer_images` (JSON lists of `{src, width, height}`) carry them to the API, `frontend/src/components/QuestionImages.tsx` shows them ([ADR-0033](docs/adr/0033-catalog-images-as-static-files.md)). For 3 stored questions the official answer is *only* a sketch, so their `answer_text` is empty and the answer is an image. The catalog has no images for Navigation.
- **Subjects**: `navigation`, `schifffahrtsrecht`, `wetterkunde`, and — since Seemannschaft I and II are ~65% word-for-word identical (safety equipment, anchoring, MOB, ropework; only rigging/sail-trim vs. engine/boat-type content really differs) — the merged `seemannschaft_allgemein` (shared questions, stored once, in the Seemannschaft I wording — so a pair is only merged if question and answer match word for word, or a human accepted the difference as purely editorial, see [ADR-0026](docs/adr/0026-merge-seemannschaft-only-on-matching-wording.md)), `seemannschaft_segeln` (I-only) and `seemannschaft_motor` (II-only), rather than two subjects with heavy duplication. `app/core/exam_variant.py` maps each of the two exam variants to its full subject set.
- **Topics**: every question can carry a `topic_id` into the `topics` table. Topic *names* are transcribed verbatim from the catalog's own official table of contents (`docs/Fragenkatalog-SKS.pdf`, pages 1–3) into `backend/scripts/data/topics.yaml` — never invented by a script or an LLM. See [ADR-0017](docs/adr/0017-official-topic-taxonomy-and-seemannschaft-merge.md).
- **The catalog seeds itself automatically.** `backend/app/services/catalog_seed.py` (`seed_catalog()`) is the single source of truth for PDF → `questions`/`topics` rows, and it runs as Alembic **data migrations** (`alembic/versions/16af6f481bf6_seed_question_catalog.py`, re-applied by `5499671351cd`) — meaning every `alembic upgrade head` populates the full catalog, including Render's `startCommand` before every deploy. No one has to remember to run a script against production; the schema migration and the data that belongs with it land together. Downgrading `16af6f481bf6` deletes all `questions`/`topics` rows.
- **Syncing is an upsert, never delete + insert** ([ADR-0022](docs/adr/0022-catalog-sync-by-upsert.md)): `build_catalog()` computes the full target state in memory, `sync_catalog()` upserts it keyed on `(subject, number)` / `(subject, slug)`, so question ids — and every learner's `question_progress` — survive a re-sync; only a question that vanished from the catalog is deleted. Seemannschaft rows are first moved to their new key by their *official* numbers (`seemannschaft_1_number`/`_2_number`), since `seemannschaft_allgemein`'s `number` is derived and shifts whenever the duplicates list changes (ADR-0026). `sync_catalog()` writes through table definitions frozen in that module, never the ORM models, so old data migrations keep working when models gain columns. Adding columns is free; renaming/dropping a frozen one needs the old migrations to get their own copy of the logic.
- Getting there is a 3-stage pipeline, but only the proposing halves of stages 2 and 3 are run by hand, from a developer's machine — the migrations call nothing but the DB:
  1. **Parse**: `parse_catalog_pdf()` turns the PDF into raw questions (still `seemannschaft_1`/`seemannschaft_2` at this point). `clean()` joins lines the PDF merely wrapped into one (the layout's line breaks aren't part of the text) and keeps only breaks before list items (`1.`, `a)`, `-`, `•`); the frontend renders the rest with `whitespace-pre-line`. Chart symbols the PDF flattens to plain digits are restored in Unicode via `QUESTION_TEXT_FIXES` (Navigation 84: drying height, underlined digit + subscript digit) and drawn as real markup by `frontend/src/components/RichText.tsx`; likewise `ANSWER_TEXT_FIXES` (Navigation 48: the PDF drops the subscripts of O_k/O_b and appends `k b` after the sentence) writes them as `O_k`/`O_b`, which `RichText` renders as `<sub>`. Known parsing limitations are listed in `backend/scripts/import_catalog.py`'s docstring.
  2. **Merge**: `backend/scripts/merge_seemannschaft.py` computes candidate duplicate pairs by plain text-similarity (no LLM) into `scripts/data/seemannschaft_duplicates.yaml` for a human to review by hand; `merge_seemannschaft()` then reads that reviewed file and collapses `seemannschaft_1`/`seemannschaft_2` into the 3 subjects above. A pair whose question or answer isn't word-for-word identical needs an `accepted_difference` rationale or the merge refuses to run; `backend/scripts/diff_seemannschaft_pairs.py` prints a word diff of every such pair for review.
  3. **Classify**: `backend/scripts/manage_topics.py` calls the Anthropic API (`settings.anthropic_api_key`, a local dev-tooling-only credential, separate from `OPENAI_API_KEY`/the grading feature below) to classify questions into the fixed names from `topics.yaml`, writing `scripts/data/topic_assignments/<subject>.yaml` for a human to review by hand (`--missing` classifies only questions without an assignment, e.g. after un-merging a pair); `assign_topics()` then applies that reviewed file. The LLM only ever classifies into existing names — it never invents or renames a topic.
  - The proposing scripts (incl. `extract_catalog_images.py`, see Images above) read the PDF directly — no DB needed. `backend/scripts/import_catalog.py` syncs a local DB with the committed files (same code as the migrations) to check the result.
  - Only the *review artifacts* (`seemannschaft_duplicates.yaml`, `topic_assignments/*.yaml`, `question_images.yaml` plus the PNGs it lists) need to exist before `alembic upgrade head` can seed a new environment — they're committed to the repo, so this is already true everywhere. Re-running the proposing scripts (and re-reviewing) is only needed if the source PDF or the topic taxonomy itself changes; a new data migration calling `sync_catalog(op.get_bind(), build_catalog())` then ships the updated result.
- `Question.seemannschaft_1_number` / `seemannschaft_2_number` (nullable) preserve the original amtliche "Nummer N" from each variant's own catalog once step 2 renumbers `seemannschaft_allgemein` — both are set for a merged row, exactly one for a `_segeln`/`_motor` row, both `NULL` for the other 3 subjects.
- **Exam variant is an explicit account attribute**, not just inferred from which Seemannschaft subject a learner reads: `User.exam_variant` (nullable, `"motor"` | `"segeln_und_motor"`, set via `PATCH /api/v1/auth/me`). `GET /questions`/`/questions/random` filter to the variant's subjects by default; an explicit `subject` query param always overrides it. Settable from `/learn` (a small header dropdown) and from `/profile`.
- **`/profile`** (frontend, protected route) is the learner's self-service account page: edit optional `first_name`/`last_name`/`gender` (all nullable, blank = "keine Angabe"; `gender` validated against a fixed set the same way as `exam_variant` — see `GenderField` in `backend/app/schemas/auth.py`), switch `exam_variant`, view learning progress (reuses `GET /progress/summary`) and the exam statistics (`GET /exams/stats`), change the account's email address, and delete the account. Once a name is set, it's shown instead of the email address wherever the learner's own identity is displayed (`getDisplayName` in `frontend/src/api/types.ts`).
  - Changing email is a verify-before-commit flow, not a bare `PATCH`: `POST /api/v1/auth/me/email/request` sends a confirmation code to the *new* address (reusing the login-OTP machinery in `backend/app/core/otp.py`/the `otp_codes` table), rejecting up front with `409` if that address already belongs to another account (or `403` if `ALLOWED_EMAILS` is set and the address isn't on it); codes are purpose-bound (`otp_codes.purpose`), so an email-change code never works as a login code; `POST /api/v1/auth/me/email/verify` checks the code and commits the change, `409`-ing again if the address was claimed by someone else in the meantime. Rate-limited two ways: per-IP (`backend/app/main.py`, same tightness as `/auth/otp/request`) and per-authenticated-user (`check_and_record` in `backend/app/core/rate_limit.py`, since the per-IP cap alone doesn't stop one account probing many addresses from multiple IPs).
  - `DELETE /api/v1/auth/me` lets a learner delete their own account (confirmed in the UI by retyping their own email, same idiom as the admin GDPR delete tool). The actual deletion logic (`QuestionProgress` rows, then the `User` row) lives in `backend/app/services/user.py:delete_user_and_progress`, shared with the admin-triggered delete in `backend/app/api/v1/admin.py`.

---

## Monetization

Freemium, with two independent paid add-ons (not bundled — a learner can buy either, both, or neither):

- **Remove ads** (Google AdSense) — default (free) accounts see ads. Flag `users.ads_removed` (exposed on `UserRead`), set by the operator on `/admin` (`PATCH /admin/users/{id}`, same call and page as the AI check) until payment exists; the frontend hides ad elements via `useShowAds()` (`frontend/src/ads.ts`). The AdSense script itself is only in the `<head>` of the public prerendered pages, never in the logged-in app ([ADR-0027](docs/adr/0027-adsense-with-google-consent-management.md), [ADR-0041](docs/adr/0041-no-ad-script-in-the-logged-in-app.md)).
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
- **Feedback channels** ([ADR-0030](docs/adr/0030-question-reports-and-feedback-channels.md)): a "Feedback" `mailto:` link (footer + account nav), "Frage melden" under every question (`POST /questions/{id}/report` → `question_reports`, read by the operator via `GET /admin/question-reports`; deleted with the account and in the DSGVO export), and coarse Umami funnel events via `trackEvent` (`frontend/src/analytics.ts` — fixed keys only, never free text).

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
- Neither workflow has path filters, so the required checks run (and must pass) even on docs-only PRs.

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

### Security Scanning (Aikido)
Aikido Security is connected to this GitHub repo.

- A PR must not be merged while Aikido reports open findings, unless the finding is explicitly triaged/accepted first. **This is checked by hand before each merge** — there is no Aikido job in CI and no required status check for it (removed 2026-09-19: Aikido's free plan rejects API access with "This action is not allowed on the free plan", so the job failed on every PR). The `AIKIDO_CLIENT_ID`/`AIKIDO_CLIENT_SECRET` GitHub Actions secrets are unused now.
- `scripts/check_aikido.sh` queries the Aikido API directly for open findings on the repo (whichever branch Aikido last scanned) — run it locally instead of asking for a dashboard screenshot (needs a plan with API access; otherwise it prints the API error and exits 1 — use the dashboard then). Needs `.env.aikido` (gitignored, not committed) with `AIKIDO_CLIENT_ID` / `AIKIDO_CLIENT_SECRET` from an API client created at [app.aikido.dev/settings/integrations/api/aikido/rest](https://app.aikido.dev/settings/integrations/api/aikido/rest).

### Test Coverage
Backend enforces a minimum of **95% coverage (lines + branches)** via `pytest-cov` (`backend/pyproject.toml`, `--cov-branch --cov-fail-under=95`) — `pytest` fails the run if coverage drops below that. The bar sits a few points under the actual value (~99%) on purpose: high enough to catch untested new code, with room for the odd defensive branch. Raise it when the actual value settles higher; don't lower it to get a PR through — test the code.

- `.github/workflows/backend-ci.yml` runs the backend test suite (incl. the coverage gate) on every push to `main` and on every PR.
- The `test` job is a required status check on `main` (see Branch Strategy), so a coverage drop blocks the merge.
- API endpoint tests use an in-memory SQLite DB (`backend/tests/conftest.py`, `get_db` override) — no Docker/Postgres needed to run the suite.
- Because of that, the suite never runs the Alembic migrations. The separate `migrations` CI job does, against a real Postgres 16 service: `alembic upgrade head`, `alembic check` (fails if models and migrations have drifted — i.e. a model change without a migration), `alembic downgrade base`, `alembic upgrade head`.

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
- Before committing backend changes: `ruff check --fix .` then `ruff format .` — or let pre-commit do it: `.pre-commit-config.yaml` runs ruff on staged backend files and refuses commits on `main` (catches it locally, before the push that branch protection would reject). One-time setup per clone: `pre-commit install` (the package is in `requirements-dev.txt`).

- `mypy app` (`[tool.mypy]` in `backend/pyproject.toml`) runs in the same `lint` job; a `# type: ignore` carries its reason after a second `#`. The frontend compiles with `"strict": true` (`tsc -b` in the `test` job).
- Complexity is capped via `C901`/`PLR0912` (`max-complexity`/`max-branches` = 10) — split a function rather than raising the ceiling. `PLR0913` (argument count) is deliberately off: FastAPI routes take their dependencies as arguments.
- The rule set is `E, F, I, UP, B, S, SIM, C4, RUF, C901, PLR0912` (`backend/pyproject.toml`). `B008` (flake8-bugbear: no function calls in argument defaults) is deliberately ignored — it flags FastAPI's `Depends(...)` default-argument pattern, which is correct FastAPI usage, not a bug. Tests are exempt from the bandit `S101`/`S105` and `RUF001` (asserts, dummy tokens, full-width test digits). A `# noqa` in app code carries its reason after a dash.

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

### Postman & integration tests
Two collections live in `postman/`; the how-to and the reasoning are in [docs/postman-and-integration-tests.md](docs/postman-and-integration-tests.md).

- `sks-lotse.postman_collection.json` is **generated** from the live OpenAPI schema — never edit it by hand. After any API change run `./scripts/generate_postman_collection.sh` and commit the result; the required `postman-collection` CI job fails on a stale file. Copy the `*.postman_environment.json.example` templates to the same name without `.example` (gitignored, they hold secrets) and use a plain one-off **Import**, never Postman's Git-sync "Local Mode".
- `integration-tests.postman_collection.json` is **hand-written** and black-box tests a running local backend (`./scripts/run_integration_tests.sh`; server requirements are in the script header). **Any PR that adds/changes/removes an endpoint or its behavior updates its requests and `pm.test` assertions in the same PR** — at least a happy path, the auth guard (401, plus 403 where role-gated) and the main validation failure. `backend/tests/test_integration_collection.py` fails when a route has no request, a request has no assertion, or a Bearer/`... rejected` request forgets `"protocolProfileBehavior": {"disableCookies": true}` (Newman's cookie jar would otherwise authenticate it); a route with `include_in_schema=False` goes into `_UNDOCUMENTED_ROUTES` there. CI runs the collection in the `integration-tests` job, which is **not** a required check — verify it's green before merging.

### Deployment (Render)
Provisioned as code via `render.yaml` (repo root) — see [docs/adr/0005-render-deployment-topology.md](docs/adr/0005-render-deployment-topology.md) for the backend/DB reasoning and [ADR-0015](docs/adr/0015-frontend-deployment-topology.md) for the frontend. Two web services (backend, Python; frontend, static site) + one managed Postgres, Frankfurt region, production only (no staging yet). Subdomain split: `sks-lotse.de`/`www.sks-lotse.de` → frontend, `api.sks-lotse.de` → backend (the frontend's `VITE_API_BASE_URL`), `sks-lotse.com`/`www.sks-lotse.com` → backend, unchanged, still 301s to `.de`.

One-time manual steps (account-level actions, done by the project owner, not by Claude Code):
1. Connect the GitHub repo to a Render account.
2. "Deploy from Blueprint" using `render.yaml`.
3. Set the `sync: false` secrets (`JWT_SECRET`, `OPENAI_API_KEY`, `ADSENSE_CLIENT_ID`, `RESEND_API_KEY`, `ALLOWED_EMAILS`, `ADMIN_EMAILS`) on the backend service, and `VITE_UMAMI_WEBSITE_ID` (from the Umami Cloud dashboard's tracking-code snippet — not a secret, just kept out of the repo, see [ADR-0016](docs/adr/0016-umami-cloud-analytics-without-consent-banner.md)) on the `sks-lotse-frontend` service, in the Render dashboard — never commit their values.
4. Once the `sks-lotse-daily-report` Cron Job exists (Blueprint Sync; it mails the daily KPI report, [ADR-0032](docs/adr/0032-daily-kpi-report.md)): set its `sync: false` secrets `JWT_SECRET`, `RESEND_API_KEY` and `ADMIN_EMAILS` to the same values as on the backend.
5. Point the purchased domains (`sks-lotse.de` etc., see Naming / Domain below) at the Render service once it's live.
6. Once the `sks-lotse-frontend` service exists (added to `render.yaml` after step 2 — trigger a Blueprint Sync in the Render dashboard if it doesn't appear on its own): add `sks-lotse.de`/`www.sks-lotse.de` as Custom Domains there, then **remove** them from the backend service (a domain can only be attached to one service). Add `api.sks-lotse.de` to the backend, and add a matching `CNAME api → sks-lotse-backend.onrender.com` in IONOS DNS.

After that, every commit to `main` auto-deploys (`autoDeployTrigger: commit`) on both services.

### Auth & rate limiting
How it works is described in `docs/ARCHITECTURE.md` → Auth (and ADR-0007/0008/0011); the rules to follow when adding code:

- **New `/api/v1` routes require a JWT.** Opt a router in via `dependencies=[Depends(get_current_user)]` (see `backend/app/api/v1/questions.py`), or take `current_user: User = Depends(get_current_user)` per route. The only intentionally open routes are `POST /auth/otp/request` and `POST /auth/otp/verify` (that's how a caller gets a token) and `/health` (Render's health check).
- **Rate limiting is automatic** for everything under `/api/v1` (shared per-IP bucket, `backend/app/core/rate_limit.py`). An expensive or abusable new endpoint (e.g. the LLM grading call) gets its own tighter exact-path rule in `backend/app/main.py`.
- **Accept email addresses via `NormalizedEmail`** (`backend/app/schemas/auth.py`), never plain `EmailStr` — every per-email lookup and quota relies on its canonical form (`canonicalize_email`, `backend/app/core/email_address.py`): lowercase, and for Gmail/Googlemail also without dots and `+tag`, with `googlemail.com` folded to `gmail.com`, so one inbox can't become many accounts. The `ALLOWED_EMAILS`/`ADMIN_EMAILS` allowlists are canonicalized the same way, so they may be written in any spelling. Anything new that compares or looks up an address outside a schema must call `canonicalize_email` itself.
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
- **Tuning knobs** (`OTP_*`, `RATE_LIMIT_*`, `GRADING_*` — incl. the fallback weekly AI-check budget `GRADING_MAX_PER_WEEK` (the operator overrides it on `/admin` and `/admin/settings`, [ADR-0036](docs/adr/0036-weekly-ai-check-budget-with-admin-overrides.md)), `CATALOG_CACHE_TTL_SECONDS`, `JWT_ACCESS_TOKEN_EXPIRES_MINUTES`) — optional; defaults are the production values, the env vars exist so local dev/CI can loosen them.
- **Not an env var:** the disposable-email-domain blocklist is bundled data (`disposable-email-domains` in `requirements.txt`) — Dependabot bumps it.
- **Frontend `VITE_ADSENSE_CLIENT_ID`** — Google AdSense publisher id (`ca-pub-…`), set on the frontend service only; unset = the ad script and the "Cookie-Einstellungen" footer button are absent ([ADR-0027](docs/adr/0027-adsense-with-google-consent-management.md)).
- **Planned, not yet read by the app:** `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`, `FACEBOOK_OAUTH_CLIENT_ID`/`_SECRET`, `X_OAUTH_CLIENT_ID`/`_SECRET` (SSO isn't built). `ADSENSE_CLIENT_ID` and `OPENAI_API_KEY` are already in `Settings`/`render.yaml` but unused (grading went to Anthropic, ADR-0031).
- **`ANTHROPIC_API_KEY`** — only used locally by `backend/scripts/manage_topics.py` (see Question Catalog) to classify questions into topics; not read by the running app, not set on Render.
- **`ANTHROPIC_GRADING_API_KEY`** — the running app's key for the AI answer check (`backend/app/services/grader.py`, ADR-0031; empty = the endpoint answers 503). A `sync: false` secret on Render; keep it a different key (own Console workspace) from `ANTHROPIC_API_KEY`.

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
