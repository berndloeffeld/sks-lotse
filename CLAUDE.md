# SKS Lotse — Claude Code Context

## What is SKS Lotse?
SKS Lotse is a web app to prepare for the theoretical exam of the German SKS (Sportküstenschifferschein) sailing license. The official exam catalog is free-text (not multiple choice): the learner writes an answer and must judge for themselves whether it's close enough to the official model answer. SKS Lotse uses an LLM to grade the learner's free-text answer against the official answer and explain what was missing or wrong.

**Differentiation vs. existing apps** (SKS-Buddy, official SKS App both already offer AI-graded free text): single-tier, ad-financed model with no feature gating (paid removes ads only, nothing else), web-only (no app store), and speech-to-text as an alternative to typing an answer.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + TypeScript |
| Backend | Python 3.12 / FastAPI |
| Database | PostgreSQL 16 (Render, Frankfurt EU) |
| Auth | Optional — anonymous by default, JWT-based login only for cross-device progress sync |
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
│   ├── runtime.txt     # Python 3.12.x
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

1. Learner is shown a question from the official SKS catalog.
2. Learner answers via text input or speech-to-text (Web Speech API transcribes locally in-browser before submit).
3. Answer is sent to the backend, which calls the LLM with the question, the official model answer, and the learner's answer.
4. LLM returns a graded score (e.g. "80% correct") plus an explanation of what was missing or incorrect.
5. Result is shown to the learner; anonymous users keep progress in the browser only, logged-in users get it synced server-side.

---

## Question Catalog

- Source: official SKS question catalog, provided as PDF (questions + official model answers).
- Needs a one-off (or repeatable) import pipeline: PDF → structured question/answer records in the database.
- Some questions reference nautical charts/images — these need to be extracted and stored (Cloudflare R2, TBD — not yet decided whether needed for MVP).

---

## Monetization

- Single tier, all features available to everyone.
- Free = ad-supported (Google AdSense).
- Paid = removes ads only. No feature gating, no separate paid feature set.

---

## Accounts

- No login required to use the app (anonymous, progress kept in browser storage).
- Optional login (JWT) only for learners who want progress synced across devices.

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

### Security Scanning (Aikido)
Aikido Security is connected to this GitHub repo.

- A PR must not be merged while Aikido reports open findings, unless the finding is explicitly triaged/accepted first.
- **Not yet technically enforced**: the repo is private on GitHub's free plan, which does not support branch protection / required status checks. This is a manual check for now — verify Aikido is green before merging a PR.
- Revisit once on GitHub Pro (or equivalent): add Aikido's check as a required status check in branch protection on `main`.
- `scripts/check_aikido.sh` queries the Aikido API directly for open findings on the repo (whichever branch Aikido last scanned) — run it instead of asking for a dashboard screenshot. Needs `.env.aikido` (gitignored, not committed) with `AIKIDO_CLIENT_ID` / `AIKIDO_CLIENT_SECRET` from an API client created at [app.aikido.dev/settings/integrations/api/aikido/rest](https://app.aikido.dev/settings/integrations/api/aikido/rest).

Never write to a git worktree path (e.g. `.claude/worktrees/...`). If Claude Code is invoked from a worktree, edits must still target the real project root above.

---

## Environment Variables (backend)

```
DATABASE_URL=
JWT_SECRET=
OPENAI_API_KEY=
ADSENSE_CLIENT_ID=
```

---

## Naming / Domain

- Name: SKS Lotse
- Domains checked 2026-09-16, available: sks-lotse.de, sks-lotse.com, skslotse.de, skslotse.com
- No conflicting product name found in search (existing competitors: SKS-Buddy, official SKS App, SBF-Fragen by Delius Klasing)
- **Open**: no formal trademark search done (DPMA/EUIPO) — recommended before committing to branding/domain purchase

---

## Project Management

- Linear: TBD (not yet set up)
- Current phase: Phase 0 — concept & functional basics (this file)
- Next phase: Phase 1 — question catalog import pipeline + core grading flow
