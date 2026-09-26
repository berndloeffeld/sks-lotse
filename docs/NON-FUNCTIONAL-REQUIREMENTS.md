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

| Area | Requirement | Evidence |
|---|---|---|
| Security | Login required; hashed, short-lived, purpose-bound email codes | [ADR-0006](adr/0006-mandatory-login-and-feature-gated-monetization.md), `backend/app/core/otp.py` |
| | Session cookie not readable by scripts; logout ends all sessions | [ADR-0012](adr/0012-httponly-cookie-for-frontend-session-token.md), [ADR-0008](adr/0008-token-version-based-logout.md) |
| | Every route needs a session unless listed as public | `backend/tests/test_auth_guards.py` |
| | Layered abuse protection (IP and email limits, blocklists) | [ADR-0007](adr/0007-in-memory-per-ip-rate-limiting.md), [ADR-0045](adr/0045-manual-email-domain-blocklist.md) |
| | Admin: allowlist plus TOTP | [ADR-0019](adr/0019-admin-allowlist-and-manual-gdpr-fulfillment.md), [ADR-0047](adr/0047-totp-step-up-for-admin-area.md) |
| | Enforced CSP, HSTS, frame denial | `render.yaml`, `backend/app/core/security_headers.py` |
| | Prompt-injection hardening of the AI check | [ADR-0040](adr/0040-ai-grading-sanitizer-and-abuse-monitoring.md) |
| | Secrets only in the hosting dashboard | `sync: false` in `render.yaml` |
| | Dependency findings handled (partly: alerts lag up to ~3 days, no pentest) | [runbook](RUNBOOK.md#security-alerts-aikido) |
| Privacy | Deletion and export of personal data | `services/user.py`, `services/admin_users.py`, [runbook](RUNBOOK.md#data-subject-requests-dsgvo) |
| | EU hosting; Anthropic (US) under a data processing agreement | [ADR-0031](adr/0031-ai-answer-check-with-claude-haiku.md) |
| | Cookieless analytics, ads only after consent | [ADR-0016](adr/0016-umami-cloud-analytics-without-consent-banner.md), [ADR-0027](adr/0027-adsense-with-google-consent-management.md) |
| Availability | Readiness check; traffic only to a deploy that passes it | `/health`, `render.yaml` |
| | Monitoring and status page (partly: no target) | Better Stack, [runbook](RUNBOOK.md#observability) |
| | Failed migration keeps the old version serving; rollback path | [runbook](RUNBOOK.md#deploys-and-rollback) |
| | Manual maintenance kill switch | [ADR-0042](adr/0042-manual-maintenance-mode.md) |
| | Searchable JSON logs with request id | `backend/app/core/log_config.py` |
| Reliability | Models and migrations never drift, up and down on real Postgres | `migrations` CI job |
| | A failed AI check costs no token; a payment is credited once | `services/token_wallet.py`, [ADR-0048](adr/0048-stripe-hosted-checkout-with-webhook-fulfilment.md) |
| | Catalog updates keep progress; exam deadline enforced server-side | [ADR-0022](adr/0022-catalog-sync-by-upsert.md), [ADR-0029](adr/0029-exam-simulation.md) |
| Performance | Catalog served from memory; cap on concurrent LLM calls | [ADR-0009](adr/0009-in-process-cache-for-question-catalog.md), `grading_max_concurrent_calls` |
| | Prerendered public pages, cached hashed assets, self-hosted fonts | [ADR-0025](adr/0025-build-time-prerender-of-the-landing-page.md), [ADR-0021](adr/0021-self-hosted-web-fonts.md) |
| | One instance, one worker, on purpose | [ADR-0007](adr/0007-in-memory-per-ip-rate-limiting.md) |
| Maintainability | Coverage gates, mutation scores, ruff, mypy, strict TypeScript, complexity cap | `CLAUDE.md` |
| | Integration test per route, generated API types, ADRs, infrastructure as code | [ADR-0046](adr/0046-api-types-generated-from-openapi.md), `render.yaml` |
| Usability | Web only, German only; accessibility lint (partly: static rules only) | `eslint-plugin-jsx-a11y` |

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
