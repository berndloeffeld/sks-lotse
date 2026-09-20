# SKS Lotse

![Backend CI](https://github.com/berndloeffeld/sks-lotse/actions/workflows/backend-ci.yml/badge.svg)
![Frontend CI](https://github.com/berndloeffeld/sks-lotse/actions/workflows/frontend-ci.yml/badge.svg)

A web app to prepare for the theoretical exam of the German SKS (Sportküstenschifferschein) sailing license. The official exam catalog is free-text, not multiple choice — the learner writes an answer and has to judge for themselves whether it's close enough to the model answer. SKS Lotse uses an LLM to grade the learner's free-text answer against the official model answer and explain what was missing or wrong.

**What's different from existing apps** (SKS-Buddy, the official SKS App — both already offer AI-graded free text): web-only (no app store), and speech-to-text as an alternative to typing an answer. Monetization is freemium — two independent paid add-ons (remove ads, unlock AI-based grading) — see [docs/adr/0006](docs/adr/0006-mandatory-login-and-feature-gated-monetization.md) for the reasoning.

## Status

Pre-launch — email+OTP login, the question catalog, account/profile pages, learning by topic with self-assessment against the official answers, Fokus topics, a learning-progress overview, the exam simulation (Fragebogen) with history and statistics, and GDPR admin tooling are live; LLM grading of free-text answers hasn't been built yet. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the current-state overview, including what's explicitly not built yet.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + TypeScript, Zustand, Tailwind CSS |
| Backend | Python 3.12 / FastAPI |
| Database | PostgreSQL 16 |
| Auth | Email + one-time code (OTP) or SSO with Google/Facebook, JWT sessions |
| Transactional email | Resend |
| Answer check (LLM) | Anthropic API (Claude Haiku), opt-in per account — [ADR-0031](docs/adr/0031-ai-answer-check-with-claude-haiku.md) |
| Speech-to-text | Web Speech API (browser-native) *(not yet integrated)* |
| Ads | Google AdSense *(script + consent are in, no ad units yet)* |
| Analytics | Umami Cloud (cookieless, EU) |
| Hosting | Render (Frankfurt EU) |
| CI/CD | GitHub Actions |

## Privacy & security

Login is mandatory, so handling personal data properly is part of the design, not an afterthought. The user-facing statement is the in-app [Datenschutzerklärung](frontend/src/pages/PrivacyPage.tsx) (`/privacy`); this is the technical side.

- **Passwordless login without magic links:** email + one-time code. Codes are stored only as keyed hashes, short-lived, single-purpose (a login code can't confirm an email change) and cleaned up automatically ([ADR-0010](docs/adr/0010-opportunistic-otp-code-cleanup.md)). Disposable-email domains are blocked, and email addresses are canonicalized so one inbox can't become many accounts.
- **Session:** JWT in an httpOnly cookie, never readable by JavaScript or kept in `localStorage` ([ADR-0012](docs/adr/0012-httponly-cookie-for-frontend-session-token.md)). Every `/api/v1` route requires it; per-IP rate limiting applies throughout, with tighter limits on login and email change.
- **Data residency:** app, database and static frontend all run on Render in Frankfurt (EU). Fonts are self-hosted. Transport is HTTPS-only; disk encryption at rest is provided by the hosting platform, not by the app.
- **Data minimisation:** name and gender are optional. Analytics is Umami Cloud (EU), cookieless, no persistent identifier, no answer content ([ADR-0016](docs/adr/0016-umami-cloud-analytics-without-consent-banner.md)). Ads (AdSense) load only after consent via Google's TCF consent management ([ADR-0027](docs/adr/0027-adsense-with-google-consent-management.md)).
- **AI check is opt-in and stateless:** only the question, the official answer and the learner's answer go to Anthropic (US), only when the learner clicks the button; no email, name or history is sent and nothing is stored ([ADR-0031](docs/adr/0031-ai-answer-check-with-claude-haiku.md)).
- **Data-subject rights:** learners can delete their account, including progress, exams, focus marks and reports, themselves under `/profile`. Access, rectification and export requests go to the operator by email and are fulfilled with the admin tools ([ADR-0019](docs/adr/0019-admin-allowlist-and-manual-gdpr-fulfillment.md)).
- **Processors:** Render (hosting), Resend (login emails), Google/Meta (SSO, only if used), Umami (analytics), Anthropic (AI check), Google (ads), all listed in the Datenschutzerklärung.
- **Vulnerabilities:** report privately, see [SECURITY.md](SECURITY.md).

## Architecture & decisions

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — current-state system overview (components, diagram)
- [docs/adr/](docs/adr/) — Architecture Decision Records: the reasoning behind non-obvious or hard-to-reverse decisions, not just the resulting code

## Getting started

Requires Docker, Python 3.12, and Node. All commands assume the repo root as the working directory unless noted.

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

API docs (Swagger UI): `http://localhost:8000/docs`. A [Postman collection](postman/sks-lotse.postman_collection.json) is also generated from the live OpenAPI schema — see below.

## Testing & quality gates

Backend — run from `backend/`, with the venv active:

```bash
pytest                # tests + 95% line/branch coverage gate (backend/pyproject.toml)
ruff check .          # lint
ruff format --check . # formatting
```

Frontend — run from `frontend/`:

```bash
npx tsc -b                  # type check
npx vitest run --coverage   # tests + 90%/85% line/branch coverage gate (vite.config.ts)
npm run lint                # ESLint
npm run format:check        # Prettier
```

These run in CI on every push to `main` and every PR (`.github/workflows/backend-ci.yml`, `.github/workflows/frontend-ci.yml`). Backend CI additionally checks the Alembic migrations against a real Postgres, checks that the committed Postman collection is still in sync with the API (`scripts/generate_postman_collection.sh`), and runs the integration tests below.

Optional but recommended: `pre-commit install` (from the venv) — runs ruff, ESLint and Prettier on staged files and blocks commits directly on `main`.

A separate, hand-written Postman collection black-box tests every endpoint of a running local server (auth flow, profile/email change/account deletion, admin tools, CORS, security headers, rate limiting) without needing Python: start the API as above with `ADMIN_EMAILS=integration-admin@example.com` on a freshly started server, then run `./scripts/run_integration_tests.sh` from the repo root. The script's header lists the full server requirements.

The repo is also connected to [Aikido Security](https://www.aikido.dev/) for dependency/SAST scanning — `scripts/check_aikido.sh` queries open findings directly (needs a local `.env.aikido` and a plan with API access — on the free plan it fails, check the dashboard by hand; see `CLAUDE.md`). There is no Aikido job in CI.

## Development conventions

Trunk-based: `main` is the single source of truth, every change, however small, goes on a `feature/*` branch merged back via PR — see `CLAUDE.md` for the full set of conventions (branch strategy, working directory, security scanning, coverage, linting, ADRs).
