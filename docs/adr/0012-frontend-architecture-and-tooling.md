# 0012. Frontend architecture and tooling

Status: Accepted

## Context

The backend is functionally complete for Phase 1 (catalog import, email+OTP auth, deployment, CI/security tooling) and well-documented; the frontend is entirely greenfield — `frontend/` doesn't exist yet. CLAUDE.md names a target stack (React + Vite + TypeScript, Zustand) but doesn't decide styling, routing, an API-client pattern, a test framework, or how the frontend will meet the same quality bar (linting, coverage, security scanning) the backend already enforces. Those choices are foundational: reversing them after components exist is expensive, so they're recorded here before any scaffolding or UI work, per this repo's own rule for when a decision earns an ADR (see CLAUDE.md → Architecture Documentation).

The backend contract the frontend integrates against is small and stable: `POST /auth/otp/request`, `POST /auth/otp/verify`, `GET /auth/me`, `POST /auth/logout`, `GET /questions`, `GET /questions/random`, `GET /questions/{id}`, plus `/health` (schemas in `backend/app/schemas/auth.py` and `backend/app/schemas/question.py`). Auth is a stateless Bearer JWT with no refresh-token flow and `token_version`-based logout ([ADR-0008](0008-token-version-based-logout.md)) — a 401 always means "log in again," never "silently refresh." [ADR-0006](0006-mandatory-login-and-feature-gated-monetization.md) requires the whole app to sit behind login, with AI grading vs. a plain model-answer view gated per account. CORS is already configured for Vite's default dev port (`backend/app/core/config.py`), confirming Vite as the intended local dev server.

The visual design system (color palette, typography, spacing, logo/branding) is explicitly out of scope here — that's a deliberately separate decision, to be made in its own session once there's real branding to work from.

## Decision

**Build tool / language**: Vite + React + TypeScript, and **state management**: Zustand — both already named as the target stack in CLAUDE.md; restated here for completeness rather than re-decided. Zustand backs, at minimum, an auth store (token, current user, login/logout actions).

**Styling**: Tailwind CSS. Utility-first, no separate component-library visual identity to fight later, and keeps the (deferred) design-system tokens swappable via `tailwind.config` rather than scattered across component files.

**Routing**: React Router — the standard choice for a Vite+React SPA, and needed immediately for ADR-0006's mandatory-login gating (a protected-route wrapper redirecting unauthenticated users to `/login`).

**API client**: a thin, typed `fetch` wrapper, not a generated client — the API surface is only 7 endpoints and already hand-tracked via the Postman collection. It centralizes attaching the `Authorization` header and handling a uniform 401 (clear the auth store, redirect to login), matching the backend's "don't try to distinguish 401 causes" behavior (`docs/ARCHITECTURE.md` → Auth).

**Testing**: Vitest + React Testing Library — shares Vite's config/transform (no separate Jest setup) and mirrors the backend's pytest convention.

**Quality gates**, mirroring the backend's existing conventions so the frontend isn't held to a lower bar:
- **Linting & formatting**: ESLint (`typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`) + Prettier, enforced via a pre-commit hook (extending `.pre-commit-config.yaml`, same role `ruff` plays today) plus a CI check.
- **Test coverage**: Vitest's built-in coverage (v8 provider), same 80% lines+branches threshold as the backend's `pytest-cov` gate.
- **Security scanning**: no new setup — Aikido already scans the whole GitHub repo, not just `backend/`, so `frontend/package.json` dependencies are picked up automatically once they exist.
- **CI**: a new `.github/workflows/frontend-ci.yml` mirroring `backend-ci.yml`'s shape (lint, format check, test+coverage) — decided now, written when the actual scaffold lands, so it isn't an afterthought.

## Consequences

- The frontend can be scaffolded directly against these choices without re-litigating tooling mid-implementation; the API-client and auth-store shape can be written knowing exactly what the backend contract and 401 semantics are.
- Because the visual design system is deliberately deferred, the first scaffolded UI will be functional but unstyled beyond Tailwind's defaults — that's expected, not a gap in this decision.
- CLAUDE.md's "Test Coverage", "Linting & Formatting", and "Security Scanning (Aikido)" sections currently read backend-only (e.g. "Backend enforces a minimum of 80% coverage...") and will need a frontend-equivalent paragraph once the scaffold and its CI workflow actually exist. Flagged here so it isn't forgotten; the rewrite happens in the scaffolding step, not this one.
- Rejected: a component library (MUI/Chakra) — imposes its own visual identity that would need re-skinning once real branding exists, working against the deliberate deferral of that decision.
- Rejected: a generated/OpenAPI-derived TypeScript client — not worth the tooling overhead for 7 endpoints; revisit if the API surface grows substantially (e.g. once grading lands).
- Rejected: Biome for lint/format — the closest JS analogue to the backend's `ruff` (one fast tool, lint+format in one), but its React-specific and `jsx-a11y`-equivalent rules are still less mature than the ESLint plugin ecosystem. Revisit if that gap closes.
