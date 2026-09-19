# SKS Lotse

![Backend CI](https://github.com/berndloeffeld/sks-lotse/actions/workflows/backend-ci.yml/badge.svg)
![Frontend CI](https://github.com/berndloeffeld/sks-lotse/actions/workflows/frontend-ci.yml/badge.svg)

A web app to prepare for the theoretical exam of the German SKS (Sportküstenschifferschein) sailing license. The official exam catalog is free-text, not multiple choice — the learner writes an answer and has to judge for themselves whether it's close enough to the model answer. SKS Lotse uses an LLM to grade the learner's free-text answer against the official model answer and explain what was missing or wrong.

**What's different from existing apps** (SKS-Buddy, the official SKS App — both already offer AI-graded free text): web-only (no app store), and speech-to-text as an alternative to typing an answer. Monetization is freemium — two independent paid add-ons (remove ads, unlock AI-based grading) — see [docs/adr/0006](docs/adr/0006-mandatory-login-and-feature-gated-monetization.md) for the reasoning.

## Status

Pre-launch — email+OTP login, the question catalog, account/profile pages, learning by topic with self-assessment against the official answers, a learning-progress overview, and GDPR admin tooling are live; LLM grading of free-text answers hasn't been built yet. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the current-state overview, including what's explicitly not built yet.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + TypeScript, Zustand, Tailwind CSS |
| Backend | Python 3.12 / FastAPI |
| Database | PostgreSQL 16 |
| Auth | Email + one-time code (OTP), JWT sessions *(SSO not yet built)* |
| Transactional email | Resend |
| Answer grading (LLM) | OpenAI API *(not yet integrated)* |
| Speech-to-text | Web Speech API (browser-native) *(not yet integrated)* |
| Ads | Google AdSense *(not yet integrated)* |
| Analytics | Umami Cloud (cookieless, EU) |
| Hosting | Render (Frankfurt EU) |
| CI/CD | GitHub Actions |

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
pytest                # tests + 80% line/branch coverage gate (backend/pyproject.toml)
ruff check .          # lint
ruff format --check . # formatting
```

Frontend — run from `frontend/`:

```bash
npx tsc -b                  # type check
npx vitest run --coverage   # tests + 80% line/branch coverage gate (vite.config.ts)
npm run lint                # ESLint
npm run format:check        # Prettier
```

These run in CI on every push to `main` and every PR (`.github/workflows/backend-ci.yml`, `.github/workflows/frontend-ci.yml`). Backend CI additionally checks the Alembic migrations against a real Postgres, checks that the committed Postman collection is still in sync with the API (`scripts/generate_postman_collection.sh`), and runs the integration tests below.

Optional but recommended: `pre-commit install` (from the venv) — runs ruff, ESLint and Prettier on staged files and blocks commits directly on `main`.

A separate, hand-written Postman collection black-box tests every endpoint of a running local server (auth flow, profile/email change/account deletion, admin tools, CORS, security headers, rate limiting) without needing Python: start the API as above with `ADMIN_EMAILS=integration-admin@example.com` on a freshly started server, then run `./scripts/run_integration_tests.sh` from the repo root. The script's header lists the full server requirements.

The repo is also connected to [Aikido Security](https://www.aikido.dev/) for dependency/SAST scanning — `scripts/check_aikido.sh` queries open findings directly (needs a local `.env.aikido`, see `CLAUDE.md`).

## Development conventions

Trunk-based: `main` is the single source of truth, every change, however small, goes on a `feature/*` branch merged back via PR — see `CLAUDE.md` for the full set of conventions (branch strategy, working directory, security scanning, coverage, linting, ADRs).
