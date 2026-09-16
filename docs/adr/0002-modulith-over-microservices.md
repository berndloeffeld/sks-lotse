# 0002. Modulith over microservices

Status: Accepted

## Context

SKS Lotse is solo-developed, currently pre-launch, and scoped against Countly's free analytics tier (≤500 MAU) — a small, bounded audience for the foreseeable future. The question of service granularity (one deployable vs. several) needs to be answered before the grading flow and frontend add more surface area.

Options considered:
1. **Microservices** — e.g. a separate grading service, catalog service, auth service, each independently deployable.
2. **Modulith** — a single deployable (the existing `backend/app` FastAPI app), internally organized into clearly separated modules (`api/`, `core/`, `models/`, `schemas/`, `services/`).

Arguments for microservices don't apply here: there's no separate team needing independent release cadence, no component with a genuinely different scaling profile that's been identified yet, and the operational cost (multiple deployments, service discovery, network calls where function calls used to be, distributed debugging) would slow down a solo developer without a corresponding benefit at this scale.

## Decision

Build and ship as a **modulith**: one backend deployable, one frontend deployable, organized internally into clear modules. This is already the de facto structure (`backend/app/{api,core,models,schemas,services}`) — this ADR makes it explicit and intentional rather than incidental.

## Consequences

- Simple deployment (one Render web service for the backend), simple local dev, simple debugging (no network boundary between modules).
- Module boundaries (`api/` calling into `services/`, not the reverse; `services/` not importing from `api/`) still need to be respected by convention — a modulith without internal discipline degrades into a ball of mud just as easily as microservices without clear ownership degrade into a distributed one.
- If a genuine independent-scaling need emerges later (the most likely candidate: the LLM grading call, which is slower and costlier per-request than everything else), that module can be extracted into its own service at that point — the internal separation already in place makes that extraction easier than if everything were entangled.
- Revisit this decision if: a second team starts contributing with conflicting release cadences, or a specific module's load profile diverges sharply enough from the rest that co-deploying it becomes a genuine operational problem.
