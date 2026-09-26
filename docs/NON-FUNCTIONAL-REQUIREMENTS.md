# Sizing and non-functional requirements

Expected load, the non-functional requirements (NFRs) the project already meets, and the ones still open. Written retroactively (2026-09-26): the "Met" section points to where each requirement is enforced. What the system is: [ARCHITECTURE.md](ARCHITECTURE.md); why: [ADRs](adr/README.md); operation: [runbook](RUNBOOK.md).

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

Conclusions:
- Load is not the scaling risk: one small instance covers the realistic and the optimistic case, which is why the infrastructure stays minimal ([ADR-0002](adr/0002-modulith-over-microservices.md), [ADR-0005](adr/0005-render-deployment-topology.md), [ADR-0007](adr/0007-in-memory-per-ip-rate-limiting.md)).
- Load is seasonal and bursty: a mention on a large sailing site can multiply it by ~10 for a few days.
- Shared IPs matter more than volume: a class in one school or mobile-carrier network shares the per-IP limit of 300 requests per 5 minutes (`rate_limit_default_*`, `backend/app/core/config.py`).

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

## 3. Open and invisible

Priority **A** = settle before a broader launch, **B** = worth doing, **C** = watch.

| # | Prio | Gap | Proposal |
|---|---|---|---|
| 1 | A | **Backup and restore.** Retention is still "to be confirmed" in the runbook, no restore drill recorded, no RPO/RTO. | Target RPO ≤ 24 h, RTO ≤ 4 h; check retention, run the drill once. |
| 2 | A | **Inactive-account deletion** is reserved in the terms (12 months) but nothing does it ([ADR-0041](adr/0041-agb-acceptance-and-inactivity-retention.md)). | Cron job with a reminder mail, or drop the clause. |
| 3 | A | **Login has no fallback:** email code via Resend only. Deliverability and time-to-code are undefined; a Resend outage locks everyone out. | Target "code within 30 s for 95 %"; check SPF/DKIM/DMARC. |
| 4 | A | **No availability target.** Monitored, but no objective; single instance, no SLA. | e.g. 99 % per month, stated for the season. |
| 5 | B | **No latency targets, no load test;** the worker capacity above is a guess. | One local load test; p95 < 500 ms for reads. |
| 6 | B | **Per-IP limit on shared addresses** (classes, mobile NAT). | Count authenticated requests per user instead. |
| 7 | B | **No measurable scale-out trigger;** DB plan storage and connection pool not stated. | e.g. sustained p95 > 1 s or > 50 concurrent users, then an ADR. |
| 8 | B | **Accessibility:** no target or manual test. Whether the BFSG applies is a legal question. | WCAG 2.1 AA; one keyboard and screen-reader pass; clarify the BFSG. |
| 9 | B | **Browser, device and offline support** undefined; learners are on phones, some on board without coverage. | Name the browser matrix; record offline as goal or non-goal. |
| 10 | B | **Observability:** no metrics; log retention and personal data in logs not stated. | Document both; add an error-rate or latency alert. |
| 11 | B | **Security assurance:** no threat model or pentest; backup access undocumented. | One-page threat model before `STRIPE_CHECKOUT=on`. |
| 12 | B | **Bus factor:** one operator holds every account. | Emergency checklist in the runbook. |
| 13 | C | **Catalog currency:** no target for following a new ELWIS catalog. | Check at a fixed interval. |
| 14 | C | **Third-party outages** described piecemeal (only Anthropic's is fully handled). | Table: provider, what the learner sees when it is down. |

## Review

Check the assumptions in section 1 against the real KPI figures about every six months and after any change in reach. If a number changes the conclusion (e.g. sustained > 50 concurrent users), gap 7 fires and needs an ADR. A gap that becomes a decision gets its own ADR and leaves this list.
