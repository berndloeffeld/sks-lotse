# Sizing and non-functional requirements

Expected load and the non-functional requirements (NFRs) the project already meets.

Numbers marked **assumption** are estimates. Replace them with the real ones from the daily KPI report ([ADR-0032](adr/0032-daily-kpi-report.md)).

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
- **Data:** under 300 MB. `question_progress` ≈ accounts × ~540 questions ≈ 680k rows; the catalog has ~638 raw questions ([ADR-0017](adr/0017-official-topic-taxonomy-and-seemannschaft-merge.md)). Kartenaufgaben add ~18 short rows per completed sheet (`chart_attempt_tasks`, [ADR-0052](adr/0052-chart-exercises-from-reviewed-yaml.md)); their exercises (solutions as text, [ADR-0053](adr/0053-chart-solutions-transcribed-as-text.md)) and the few drawings and the PDF cut of every task and solution (about 5 MB for seven sheets, loaded only for the current task, [ADR-0063](adr/0063-chart-task-original-beside-the-form.md)) are static files, not database rows.
- **Lotsen-Checks:** up to ~10,000 a year, at most 5 in flight at once, catalog and Kartenaufgaben together. A Kartenaufgaben check ([ADR-0058](adr/0058-lotsen-check-for-chart-exercises.md)) runs on a stronger model with a longer prompt: a few seconds instead of about two (a catalog check, [ADR-0066](adr/0066-lotsen-check-with-topic-context-on-haiku-5-5.md): median 2.2 s, at most ~11 s measured, 15 s timeout), up to its 45 s timeout, holding its slot (and a worker thread) as long.
- **Login mails:** ~4,000–6,000 a year (7-day session, no refresh token).

### SBF Lotse (second site, [ADR-0067](adr/0067-second-site-from-one-codebase.md))

Basis, from official figures:
- **~96,000 SBF a year, See and Binnen together:** 96,327 in 2022 and 101,411 in 2021. Source: the Bundesministerium für Verkehr's answer of 3 January 2024 to an IFG request ([FragDenStaat #286519](https://fragdenstaat.de/anfrage/aktuelle-statistik-ueber-anzahl-erteilter-sportbootfuehrerscheine-und-sportkuestenschifferscheine/)). It doesn't split See from Binnen.
- **See vs. Binnen:** the latest split is from 2016, with 38,802 SBF See and 51,836 SBF Binnen, so See is ~43 %. Source: [BT-Drucksache 19/4502](https://dserver.bundestag.de/btd/19/045/1904502.pdf), p. 2.
  - The two sources don't quite agree for the years they share (2016: 90,638 vs. 84,768).
- **Assumptions, as for SKS Lotse:**
  - The 43 % still holds: ~41,000 SBF See a year.
  - +20 % retakes.
  - ~70 % learn digitally: ~34,500 SBF See and ~81,000 SBF overall.
  - The planning figure is again 30 % of them. More apps compete for the SBF than for the SKS, so this is the upper end.

**Now (increment 1, Navigationsaufgaben See for guests): static load only.**
- At 30 %, ~10,000 learners a year.
- They are served prerendered pages and hashed assets from Render's CDN.
- The SBF build makes no API call. Its CSP has no API host, and the CI step `check-sbf-build.mjs` fails a build that contains the API client.
- There is no database row and no worker time.
- With the Navigationsaufgaben built (`VITE_SBF=on`, [ADR-0068](adr/0068-sbf-navigation-tasks-from-reviewed-yaml.md)), the build grows by their data chunk (about 50 KB) and 270 cuts of the PDF (about 1.6 MB in all). A run loads only the cuts of the subtask it shows, a few KB each.

**Later (accounts, SBF See and Binnen), at the planning figure:**

| | Low (5 %) | Medium (15 %) | **High (30 %, planning figure)** |
|---|---|---|---|
| New accounts per year | ~4,000 | ~12,000 | **~24,000** |
| Active at once, average / season peak | ~390 / ~970 | ~1,170 / ~2,900 | **~2,300 / ~5,800** |
| Online at once, peak | 50–100 | 150–290 | **290–580** |
| Requests at peak (as SKS: ~0.16 req/s per learner online) | 8–16 req/s | 24–46 req/s | **46–93 req/s** |

Derivation: as for SKS Lotse, with one change. **Assumption:** an SBF learner is active for 4–6 weeks, not 6–10, because the exam is shorter.

**Does the one worker carry it?**
- Not at the planning figure. SBF's 46–93 req/s plus SKS Lotse's 4–8 req/s reaches the ~50–100 req/s the single worker is estimated to carry. That estimate is **not measured**.
- At the medium figure it does, with room to spare.
- So before SBF Lotse gets accounts (increment 2):
  - Measure the worker with a load test.
  - Plan the move of the in-process state (rate limiter, catalog cache, Lotsen-Check caps) to a shared store, so more workers or instances become possible ([ADR-0007](adr/0007-in-memory-per-ip-rate-limiting.md), [ADR-0009](adr/0009-in-process-cache-for-question-catalog.md)).
- Until then, nothing changes: guests on sbf-lotse.de never reach the API.

## 2. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | Login required for anything stored; the catalog by topic is open, served statically, with no open API route for it |
| | Hashed, short-lived, purpose-bound email codes |
| | Session cookie not readable by scripts, `__Host-` prefixed when deployed; logout ends all sessions |
| | Every route needs a session unless listed as public |
| | After login, only a path of the app itself is accepted as the return target (no open redirect) |
| | Layered abuse protection (IP and email limits, blocklists) |
| | Admin: allowlist plus TOTP (one code per day; export and deletion need one from the last 5 min) |
| | Enforced CSP, HSTS, frame denial (API responses: `default-src 'none'`) |
| | SBF Lotse's site: no API call, enforced by its CSP (no API host) and a CI check of the build |
| | Request bodies capped before they are read (413 over 64 KB, 1 MB for the Stripe webhook) |
| | security.txt (RFC 9116) with the reporting contact |
| | Prompt-injection hardening of the AI check |
| | No secrets in the git repository |
| | Continuous security scanning |
| | No merge with a known-vulnerable dependency (pip-audit, npm audit high+) |
| Privacy | Deletion and export of personal data |
| | A retention limit for personal data that outlives the account (blocked addresses: 24 months) |
| | EU hosting; Anthropic (US) under a data processing agreement |
| Availability | Readiness check; traffic only to a deploy that passes it |
| | Monitoring and status page (partly: no target) |
| | Configurable maintenance mode |
| Performance | Catalog served from memory; cap on concurrent LLM calls (shared by both kinds of Lotsen-Check) |
| | Prerendered public pages, incl. the catalog by topic and the Kartenaufgaben (guests cause no API load beyond the session check), cached hashed assets, self-hosted fonts |
| | One instance, one worker, on purpose |
