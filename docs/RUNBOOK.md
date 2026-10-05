# Runbook

How to operate SKS Lotse in production: where to look, what to do when something breaks, and the recurring chores. What the system *is* is in [ARCHITECTURE.md](ARCHITECTURE.md), and the reasons are in the [ADRs](adr/). Everything here is production-only; there is no staging environment ([ADR-0005](adr/0005-render-deployment-topology.md)).

## Where things live

| What | Where |
|---|---|
| Services, env vars, deploys, database | Render dashboard: `sks-lotse-backend`, `sks-lotse-frontend`, `sks-lotse-daily-report` (cron), `sks-lotse-db` — all declared in `render.yaml` |
| Uptime monitors, status page, logs, heartbeat | Better Stack. Public status page: [sks-lotse.betteruptime.com](https://sks-lotse.betteruptime.com) |
| CI, branch protection, Dependabot | GitHub (`.github/`) |
| Security findings | Aikido dashboard and alert mails (rescans about every three days; see [Security alerts](#security-alerts-aikido)) |
| Login emails | Resend (sending domain verified via IONOS DNS) |
| AI answer check | Anthropic Console, its own workspace and spend limit for `ANTHROPIC_GRADING_API_KEY` |
| Analytics | Umami Cloud |
| Ads and the consent message | Google AdSense → Privacy & messaging |
| DNS for all domains | IONOS |

## Observability

- **Logs**: the backend and the cron job write one JSON object per line (`LOG_FORMAT=json`, `backend/app/core/log_config.py`), and Render's log stream forwards them to Better Stack via syslog-ng. Fields: `time`, `level`, `logger`, `message`, `request_id` (during a request), plus any `extra` fields, and `exception` with the traceback.
- **Finding one request**: every response carries `X-Request-ID`. Search Better Stack for that `request_id` to get every line the request logged. Clients may send their own `X-Request-ID` (plain ASCII, up to 64 characters), and it is kept.
- **Unhandled exceptions**: one record, `level=ERROR`, `message="Unhandled exception"`, with `method`, `path` and `exception`. This is what the error alert should match on.
- **Signals worth an alert or a saved search**:
  - `level=ERROR`: every unhandled crash, a failed health check, failed OTP or report emails.
  - `message` starting with `ai-grade flagged-account`: an account past the AI-check sanitizer threshold ([ADR-0040](adr/0040-ai-grading-sanitizer-and-abuse-monitoring.md)).
  - `message` starting with `ai-grade rate limit` or `AI answer check unavailable`: budget/rate caps hit, or Anthropic failing.
  - `message` starting with `admin action`: the audit trail of admin updates, exports and deletions (ids only).
- **Uptime**: Better Stack monitors the website and `/health`. `/health` is readiness: it answers `503` when the database is unreachable.
- **Daily report heartbeat**: the cron pings `BETTERSTACK_HEARTBEAT_URL` only after every recipient got the report. A missing ping means the run failed or never started.

## Deploys and rollback

- A push to `main` deploys all services once its GitHub checks have passed (`autoDeployTrigger: checksPass`). The static site and the backend deploy independently, so an API change must stay backward compatible for one deploy (frontend and backend can briefly run different versions).
- **`render.yaml` itself takes effect on the Blueprint sync, right after the push, not with the deploy.** Routes and headers go live while the build still waits for the checks. A route may therefore never point at a file the same change creates: a rewrite to a missing file answers `200` with an empty body (and the CDN caches it). A new prerendered page therefore answers empty for a few minutes after its merge. Pages that already exist aren't affected (ADR-0057).
- The backend migrates in `preDeployCommand` (`alembic upgrade head`). **A failed migration aborts the deploy, and the previous instance keeps serving.** Read the deploy log, fix forward with a new PR, and don't retry blindly.
- The backend starts with exactly one uvicorn worker. Never scale it out or add workers without first moving the in-process rate limiter and cache to a shared store (ADR-0007, ADR-0009).
- **Rollback**: prefer reverting the PR on `main` (a new squash commit), which goes through CI like everything else. Render's "Rollback" to an earlier deploy is the emergency lever, but it doesn't undo migrations: only use it when the bad deploy didn't change the schema, or the old code still works with the new schema.

## Maintenance mode

A manual kill switch for an ongoing malfunction, deliberately not wired through the app's own `/admin` UI — that might be affected by the same malfunction. While `MAINTENANCE_MODE` is `true` on `sks-lotse-backend`:

- Every `/api/v1/*` request gets a `503` with an `X-Maintenance-Mode: 1` header (`app/core/maintenance.py`). `/health` is unaffected — Render's own reachability check and the uptime monitor keep working.
- The frontend (`frontend/src/App.tsx`) shows a full-page "Wartungsarbeiten" notice for every route except `/imprint`, `/privacy` and `/terms`, which stay reachable (§5 DDG Impressumspflicht).
- Already-open tabs pick it up on their next API call, not instantly — the maintenance page has an "Erneut prüfen" button for that (`frontend/src/pages/MaintenancePage.tsx`).
- No live reload (`backend/app/core/config.py`): flipping it always costs a redeploy of the backend, on the order of a minute.
- **Limit: not a switch for a database outage.** The redeploy runs `preDeployCommand: alembic upgrade head` (`render.yaml`), which needs the database; if that is unreachable the deploy fails (Render: a failing pre-deploy command fails the whole deploy) and the old instance keeps serving, so the switch never takes effect. Whether an environment-variable-only deploy runs the pre-deploy step at all is not stated in Render's docs — check it on the next trial run of the switch and note the result here. In a database outage, tell visitors by other means (the uptime monitor's status page, a pinned note on the contact channels).

**Fast path — Render dashboard**: `sks-lotse-backend` → Environment → set `MAINTENANCE_MODE` to `true` (or `false` to turn it back off) → Save. Redeploys automatically.

**Alternate path — GitHub Action**: Actions tab → "Maintenance mode toggle" → Run workflow → choose `on`/`off`. Useful when Render dashboard access isn't at hand. Needs the one-time setup below done once.

## Database

- `sks-lotse-db`, PostgreSQL 18 (pinned via `postgresMajorVersion` in `render.yaml`), plan `basic-256mb`.
- **Backups**: point-in-time recovery (PITR) on the Render Postgres. Read from the Render dashboard on 2026-10-01; update after every plan change:

  | Value | Where to read it in Render | Value |
  |---|---|---|
  | Database plan | `sks-lotse-db` → Info | `basic-256mb` (per `render.yaml`) |
  | Workspace plan | Workspace → Settings → Billing | Hobby |
  | PITR window (how far back a restore can go) | `sks-lotse-db` → Recovery | 3 days (7 days with a Pro workspace) |

  Deleted data stays in these backups until it ages out of the 3-day window. That is short enough that the Datenschutzerklärung doesn't name a separate backup period; mention it there if the window grows to weeks.
- **Restore drill** (do it once, and after plan changes): in the Recovery tab, restore to a point in time into a *new* database, connect to it read-only, and check that `users`, `question_progress` and `exam_attempts` look plausible. Then delete the copy (it holds a full set of personal data). A real restore means pointing the backend's `DATABASE_URL` at the restored database, or restoring over the original per Render's instructions. Plan for the gap between the restore point and now. The restored copy is a separate, ad hoc database, not the one declared in `render.yaml` — it isn't covered by `ipAllowList` below, so connect to it directly as before; if Render ever changes that, use the Render Shell approach instead (see External access).
- **External access** is closed (`ipAllowList: []` in `render.yaml`, ADR-0005 addendum 2026-09-23): the database only accepts connections from services in the same Render account over its internal network (the backend, the cron job), not from a local `psql`. The admin UI (`/admin/users`, `/admin/questions`) covers the lookups that used to need direct SQL. For anything it doesn't cover, open a **Shell** on the `sks-lotse-backend` service in the Render dashboard — it runs inside the account's internal network, so it reaches the database despite the allow list — and query it with the app's own SQLAlchemy session, e.g.:
  ```python
  from app.core.database import get_session_factory
  from app.models.user import User
  with get_session_factory()() as db:
      db.query(User).filter_by(email="...").first()
  ```
- **Catalog**: rows come only from the data migrations ([catalog-pipeline.md](catalog-pipeline.md)); never edit `questions`/`topics` by hand.

## Rotating secrets

All secrets are `sync: false` in `render.yaml` and set in the Render dashboard. Changing one there redeploys the service.

| Secret | Set on | Rotating it means |
|---|---|---|
| `JWT_SECRET` | backend **and** cron | Every session and every pending OTP code becomes invalid; everyone logs in again. Admins' stored TOTP secrets become unreadable too: [reset every admin's 2FA](#reset-an-admins-2fa) afterwards and set it up again. Generate with `openssl rand -hex 32`, set it on both services in one go (the cron only needs it to pass config validation). |
| `RESEND_API_KEY` | backend **and** cron | Create the new key at Resend, set it on both services, check that a login code arrives, then revoke the old key. |
| `ANTHROPIC_GRADING_API_KEY` | backend | New key in the grading workspace of the Anthropic Console, set it, try one AI check, revoke the old one. While it's empty or invalid the check answers 503 and the reserved token is refunded. |
| `ADMIN_EMAILS`, `ALLOWED_EMAILS` | backend (`ADMIN_EMAILS` also on the cron) | Not secret, but kept out of the repo. `ADMIN_EMAILS` empty = no admins, and the cron has no recipients. |
| `BETTERSTACK_HEARTBEAT_URL` | cron | A new heartbeat in Better Stack; the old one then alerts until deleted. |
| `VITE_UMAMI_WEBSITE_ID`, `VITE_ADSENSE_CLIENT_ID` | frontend | Build-time values: changing them triggers a rebuild of the static site. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | backend | Secret key (`sk_live_…`/`sk_test_…`) and the webhook endpoint's signing secret (`whsec_…`). Rotate the key in the Stripe dashboard (roll key), set it, revoke the old one. A new signing secret: roll it on the endpoint, set it at once — deliveries fail with 400 until then and Stripe retries. |
| `STRIPE_CHECKOUT`, `STRIPE_PRODUCT_TOKENS_S`/`_M`/`_L`/`_XL` | backend | Not secret, dashboard-only. The flag is `off` (default) / `admins` / `on`; the product ids (`prod_…`) differ between Stripe test and live mode. See [Stripe checkout](#stripe-checkout). |
| `MAINTENANCE_MODE` | backend | Not a secret, but dashboard-only like `ADMIN_EMAILS` above. `true`/`false`, unset = `false`. See [Maintenance mode](#maintenance-mode). |

## Stripe checkout

Learners buy token packages via Stripe Hosted Checkout ([ADR-0048](adr/0048-stripe-hosted-checkout-with-webhook-fulfilment.md), parameters in [docs/stripe/README.md](stripe/README.md)).

- **Webhook endpoint (once per Stripe mode)**: Stripe dashboard → Developers → Webhooks → add `https://<backend-domain>/api/v1/payments/webhook`, events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`. Failed deliveries show there and are retried by Stripe; "Resend" re-delivers safely (idempotent).
- **Flag `STRIPE_CHECKOUT`**: `off` = nobody can buy; `admins` = only `ADMIN_EMAILS`; `on` = every learner. Changing it redeploys the backend. Without the secret key or a package's product id, that package can't be bought whatever the flag says. The webhook keeps crediting with the flag `off`.
- **Before `on`**: the legal texts (Datenschutz with Stripe as recipient and third country, AGB for purchase in the app, FAQ) and `CURRENT_AGB_VERSION` were updated for this (2026-09-25, [ADR-0043](adr/0043-token-based-ai-grading-monetization.md)); merge and deploy that change first. `admins` works without it, only admins can buy.
- **Refund** (the learner asks for their money back, or we owe it):
  1. Find the payment: `/admin/users` → the account → "Daten exportieren" shows the purchase with its `stripe_payment_intent_id`; search that `pi_…` in the Stripe dashboard.
  2. Stripe dashboard → the payment → Refund (full, or partial for a partly used package if that was agreed). The money side is recorded there; our ledger keeps the original purchase row unchanged.
  3. Take the tokens back: `/admin` → the account → "Tokens abbuchen" with the package's token count. The balance never goes below 0: if part of the package is already used, only what's left is taken, and the page says how many. This writes an `admin_debit` row (negative `tokens_granted`) and logs `admin action … debit_tokens=… debited=…`.
  4. Tell the learner by mail: amount, expected arrival (Stripe: usually 5–10 business days), and the new token balance.
  - Paid but the account was deleted in between: the log says `user … no longer exists, refund manually`. Refund in Stripe; there are no tokens to take back.
- **Chargeback / dispute** (the learner's bank reverses the payment; Stripe mails a dispute notice and lists it under Payments → Disputes, with a "respond by" date — usually 1–3 weeks). The webhook doesn't subscribe to dispute events, so the mail and the dashboard are the only signals: keep dispute notifications switched on in Stripe → Settings → Notifications.
  1. Right away, take back the package's tokens that are still unused ("Tokens abbuchen", as for a refund), so they can't be spent while the dispute is open.
  2. Decide: **accept** (no counter-evidence, or an obvious mistake on our side; the money and the dispute fee stay with the bank) or **counter**. A stolen card (reason "fraudulent") is usually best accepted, and the account also blocked ("Nutzer sperren").
  3. To counter, submit in Stripe before the deadline, with no more personal data than the case needs: the confirmation mail (package, price, date, waiver sentence), the purchase from the export (`created_at`, `stripe_payment_intent_id`), the AGB version and `agb_accepted_at` from the account, the token balance before and after (how much of the package was used), and the account's `last_login_at`.
  4. Won: grant the debited tokens back ("Tokens gutschreiben", no amount — it's a correction, not a new payment). Lost: nothing else to do; the tokens are already gone.
  5. Repeated disputes from one account: block it (`/admin` → "Nutzer sperren").
- **Confirmation mail** (§ 312f BGB, needed because of the withdrawal waiver): sent by the webhook after the credit. A log line `confirmation mail to user failed, send it by hand` means the credit worked but the mail didn't: send the learner a mail with the package, price, payment date, the payment reference (`stripe_payment_intent_id` in `/admin`), the waiver sentence and the AGB link.
- **Paid but no tokens**: check the endpoint's delivery log in Stripe; a 400 means a wrong `STRIPE_WEBHOOK_SECRET`, 503 an empty one. Fix it and resend the event.

## Kartenaufgaben flag

`CHART_EXERCISES` ([ADR-0052](adr/0052-chart-exercises-from-reviewed-yaml.md)): `off` = nobody sees the Kartenaufgaben (their routes answer 404); `admins` = only `ADMIN_EMAILS`; `on` = every learner, and guests without a login ([ADR-0056](adr/0056-chart-exercises-open-to-guests.md)). Unlike `STRIPE_CHECKOUT` it's declared in `render.yaml` (currently `on`), so switching it is a PR — together with `docs/FEATURES.md`, and together with the static site's `VITE_CHART_EXERCISES`, which must have the same value (a backend test checks it; the frontend's build bakes it in, so the switch for guests takes the frontend's deploy). The usage rights of the WSV's Navigationsaufgaben PDF were confirmed on 2026-10-01 (the ELWIS confirmation covers the question catalog only), and the flag has been `on` since 2026-10-02.

## Data-subject requests (DSGVO)

Learners email the operator ([ADR-0019](adr/0019-admin-allowlist-and-manual-gdpr-fulfillment.md)). Every admin action is logged (`admin action`, ids only).

- **Auskunft / Datenübertragbarkeit (Art. 15/20)**: `/admin/users` → search the email → open the account → "Daten exportieren" downloads the JSON (profile, progress, Fokus marks, reports, exams, Kartenaufgaben runs). Send it to the verified address of the account only.
- **Berichtigung (Art. 16)**: learners edit name, gender, exam variant and email themselves on `/profile`; anything else by hand on request.
- **Löschung (Art. 17)**: learners can delete themselves on `/profile`. On request, `/admin/users` → open the account → "Account löschen" removes the account and everything attached to it (`services/user.py`).
- **Einschränkung / Widerspruch (Art. 18/21)**: handled case by case; there is no tooling. An objection to a block on the blocklist: review the reason, and if the block is no longer needed, remove the entry on `/admin` → Sperrliste (or "Sperre aufheben" on the account). Answer either way.
- **Blocklist**: an email entry outlives the account on purpose and is deleted automatically 24 months after the block; domain entries stay until removed ([ADR-0045](adr/0045-manual-email-domain-blocklist.md), addendum 2026-10-01). The export of an existing account lists the entries matching it (`blocklist_entries`). Someone *without* an account who asks what is stored about them: search the address and its domain on the Sperrliste page and answer by hand (value, reason, date, when it's deleted — not which admin blocked it).
- Answer within a month (Art. 12(3) DSGVO).

## Data breach (Art. 33/34 DSGVO)

A data breach is any security incident that leads to personal data being destroyed, lost, changed, disclosed or accessed without authorization (Art. 4 Nr. 12 DSGVO). Typical cases here: a leaked `JWT_SECRET` or `DATABASE_URL`, a compromised admin account, a data export sent to the wrong address, a database copy (restore drill) left reachable, an exploited Aikido finding, or a processor (Render, Better Stack, Resend, Anthropic, Stripe, Umami, Google) reporting an incident that affects our data.

**Who**: the operator, as the controller named in the Impressum. There is no data protection officer (not required at this size); the operator decides, notifies and documents. **The clock**: 72 hours from the moment we *become aware* of the breach, weekends included. A processor's notice starts it when it reaches us.

1. **Contain** (first hour): what stops the leak — [maintenance mode](#maintenance-mode), [rotate the exposed secret](#rotating-secrets) (`JWT_SECRET` ends every session), block the account involved (`/admin` → "Nutzer sperren"), [reset an admin's 2FA](#reset-an-admins-2fa), revoke API keys at the provider, delete a stray database copy. Don't delete logs or evidence.
2. **Write it down at once**, in a private incident note *outside* this repository (it will contain personal data): when we found out and how, what happened, which data and roughly how many accounts, what was done when. Art. 33(5) requires this documentation for *every* breach, including ones that don't need to be reported. Keep it; the supervisory authority can ask for it.
3. **Assess the risk** to the people affected. Which data: email addresses only, learning progress, the purchase ledger, blocklist reasons, an admin's TOTP secret? How many accounts? How likely is harm (phishing with the email list, embarrassment, financial loss)? Evidence comes from Better Stack (`admin action` lines, `request_id`), the Render dashboard events and the provider's notice.
4. **Report to the authority within 72 h**, unless the breach is *unlikely to result in a risk* (then write down why in the incident note and stop here). Supervisory authority: Berliner Beauftragte für Datenschutz und Informationsfreiheit, Alt-Moabit 59–61, 10555 Berlin, online form "Datenpanne melden" on datenschutz-berlin.de. Content (Art. 33(3)): what happened; categories and approximate number of people and records; contact (`kontakt@sks-lotse.de`); likely consequences; measures taken and planned. Whatever isn't known yet can be reported later in stages (Art. 33(4)). A report after 72 h must give the reasons for the delay.
5. **Tell the people affected** without undue delay if the risk is *high* (Art. 34), e.g. email addresses together with learning data leaked, or someone logged in as other learners. In plain German, by email to the affected addresses: what happened, the likely consequences, what we did, what they can do (e.g. watch out for phishing mails claiming to be SKS Lotse), the contact address. The addresses come from a Render Shell query (see [Database → External access](#database)). Not needed if the data was unreadable to the attacker or the risk has been removed; a public notice replaces individual mails only if those would take disproportionate effort.
6. **Afterwards**: fix the cause in a PR. If the fix changes a decision, write an ADR. Update this runbook if a step was missing.

## Admin 2FA

`/admin` needs a code from an authenticator app (Authy, Google Authenticator, …) on top of the email login, at most 60 min old (`ADMIN_MFA_MAX_AGE_MINUTES`); exporting or deleting an account asks again unless the last code is at most 5 min old (`ADMIN_RECENT_MFA_MAX_AGE_MINUTES`) ([ADR-0047](adr/0047-totp-step-up-for-admin-area.md), addendum 2026-10-01). A code is accepted once only, so for the second prompt wait for the app's next code.

- **Setup**: log in as the admin, open `/admin` → "Einrichtung starten" → scan the QR code → enter the code. Do this right after adding an address to `ADMIN_EMAILS`: until it's done, whoever logs in first as that address could enrol their own app. `totp_enabled_at` in the account's export shows it's done.
- **Wrong codes**: 5 attempts per 15 minutes per admin, then 429 until the window passes. Check the phone's clock (automatic time) if valid-looking codes keep failing.

### Reset an admin's 2FA

For a lost or replaced phone, or after rotating `JWT_SECRET`:

1. GitHub → Actions → "Reset admin 2FA" → Run workflow → the admin's email address. It starts `python -m scripts.reset_admin_totp --email …` as a Render one-off job and waits for it (output: Render dashboard → `sks-lotse-backend` → Jobs). Needs the `RENDER_API_KEY`/`RENDER_BACKEND_SERVICE_ID` secrets ([One-time setup](#one-time-setup-recreating-the-environment), step 6).
2. Without GitHub: Render dashboard → `sks-lotse-backend` → Shell → `python -m scripts.reset_admin_totp --email …`.
3. The script also ends every session of that account. Log in again, open `/admin`, set 2FA up afresh.

## security.txt

`frontend/public/.well-known/security.txt` (RFC 9116) names `kontakt@sks-lotse.de` and links `SECURITY.md`. Its `Expires` field (currently 2027-09-30) must stay in the future and at most a year ahead: move it forward in a PR before it runs out.

## Security alerts (Aikido)

Aikido rescans the repo about every three days and mails when it finds something. It is not a merge gate (nothing in CI, nothing to check before merging), so the alert is the only signal, and it lags the change that caused it by up to ~3 days. Treat an alert as interrupting: decide the same day.

1. Look at what is open: the Aikido dashboard, or `./scripts/check_aikido.sh` (needs a plan with API access; otherwise it prints the API error and the dashboard is the way). It reads `.env.aikido` (gitignored, not committed) for `AIKIDO_CLIENT_ID`/`AIKIDO_CLIENT_SECRET`, from an API client created at [app.aikido.dev/settings/integrations/api/aikido/rest](https://app.aikido.dev/settings/integrations/api/aikido/rest).
2. A vulnerable dependency: bump it on a `feature/*` branch (`backend/requirements*.in` → pip-compile with hashes, or `npm update` in `frontend/`; README → Dependencies), let CI run, merge. Dependabot may already have opened that PR.
3. A finding in our own code (SAST): fix it, or, if it is a false positive or an accepted risk, mark it *ignored* in Aikido with the reason written down. Don't leave it open.
4. Anything that looks exploitable in production (leaked secret, auth bypass): fix and deploy first, then rotate what was exposed (see *Rotating secrets*).

## AI-check abuse

- `/admin` shows each account's "Sanitizer-Flags" (`ai_flags_count`). Past `GRADING_SANITIZER_LOG_THRESHOLD`, every further check of that account is logged with question id and outcome, never the text ([ADR-0040](adr/0040-ai-grading-sanitizer-and-abuse-monitoring.md)).
- The token balance is the only spending control ([ADR-0044](adr/0044-drop-weekly-ai-check-budget.md)): an account runs out on its own once its tokens are spent, and stays blocked until an admin credits more on `/admin`.
- Cost ceiling: the Anthropic workspace's own spend limit backs up the per-account token balance.

## Daily KPI report

- The `sks-lotse-daily-report` cron runs daily at 06:00 UTC ([ADR-0032](adr/0032-daily-kpi-report.md)) and mails aggregates to `ADMIN_EMAILS`.
- The report also lists Kartenaufgaben runs, Lotsen-Checks (by kind) with the tokens they cost, and Stripe purchases with revenue. Checks come from `lotse_check_log`, which the job trims to 30 days after computing the report; before 2026-10-05 nothing was counted, so those figures start at zero.
- Locally: `cd backend && python -m scripts.send_daily_report` (needs a `.env` with a database and `RESEND_API_KEY`).
- It lists the most-reported questions of the last 7 days ("Frage melden"). There is no admin page for the reports themselves (ADR-0030 addendum 2026-09-24); read their comments in a Render Shell (see Database → External access), e.g. `db.query(QuestionReport).order_by(QuestionReport.created_at.desc()).limit(20).all()` with `from app.models.question_report import QuestionReport`.
- A failing recipient doesn't stop the others. The run exits 1 on any failure (visible in Render) and then skips the heartbeat, so Better Stack alerts too.

## Settings that live only in dashboards

`render.yaml` doesn't cover everything, and a Blueprint Sync doesn't always remove what the file no longer declares:

- **Render**: Custom Domains; env var *values*. A header or env var removed from `render.yaml` may linger on the service. In PR #150 the old `Content-Security-Policy-Report-Only` header had to be deleted by hand in the frontend service's settings. After such a change, check the live response headers.
- **Better Stack**: monitors, alert rules, the status page and the heartbeat.
- **AdSense**: the consent message (TCF) and site approval.
- **Resend / IONOS**: the sending-domain DNS records.

## One-time setup (recreating the environment)

Account-level steps, done by the project owner:

1. Connect the GitHub repo to Render and "Deploy from Blueprint" with `render.yaml`.
2. Set every `sync: false` key in the dashboard (see [Rotating secrets](#rotating-secrets)): on the backend `JWT_SECRET`, `ANTHROPIC_GRADING_API_KEY`, `RESEND_API_KEY`, `ALLOWED_EMAILS`, `ADMIN_EMAILS`; on the cron `JWT_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAILS` (same values) and `BETTERSTACK_HEARTBEAT_URL` (a daily heartbeat with a grace period of a few hours); on the frontend `VITE_UMAMI_WEBSITE_ID` (from Umami's tracking snippet, [ADR-0016](adr/0016-umami-cloud-analytics-without-consent-banner.md)) and `VITE_ADSENSE_CLIENT_ID`.
3. Domains ([ADR-0015](adr/0015-frontend-deployment-topology.md)):
   - `sks-lotse.de` and `www.sks-lotse.de` → Custom Domains on `sks-lotse-frontend`. A domain can only be attached to one service.
   - `api.sks-lotse.de` → Custom Domain on the backend, plus `CNAME api → sks-lotse-backend.onrender.com` at IONOS. The frontend's `VITE_API_BASE_URL` points here.
   - `sks-lotse.com` and `www.sks-lotse.com` → Custom Domains on the backend, which 301-redirects them to `sks-lotse.de` (`backend/app/core/canonical_domain.py`, `SECONDARY_HOSTS`). This deliberately avoids IONOS's paid forwarding (~8 EUR/month just for SSL on the redirect).
   - All four domains were registered at IONOS on 2026-09-16. No formal trademark search (DPMA/EUIPO) for "SKS Lotse" has been done yet; worth doing before investing further in the brand.
   - `sks-lotse.global` and `sks-lotse.store` are registered but unused: no DNS, no Custom Domain, not in `SECONDARY_HOSTS`. Add them the same way as `.com` if ever needed.
4. Better Stack: monitors on `https://sks-lotse.de` and `https://api.sks-lotse.de/health`, a log source for Render's log stream, the error alert, and the daily-report heartbeat.
5. Resend: verify the sending domain via the DNS records Resend lists (IONOS).
6. The GitHub Actions that call Render's API — [Maintenance mode](#maintenance-mode) (optional, the Render dashboard path needs none of this) and [Reset admin 2FA](#reset-an-admins-2fa): create a Render API key (Account Settings → API Keys) and add it as the GitHub Actions secret `RENDER_API_KEY`, and add the backend service's id (`srv-...`, from its Render dashboard URL) as the secret `RENDER_BACKEND_SERVICE_ID` (repo → Settings → Secrets and variables → Actions → "Repository secrets" — not sensitive, but simplest to set alongside the API key on the same page).
