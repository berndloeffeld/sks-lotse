# Sizing and non-functional requirements

Expected load, the non-functional requirements (NFRs) the project already meets. Written retroactively (2026-09-26): the "Met" section points to where each requirement is enforced. What the system is: [ARCHITECTURE.md](ARCHITECTURE.md); why: [ADRs](adr/README.md); operation: [runbook](RUNBOOK.md).

Numbers marked **assumption** are estimates. Replace them with the real ones from the daily KPI report ([ADR-0032](adr/0032-daily-kpi-report.md)); see [Review](#review).

## 1. Sizing

Basis: ~5,000 SKS licences a year (given), so roughly 6,000 exam candidates including retakes. 60–80 % learn digitally, and at least two established competitors share that market. SKS Lotse starts without marketing (search, word of mouth, sailing schools). **Assumption:** it reaches 2 % / **5 %** / 15 % of the digital learners.

| | Pessimistic | **Realistic** | Optimistic |
|---|---|---|---|
| New accounts per year | ~60 | **~200** | ~700 |
| Active at once, average / season peak | ~10 / ~25 | **~30 / ~80** | ~100 / ~300 |
| Online at once, peak | 1–3 | **3–10** | 15–40 |

Derivation: a learner is active for 6–10 weeks; the season peak (February to May) is ~2.5 × the average; 5–10 % of the active accounts are online in the same minute.

Derived load (realistic, optimistic in brackets):
- **Requests:** peak ~1 req/s (4–8), from ~100–150 calls per 30-minute session. The single worker should carry ~50–100 req/s; **not measured**.
- **Data:** under 100 MB (300 MB). `question_progress` ≈ accounts × ~540 questions; the catalog has ~638 raw questions ([ADR-0017](adr/0017-official-topic-taxonomy-and-seemannschaft-merge.md)).
- **Lotsen-Checks:** ~1,000–5,000 a year, at most 5 in flight at once.
- **Login mails:** ~1,000–3,000 a year (7-day session, no refresh token).

## 2. Met

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
