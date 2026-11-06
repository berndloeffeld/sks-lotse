# SKS Lotse

![Backend CI](https://github.com/berndloeffeld/sks-lotse/actions/workflows/backend-ci.yml/badge.svg)
![Frontend CI](https://github.com/berndloeffeld/sks-lotse/actions/workflows/frontend-ci.yml/badge.svg)

A web app to prepare for the theoretical exam of the German SKS (Sportküstenschifferschein) sailing license. The official exam catalog is free-text, not multiple choice — the learner writes an answer and has to judge for themselves whether it's close enough to the model answer. SKS Lotse tracks what a learner has actually retained, simulates the exam, and — on request — has an LLM compare the learner's free-text answer with the official one, *suggest* a grade and explain what was missing or wrong; the learner always confirms the grade.

**What's different from existing apps** (SKS-Buddy, the official SKS App — both already offer AI-graded free text): web-only (no app store), a learning status based on an estimated memory half-life rather than a streak, and the official Kartenaufgaben worked through task by task. Monetization is freemium without ads — pay per use for the AI check with a token balance — see [docs/adr/0043](docs/adr/0043-token-based-ai-grading-monetization.md) and [docs/adr/0060](docs/adr/0060-no-advertising.md) for the reasoning.

## How it was built

**Fully AI-built, human-directed, live in production.** Code, tests, migrations, workflows and docs were written by Claude through [Claude Code](https://claude.com/claude-code) (apart from Dependabot's bumps). The human part: what the product is, which option to take, what counts as done and goes live, plus what only a person can settle — sailing domain, catalog and chart rights, prices, operations. Live on Render; first commit 2026-09-16.

What keeps the AI on course:

- **Written rules:** [CLAUDE.md](CLAUDE.md) for working on the code; one owner document per topic, fixed in the same PR that makes it wrong.
- **Recorded decisions:** every non-obvious choice is an [ADR](docs/adr/README.md), so a new session (or reader) learns *why*.
- **Automatic gates:** required CI checks with coverage and mutation-score ratchets, plus tests that guard the conventions themselves — see [Testing & quality gates](#testing--quality-gates). [Hooks](.claude/hooks/) and pre-commit catch the rest.
- **A human merges:** one branch per change, squash-merged via PR, auto-merge off.

Commits name the model that wrote them (`Co-Authored-By`):

```bash
git log --format='%(trailers:key=Co-Authored-By,valueonly)' | sort | uniq -c | sort -rn
```

## Status

Live: email+OTP login, learning by topic with self-assessment against the official answers, Fokus and Auffrischen, the exam simulation (Fragebogen) with history and statistics, the Lotsen-Check (an LLM that suggests a grade, paid with tokens) with token packages bought through Stripe, and the admin tools. Also live: the Kartenaufgaben (all ten sheets), open to guests too, with their own Lotsen-Check. Not built yet: SSO, speech-to-text. What learners and operators can do today, incl. prices: [docs/FEATURES.md](docs/FEATURES.md); the technical current state and the full "not yet built" list: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + TypeScript, Zustand, Tailwind CSS |
| Backend | Python 3.12 / FastAPI |
| Database | PostgreSQL 18 |
| Auth | Email + one-time code (OTP), JWT sessions *(SSO not yet built)* |
| Transactional email | Resend |
| Answer check (LLM) | Anthropic API (Claude Haiku 5.5 for catalog questions, Claude Sonnet for Kartenaufgaben), pay-per-use with tokens — [ADR-0031](docs/adr/0031-ai-answer-check-with-claude-haiku.md), [ADR-0066](docs/adr/0066-lotsen-check-with-topic-context-on-haiku-5-5.md), [ADR-0043](docs/adr/0043-token-based-ai-grading-monetization.md), [ADR-0058](docs/adr/0058-lotsen-check-for-chart-exercises.md) |
| Payments | Stripe Hosted Checkout, fulfilled by webhook — [ADR-0048](docs/adr/0048-stripe-hosted-checkout-with-webhook-fulfilment.md) |
| Analytics | Umami Cloud (cookieless; hosting region: see [RUNBOOK](docs/RUNBOOK.md#where-things-live)) |
| Monitoring | Better Stack (uptime, status page, logs) |
| Hosting | Render (Frankfurt EU) |
| CI/CD | GitHub Actions |

## Privacy & security

Everything that remembers needs an account (only the topic learning and the Kartenaufgaben run in the browser without one). The user-facing statement, including every processor, is the in-app [Datenschutzerklärung](frontend/src/sks/pages/PrivacyPage.tsx) (`/privacy`).

- **Passwordless login:** email + one-time code, or the link in the same email ([ADR-0064](docs/adr/0064-login-link-in-the-code-email.md)).
- **Session:** JWT in an httpOnly cookie, never readable by JavaScript ([ADR-0012](docs/adr/0012-httponly-cookie-for-frontend-session-token.md)).
- **EU hosting** on Render in Frankfurt; the Lotsen-Check sends text to Anthropic (US) only on the learner's click and never their identity — what exactly: [FEATURES → Lotsen-Check](docs/FEATURES.md#lotsen-check-ai-assessment).
- **Details:** the threat model and its measures in [ARCHITECTURE → Threat model](docs/ARCHITECTURE.md#threat-model); vulnerabilities are reported privately, see [SECURITY.md](SECURITY.md).

## Architecture & decisions

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — current-state system overview (components, diagram)
- [docs/adr/](docs/adr/README.md) — Architecture Decision Records: the reasoning behind non-obvious or hard-to-reverse decisions, not just the resulting code (index with status)
- [docs/RUNBOOK.md](docs/RUNBOOK.md) — operating production: logs, deploys and rollback, backups, secrets, DSGVO requests
- [docs/catalog-pipeline.md](docs/catalog-pipeline.md) — how the official catalog PDF becomes the question database
- [docs/FEATURES.md](docs/FEATURES.md) — what the product can do today, in users' terms
- [docs/NON-FUNCTIONAL-REQUIREMENTS.md](docs/NON-FUNCTIONAL-REQUIREMENTS.md) — expected load and non-functional requirements

## Getting started

Requires Docker, Python 3.12 (`.python-version`), and Node 22 (`frontend/.nvmrc`). All commands assume the repo root as the working directory unless noted.

```bash
# 1. Start local Postgres
docker compose up -d

# 2. Set up the backend
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
sed "s/^JWT_SECRET=$/JWT_SECRET=$(openssl rand -hex 32)/" .env.example > .env  # .env with a fresh JWT secret
alembic upgrade head  # also seeds the full question catalog (data migration)

# 3. Run the API
uvicorn app.main:app --reload --port 8000
```

In a second terminal, the frontend:

```bash
cd frontend
npm install
cp .env.example .env  # points the app at the local API on :8000
npm run dev           # http://localhost:5173
```

**First login locally:** with `RESEND_API_KEY` left empty no email goes out, so read the code from the dev-only peek endpoint after requesting one on `http://localhost:5173/login`:

```bash
curl "http://localhost:8000/api/v1/auth/otp/_dev-peek?email=you@example.com"
```

To reach `/admin`, put your address into `ADMIN_EMAILS` in `backend/.env` and restart the API; `/admin` then stays closed until you have set up 2FA there, see [RUNBOOK → Admin 2FA](docs/RUNBOOK.md#admin-2fa). To try the Lotsen-Check, set `ANTHROPIC_GRADING_API_KEY` and credit your account some tokens on `/admin` (without the key the check answers 503).

API docs (Swagger UI): `http://localhost:8000/docs`. A [Postman collection](postman/sks-lotse.postman_collection.json) is also generated from the live OpenAPI schema — see below.

## Testing & quality gates

Backend — run from `backend/`, with the venv active:

```bash
pytest                # tests + line/branch coverage gate (threshold in backend/pyproject.toml)
ruff check .          # lint
ruff format --check . # formatting
mypy app              # type check
```

Frontend — run from `frontend/`:

```bash
npx tsc -b                  # type check
npx vitest run --coverage   # tests + line/branch coverage gate (thresholds in vite.config.ts)
npm run lint                # ESLint
npm run format:check        # Prettier
npm run build               # production build incl. prerender (what Render runs)
```

These run in CI on every PR and every push to `main`, together with the migration check against Postgres, the freshness of the generated Postman collection and API types, and the integration tests below; which jobs are required: [CLAUDE.md → Branch Strategy](CLAUDE.md#branch-strategy).

Optional but recommended, once per clone (from the venv, after `npm install` in `frontend/`): `pre-commit install --install-hooks -t pre-commit -t pre-push`. On commit it runs ruff, ESLint, Prettier and hygiene checks on staged files, and blocks commits directly on `main`. On push it also runs `mypy app` and `tsc -b`.

A separate, hand-written Postman collection black-box tests every endpoint of a running local server (auth flow, profile/email change/account deletion, admin tools, CORS, security headers, rate limiting) without needing Python: start the API as above with `ADMIN_EMAILS=integration-admin@example.com` and `CHART_EXERCISES=admins` on a freshly started server, then run `./scripts/run_integration_tests.sh` from the repo root. The script's header lists the full server requirements.

Security alerts from [Aikido](https://www.aikido.dev/), which rescans the repo about every three days and is no merge gate, are handled as in [RUNBOOK → Security alerts](docs/RUNBOOK.md#security-alerts-aikido).

## Dependencies

Backend dependencies are declared in `backend/requirements*.in` and locked — every transitive package, with hashes — in the matching `requirements*.txt`, generated by `pip-compile` (pip-tools, part of the dev requirements). Render, CI and local setup install only the `.txt` locks, so every environment gets byte-identical packages, and pip refuses a download whose hash doesn't match. To add or bump a package, edit the `.in` file, then regenerate all three locks (runtime, dev, mutation, in that order, since each one constrains the next) and commit both:

```bash
./scripts/lock_backend_requirements.sh
```

Dependabot regenerates the locks itself for its bump PRs. A package some dependency needs only on certain platforms must be listed in the `.in` file explicitly when its absence on macOS would drop it from the lock (see `greenlet` in `requirements.in`) — Render and CI are Linux. Frontend dependencies are locked by `frontend/package-lock.json` (`npm ci`).

## Development conventions

Trunk-based: `main` is the single source of truth, every change, however small, goes on a `feature/*` branch merged back via PR — see `CLAUDE.md` for the full set of conventions (branch strategy, coverage, linting, security scanning, ADRs).
