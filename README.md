# SKS Lotse

![Backend CI](https://github.com/berndloeffeld/sks-lotse/actions/workflows/backend-ci.yml/badge.svg)

A web app to prepare for the theoretical exam of the German SKS (Sportküstenschifferschein) sailing license. The official exam catalog is free-text, not multiple choice — the learner writes an answer and has to judge for themselves whether it's close enough to the model answer. SKS Lotse uses an LLM to grade the learner's free-text answer against the official model answer and explain what was missing or wrong.

**What's different from existing apps** (SKS-Buddy, the official SKS App — both already offer AI-graded free text): single-tier, ad-financed (no feature gating — paying only removes ads), web-only (no app store), and speech-to-text as an alternative to typing an answer.

## Status

Early stage — backend foundation, catalog import, and dev tooling are in place; the frontend and the LLM grading flow haven't been built yet. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the current-state overview, including what's explicitly not built yet.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + TypeScript *(not yet built)* |
| Backend | Python 3.12 / FastAPI |
| Database | PostgreSQL 16 |
| Answer grading (LLM) | OpenAI API *(not yet integrated)* |
| Speech-to-text | Web Speech API (browser-native) *(not yet integrated)* |
| Hosting | Render (Frankfurt EU) |
| CI/CD | GitHub Actions |

## Architecture & decisions

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — current-state system overview (components, diagram)
- [docs/adr/](docs/adr/) — Architecture Decision Records: the reasoning behind non-obvious or hard-to-reverse decisions, not just the resulting code

## Getting started

Requires Docker, Python 3.12, and Node (for tooling). All commands assume the repo root as the working directory unless noted.

```bash
# 1. Start local Postgres
docker compose up -d

# 2. Set up the backend
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head

# 3. (Optional) Import the official question catalog
PYTHONPATH=. python scripts/import_catalog.py

# 4. Run the API
uvicorn app.main:app --reload --port 8000
```

API docs (Swagger UI): `http://localhost:8000/docs`. A [Postman collection](postman/sks-lotse.postman_collection.json) is also generated from the live OpenAPI schema — see below.

## Testing & quality gates

Run from `backend/`, with the venv active:

```bash
pytest              # tests + 80% coverage gate (backend/pyproject.toml)
ruff check .         # lint
ruff format --check . # formatting
```

All three run in CI (`.github/workflows/backend-ci.yml`) on every push to `main` and every PR, alongside a check that the committed Postman collection is still in sync with the API (`scripts/generate_postman_collection.sh`).

The repo is also connected to [Aikido Security](https://www.aikido.dev/) for dependency/SAST scanning — `scripts/check_aikido.sh` queries open findings directly (needs a local `.env.aikido`, see `CLAUDE.md`).

## Development conventions

Trunk-based: `main` is the single source of truth, every change goes on a `feature/*` (or `docs/*`, `fix/*`) branch merged back via PR — see `CLAUDE.md` for the full set of conventions (branch strategy, working directory, security scanning, coverage, linting, ADRs).
