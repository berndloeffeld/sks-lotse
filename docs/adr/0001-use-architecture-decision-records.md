# 0001. Use Architecture Decision Records

Status: Accepted

## Context

SKS Lotse is a solo-developed project, but it's also meant to double as a reference sample for job applications — the reasoning behind decisions matters as much as the decisions themselves. Without a record, the "why" behind a choice (and the alternatives that were rejected) gets lost within a few weeks, and a reviewer looking at the repo later has no way to see the thinking, only the current state of the code.

Options considered:
1. A single `ARCHITECTURE.md` with no decision history — simplest, but loses the "why" and rejected alternatives over time.
2. A published docs site (MkDocs Material / Docusaurus) with C4 diagrams — more polished presentation, but adds a build pipeline to maintain that isn't justified by the current project size.
3. Architecture Decision Records (ADRs), one file per decision, plus a living `docs/ARCHITECTURE.md` for the current-state overview.

## Decision

Use lightweight ADRs under `docs/adr/`, numbered sequentially (`NNNN-title.md`), following the template in `docs/adr/template.md` (Context / Decision / Consequences). Write one whenever a decision would be genuinely costly to reverse or non-obvious to a future reader — not for routine implementation choices already covered by CLAUDE.md conventions.

`docs/ARCHITECTURE.md` complements this with the current-state system overview (diagram + component summary); ADRs record how we got there and why.

## Consequences

- Decision history is versioned alongside the code, reviewed via the same PR flow as everything else.
- Requires discipline: an ADR only has value if it's written when the decision is made, not retrofitted later.
- Superseding a decision means adding a new ADR that references the old one (mark the old one "Superseded by ADR-NNNN"), not editing history away.
