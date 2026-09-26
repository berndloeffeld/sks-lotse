# Sizing and non-functional requirements

What load SKS Lotse is built for, which non-functional requirements (NFRs) it already meets and where the evidence is, and which ones are still open. Written retroactively (2026-09-26): most of it was decided implicitly along the way, so the "Met" section points to where each requirement is actually enforced. What the system *is* is in [ARCHITECTURE.md](ARCHITECTURE.md), why decisions were made is in the [ADRs](adr/README.md), how to operate it is in the [runbook](RUNBOOK.md).

Numbers marked **assumption** are estimates, not measurements. They are to be replaced by the real ones (daily KPI report, [ADR-0032](adr/0032-daily-kpi-report.md)); see [Review](#review).

## 1. Sizing (Mengengerüst)

### Market and funnel (assumptions)

| Step | Value | Reasoning |
|---|---|---|
| SKS licences issued per year | ~5,000 | Given by the operator; every one of them passed the theory exam, so it is the upper bound of the target group per year. |
| Target group incl. retakes and learners who never sit the exam | ~6,000 | +20 % on top. |
| Learning digitally | 60–80 % | The rest learns from a school's script, a course or a book only. |
| Competition | at least 2 established products | SKS Lotse starts with no marketing budget: reach comes from search, word of mouth and sailing schools. |
| Share of the digital learners | 2 % / **5 %** / 15 % | Pessimistic / **realistic (planning figure)** / optimistic. |

### Scenarios

| | Pessimistic | **Realistic** | Optimistic |
|---|---|---|---|
| New accounts per year | ~60 | **~200** | ~700 |
| Active at the same time, average / season peak | ~10 / ~25 | **~30 / ~80** | ~100 / ~300 |
| Online at the same time, peak | 1–3 | **3–10** | 15–40 |

How it is derived: an account is active for one learning window of 6–10 weeks (about 8/52 of the year), the season peak (February to May, before the sailing season) is about 2.5 × the average, and 5–10 % of the active accounts are online in the same minute.

### Derived load (realistic, optimistic in brackets)

| What | Value | Basis |
|---|---|---|
| API requests | peak ≈ 1 req/s (4–8 req/s) | ~100–150 calls per 30-minute session. |
| Capacity of the one worker | ~50–100 req/s, **not measured** (see [gaps](#3-open-and-invisible-nfrs)) | One uvicorn worker, sync routes on FastAPI's thread pool (40 threads by default). |
| Data volume | < 100 MB (< 300 MB) | `question_progress` ≤ accounts × ~540 questions ≈ 110k (380k) rows of ~100 B; `exam_attempt_questions` ≈ 5 attempts × 30 ≈ 30k (100k) rows. The catalog itself has ~638 raw questions ([ADR-0017](adr/0017-official-topic-taxonomy-and-seemannschaft-merge.md)), fewer after the Seemannschaft merge. |
| Lotsen-Checks | ~1,200 per year (~4,200) | The 6-token signup bonus × accounts, plus purchased tokens. ~0.13 ct per check ([ADR-0031](adr/0031-ai-answer-check-with-claude-haiku.md)): about 1.60 EUR a year, below 10 EUR even if 10 % of the learners buy 50 tokens. |
| Login mails | ~600–1,000 per year (~2,500) | The session lasts 7 days (`jwt_access_token_expires_minutes`) and there is no refresh token, so a learner logs in about 3–5 times per year. |
| Revenue (context only) | order of 100–150 EUR a year plus ads | 10 % buyers × ~6 EUR. |

Conclusions:
- Cost and load are not the scaling risk. The token balance caps the LLM spend, the mail volume is far below any free tier, and one small instance is enough for the planning figure and the optimistic case. That is the basis for the deliberately minimal infrastructure ([ADR-0002](adr/0002-modulith-over-microservices.md), [ADR-0005](adr/0005-render-deployment-topology.md), [ADR-0007](adr/0007-in-memory-per-ip-rate-limiting.md)).
- The load is **seasonal and bursty**, not uniform: a peak of 2.5 × the average, and a mention on a large sailing site can multiply it by ~10 for a few days.
- Shared IPs matter more than volume: a sailing-school class behind one school or mobile-carrier IP shares the per-IP bucket of 300 requests per 5 minutes (`rate_limit_default_*` in `backend/app/core/config.py`).

## 2. Met (existing NFRs and their evidence)

Grouped by ISO/IEC 25010 quality characteristic. "Partly" marks a requirement that holds but has no target or no measurement behind it.

### Security

| Requirement (as it de facto holds) | Evidence | Status |
|---|---|---|
| Login is required; passwordless email code, hashed, short-lived, bound to a purpose | [ADR-0006](adr/0006-mandatory-login-and-feature-gated-monetization.md), `backend/app/core/otp.py` | Met |
| Session token not readable by scripts; logout ends all sessions | [ADR-0012](adr/0012-httponly-cookie-for-frontend-session-token.md), [ADR-0008](adr/0008-token-version-based-logout.md) | Met |
| Every `/api/v1` route needs a session unless listed as public | `backend/tests/test_auth_guards.py` | Met |
| Layered abuse protection: per-IP and per-email limits, disposable domains, manual blocklist, allowlist | [ADR-0007](adr/0007-in-memory-per-ip-rate-limiting.md), [ADR-0045](adr/0045-manual-email-domain-blocklist.md) | Met |
| Admin area only for allowlisted emails with a recent TOTP check | [ADR-0019](adr/0019-admin-allowlist-and-manual-gdpr-fulfillment.md), [ADR-0047](adr/0047-totp-step-up-for-admin-area.md) | Met |
| Browser hardening: enforced CSP, HSTS, frame denial | `render.yaml`, `backend/app/core/security_headers.py` | Met |
| Prompt-injection hardening and abuse signal for the LLM call | [ADR-0040](adr/0040-ai-grading-sanitizer-and-abuse-monitoring.md) | Met |
| Secrets only in the hosting dashboard, never in git | `sync: false` in `render.yaml`, [runbook](RUNBOOK.md#rotating-secrets) | Met |
| Vulnerable dependencies are found and handled | Aikido and Dependabot, [runbook](RUNBOOK.md#security-alerts-aikido) | Partly: findings arrive up to ~3 days late, no penetration test |

### Privacy and compliance

| Requirement | Evidence | Status |
|---|---|---|
| Personal data leaves with the account; complete export on request | `services/user.py`, `services/admin_users.py`, [runbook](RUNBOOK.md#data-subject-requests-dsgvo) | Met |
| Data processed in the EU, except Anthropic (US, with a data processing agreement) and Stripe | [ADR-0031](adr/0031-ai-answer-check-with-claude-haiku.md), `docs/anthropic-dpa-2026-09-20.pdf` | Met |
| Analytics without cookies, ads only after consent | [ADR-0016](adr/0016-umami-cloud-analytics-without-consent-banner.md), [ADR-0027](adr/0027-adsense-with-google-consent-management.md) | Met |
| Terms acceptance per version; purchase confirmation on a durable medium; bookkeeping retention for paid records | [ADR-0041](adr/0041-agb-acceptance-and-inactivity-retention.md), [ADR-0048](adr/0048-stripe-hosted-checkout-with-webhook-fulfilment.md), [ADR-0043](adr/0043-token-based-ai-grading-monetization.md) | Met |
| Catalog is used as an official work with source citation, wording unchanged | `/imprint`, [catalog-pipeline.md](catalog-pipeline.md) | Met |
| Deleting accounts after 12 months of inactivity, as the terms reserve | [ADR-0041](adr/0041-agb-acceptance-and-inactivity-retention.md) | **Not met**, see the gaps |

### Availability and operability

| Requirement | Evidence | Status |
|---|---|---|
| Readiness check that fails when the database is unreachable; traffic goes to a new deploy only when it passes | `/health`, `healthCheckPath` in `render.yaml` | Met |
| Uptime monitoring, public status page, alert on a failed daily job | Better Stack, [runbook](RUNBOOK.md#observability) | Partly: measured, but no target |
| A failed migration never takes the service down | `preDeployCommand`, [runbook](RUNBOOK.md#deploys-and-rollback) | Met |
| A manual kill switch that does not depend on the app itself | [ADR-0042](adr/0042-manual-maintenance-mode.md) | Met |
| Every log line of a request can be found again; unhandled errors are one alertable record | `X-Request-ID`, `LOG_FORMAT=json`, `backend/app/core/log_config.py` | Met |
| Rollback path | [runbook](RUNBOOK.md#deploys-and-rollback) | Met (does not undo migrations) |

### Reliability and data integrity

| Requirement | Evidence | Status |
|---|---|---|
| Models and migrations never drift; migrations run up and down against real Postgres | `migrations` CI job | Met |
| A check that never happened costs no token (LLM failure, timeout, cap reached) | `services/token_wallet.py`, `anthropic_grading_timeout_seconds` (15 s), [ADR-0043](adr/0043-token-based-ai-grading-monetization.md) | Met |
| A payment is credited exactly once, even if Stripe redelivers | `stripe_payment_intent_id` lookup and unique index, [ADR-0048](adr/0048-stripe-hosted-checkout-with-webhook-fulfilment.md) | Met |
| Catalog updates keep ids and therefore all progress | [ADR-0022](adr/0022-catalog-sync-by-upsert.md) | Met |
| The exam deadline cannot be extended by the client | [ADR-0029](adr/0029-exam-simulation.md) | Met |
| Progress lives server-side; a transient `/auth/me` failure is not a logout | [ARCHITECTURE.md](ARCHITECTURE.md#frontend-frontend) | Met |

### Performance efficiency and scalability

| Requirement | Evidence | Status |
|---|---|---|
| Read-heavy catalog served from memory | [ADR-0009](adr/0009-in-process-cache-for-question-catalog.md) | Met |
| At most 5 LLM calls in flight, the rest answers 503 instead of starving the API | `grading_max_concurrent_calls` | Met |
| Public pages are prerendered, assets are hashed and cached for a year, fonts are self-hosted | [ADR-0025](adr/0025-build-time-prerender-of-the-landing-page.md), [ADR-0021](adr/0021-self-hosted-web-fonts.md), `render.yaml` | Met |
| Exactly one instance and one worker, on purpose, with the condition to change it written down | [ADR-0007](adr/0007-in-memory-per-ip-rate-limiting.md), [runbook](RUNBOOK.md#deploys-and-rollback) | Met (no measurable trigger, see the gaps) |
| Latency and throughput targets | none | **Not defined** |

### Maintainability and testability

| Requirement | Evidence | Status |
|---|---|---|
| Coverage: backend 95 % (lines and branches), frontend 95 % lines / 90 % branches | `CLAUDE.md` → Test Coverage | Met, required checks |
| Test quality: mutation score backend 87 %, frontend 90 % | [mutation-testing.md](mutation-testing.md) | Met, daily job |
| Static checks: ruff, mypy, strict TypeScript, ESLint, complexity capped at 10 | `CLAUDE.md` → Linting | Met, required checks |
| Every route has an integration test; API types are generated, not written twice | [postman-and-integration-tests.md](postman-and-integration-tests.md), [ADR-0046](adr/0046-api-types-generated-from-openapi.md) | Met |
| Decisions and current state are documented | [ADRs](adr/README.md), [ARCHITECTURE.md](ARCHITECTURE.md) | Met |
| Infrastructure as code; every deploy is a merge to `main` | `render.yaml`, branch protection | Met |

### Usability, portability, cost

| Requirement | Evidence | Status |
|---|---|---|
| Web only, German only, no app store | [ARCHITECTURE.md](ARCHITECTURE.md#product) | Met |
| Accessibility | `eslint-plugin-jsx-a11y` (static rules only) | Partly: no target, no manual test |
| Standard components, runnable locally with Docker Compose | `docker-compose.yml`, [README.md](../README.md) | Met |
| Minimal running cost; LLM spend bounded twice (token balance, separate Anthropic workspace with its own limit) | [ADR-0043](adr/0043-token-based-ai-grading-monetization.md), [ADR-0044](adr/0044-drop-weekly-ai-check-budget.md) | Met (the figures are not written down) |

## 3. Open and invisible NFRs

Priority **A** = settle before a broader launch, **B** = worth doing, **C** = watch. "Invisible" means the requirement exists in practice but nothing states or measures it.

| # | Prio | Gap | Why it matters here | Proposal |
|---|---|---|---|---|
| 1 | A | **Backup and restore targets** (RPO/RTO). The runbook itself says the retention window is still to be confirmed, and no restore drill is recorded. | Learner progress is the product; a lost database loses months of learning. | Target RPO ≤ 24 h, RTO ≤ 4 h; check the retention in Render's Recovery tab, run the drill once and record the date in the runbook. |
| 2 | A | **Deleting inactive accounts** is reserved in the terms (12 months) but nothing does it; `users.last_login_at` exists for it ([ADR-0041](adr/0041-agb-acceptance-and-inactivity-retention.md)). | A gap between the legal text and the system, not just a missing feature; also an ongoing DSGVO storage-limitation question. | Daily cron like `sks-lotse-daily-report`, with a reminder mail first; or drop the clause. |
| 3 | A | **Login is one chain without fallback**: email code via Resend only, SSO not built. Deliverability (SPF/DKIM/DMARC) and the time until the code arrives are undefined; a Resend outage locks everyone out. | Every session starts here, every 7 days. | Target "code within 30 s for 95 %", check DMARC, decide whether SSO or a fallback is worth it. |
| 4 | A | **Availability target**. Monitored, but no objective; the Starter plan has no SLA, there is one instance, a deploy may briefly interrupt. | Season peak (February to May) is when downtime hurts. | Target e.g. 99 % per month, stated for the season; avoid deploys on exam-heavy weekends if it ever matters. |
| 5 | B | **Performance targets and load test.** No latency goals, no web-vitals or bundle budget, capacity of the worker is a guess. | The 50–100 req/s above is not measured. | One-off load test against a local stack (k6 or Locust), result into section 1; target p95 < 500 ms for reads. |
| 6 | B | **Per-IP rate limit on shared addresses.** A class in one school network or a mobile-carrier NAT shares 300 requests per 5 minutes. | Sailing-school classes are a likely early adopter. | Count authenticated requests per user instead of per IP, or raise the cap for authenticated calls. |
| 7 | B | **Capacity limits and the trigger for scaling out.** DB plan `basic-256mb`, its storage limit and the connection pool are not stated; there is no measurable trigger for "more workers, then Redis". | The one-worker design is deliberate, but its exit condition is not measurable. | Write the numbers next to the plan; trigger e.g. sustained p95 > 1 s or > 50 concurrent users. |
| 8 | B | **Accessibility** target and check. Only static lint rules. Also to clarify legally whether the BFSG (in force since 2025-06-28, online sales to consumers) applies now that tokens can be bought, or the micro-enterprise exemption does. | Not a guess to make in a doc; needs a legal answer. | WCAG 2.1 AA as target, one manual keyboard and screen-reader pass; legal clarification. |
| 9 | B | **Browser, device and offline support.** No supported-browser list; learners are mostly on phones, some on board without coverage. Offline use is not built and not ruled out. | Decides whether a PWA is ever wanted. | State the browser matrix (last two versions of the major browsers) and record offline as an explicit non-goal, or set a goal. |
| 10 | B | **Observability beyond logs.** No metrics (latency, error rate, thread use); the alerts are "level=ERROR" and the heartbeat. Log retention at Better Stack and whether email addresses appear in logs are not stated. | Privacy (logs are personal data) and finding slow degradation before users do. | Document log retention and content; add a latency/error-rate view or alert. |
| 11 | B | **Security assurance.** No penetration test, no threat model, no patch-time target other than "same day" after an alert that arrives up to ~3 days late; backup encryption and access are undocumented. | Passwordless login plus payments raises the stakes since Stripe went live for admins. | One-page threat model; a light external or self-run test before `STRIPE_CHECKOUT=on`. |
| 12 | B | **Bus factor.** One operator holds Render, Stripe, IONOS, Anthropic, Resend and Better Stack. | An absence during the season means no one can react. | Emergency checklist and access hand-over in the runbook. |
| 13 | C | **Catalog currency.** ELWIS can publish a new catalog; the update path exists, but no target for how quickly it is followed. | Learners would study outdated questions. | Check ELWIS at a set interval, note the catalog date shown in the app. |
| 14 | C | **Budget.** Monthly infrastructure cost and the Anthropic spend limit are not written down anywhere in the repo. | Makes an unexpected bill or a hit limit an incident. | Record both here. |
| 15 | C | **Third-party dependencies.** Anthropic's failure is handled (503, token refunded); the behaviour for Resend, Stripe, Umami and AdSense is described piecemeal. | One table saves time in an incident. | Table: provider, purpose, what the learner sees when it is down. |
| 16 | C | **Time zone and language.** German only and Europe/Berlin are implicit (the old daily AI budget was the only place the zone was visible). | Matters for the exam timer, reports and any later market. | State as a decision or leave. |

## Review

The assumptions in section 1 are calibrated against the real figures (accounts, daily/weekly/monthly active learners from the daily report) about every six months and after any change in reach: a new distribution channel, a ranking on a large sailing site, turning on `STRIPE_CHECKOUT=on`. When a number changes the conclusion (for example sustained more than ~50 concurrent users), the scale-out trigger in gap 7 fires and needs an ADR. A gap that turns into a decision gets its own ADR and is removed from section 3 rather than left as a stale row.
