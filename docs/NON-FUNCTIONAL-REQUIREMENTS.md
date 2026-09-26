# Sizing and non-functional requirements

Expected load and the non-functional requirements (NFRs) the project already meets. Written retroactively (2026-09-26). What the system is: [ARCHITECTURE.md](ARCHITECTURE.md); why: [ADRs](adr/README.md); operation: [runbook](RUNBOOK.md).

Numbers marked **assumption** are estimates. Replace them with the real ones from the daily KPI report ([ADR-0032](adr/0032-daily-kpi-report.md)); see [Review](#review).

## 1. Sizing

Basis: ~5,000 SKS licences a year (given), so roughly 6,000 exam candidates including retakes. ~70 % of them learn digitally (~4,200), and at least two established competitors share that market. **Assumption:** SKS Lotse reaches up to 30 % of the digital learners.

| | Low (5 %) | Medium (15 %) | **High (30 %, planning figure)** |
|---|---|---|---|
| New accounts per year | ~210 | ~630 | **~1,260** |
| Active at once, average / season peak | ~30 / ~80 | ~100 / ~240 | **~190 / ~485** |
| Online at once, peak | 4–8 | 12–24 | **25–50** |

Derivation: a learner is active for 6–10 weeks; the season peak (February to May) is ~2.5 × the average; 5–10 % of the peak-active accounts are online in the same minute.

Derived load (planning figure):
- **Requests:** peak ~4–8 req/s, from ~100–150 calls per 30-minute session. The single worker should carry ~50–100 req/s; **not measured**.
- **Data:** under 300 MB. `question_progress` ≈ accounts × ~540 questions ≈ 680k rows; the catalog has ~638 raw questions ([ADR-0017](adr/0017-official-topic-taxonomy-and-seemannschaft-merge.md)).
- **Lotsen-Checks:** up to ~10,000 a year, at most 5 in flight at once.
- **Login mails:** ~4,000–6,000 a year (7-day session, no refresh token).

## 2. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | Login required; hashed, short-lived, purpose-bound email codes |
| | Session cookie not readable by scripts; logout ends all sessions |
| | Every route needs a session unless listed as public |
| | Layered abuse protection (IP and email limits, blocklists) |
| | Admin: allowlist plus TOTP |
| | Enforced CSP, HSTS, frame denial |
| | Prompt-injection hardening of the AI check |
| | No secrets in the git repository |
| | Continuous security scanning |
| Privacy | Deletion and export of personal data |
| | EU hosting; Anthropic (US) under a data processing agreement |
| Availability | Readiness check; traffic only to a deploy that passes it |
| | Monitoring and status page (partly: no target) |
| | Configurable maintenance mode |
| Performance | Catalog served from memory; cap on concurrent LLM calls |
| | Prerendered public pages, cached hashed assets, self-hosted fonts |
| | One instance, one worker, on purpose |

## Review

Check the assumptions in section 1 against the real KPI figures about every six months and after any change in reach.
