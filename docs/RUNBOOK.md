# Runbook

How to operate SKS Lotse in production: where to look, what to do when something breaks, and the recurring chores. What the system *is* is in [ARCHITECTURE.md](ARCHITECTURE.md), and the reasons are in the [ADRs](adr/). Everything here is production-only; there is no staging environment ([ADR-0005](adr/0005-render-deployment-topology.md)).

## Where things live

| What | Where |
|---|---|
| Services, env vars, deploys, database | Render dashboard: `sks-lotse-backend`, `sks-lotse-frontend`, `sks-lotse-daily-report` (cron), `sks-lotse-db` — all declared in `render.yaml` |
| Uptime monitors, status page, logs, heartbeat | Better Stack. Public status page: [sks-lotse.betteruptime.com](https://sks-lotse.betteruptime.com) |
| CI, branch protection, Dependabot | GitHub (`.github/`) |
| Security findings | Aikido dashboard (checked by hand before each merge) |
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
- The backend migrates in `preDeployCommand` (`alembic upgrade head`). **A failed migration aborts the deploy, and the previous instance keeps serving.** Read the deploy log, fix forward with a new PR, and don't retry blindly.
- The backend starts with exactly one uvicorn worker. Never scale it out or add workers without first moving the in-process rate limiter and cache to a shared store (ADR-0007, ADR-0009).
- **Rollback**: prefer reverting the PR on `main` (a new squash commit), which goes through CI like everything else. Render's "Rollback" to an earlier deploy is the emergency lever, but it doesn't undo migrations: only use it when the bad deploy didn't change the schema, or the old code still works with the new schema.

## Database

- `sks-lotse-db`, PostgreSQL 18 (pinned via `postgresMajorVersion` in `render.yaml`), plan `basic-256mb`.
- **Backups**: paid Render Postgres has point-in-time recovery. The retention window depends on the Render workspace plan. Check it in the database's "Recovery" tab and note it here once confirmed.
- **Restore drill** (do it once, and after plan changes): in the Recovery tab, restore to a point in time into a *new* database, connect to it read-only, and check that `users`, `question_progress` and `exam_attempts` look plausible. Then delete it. A real restore means pointing the backend's `DATABASE_URL` at the restored database, or restoring over the original per Render's instructions. Plan for the gap between the restore point and now. The restored copy is a separate, ad hoc database, not the one declared in `render.yaml` — it isn't covered by `ipAllowList` below, so connect to it directly as before; if Render ever changes that, use the Render Shell approach instead (see External access).
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
| `JWT_SECRET` | backend **and** cron | Every session and every pending OTP code becomes invalid; everyone logs in again. Generate with `openssl rand -hex 32`, set it on both services in one go (the cron only needs it to pass config validation). |
| `RESEND_API_KEY` | backend **and** cron | Create the new key at Resend, set it on both services, check that a login code arrives, then revoke the old key. |
| `ANTHROPIC_GRADING_API_KEY` | backend | New key in the grading workspace of the Anthropic Console, set it, try one AI check, revoke the old one. While it's empty or invalid the check answers 503 and the budget is refunded. |
| `ADMIN_EMAILS`, `ALLOWED_EMAILS` | backend (`ADMIN_EMAILS` also on the cron) | Not secret, but kept out of the repo. `ADMIN_EMAILS` empty = no admins, and the cron has no recipients. |
| `BETTERSTACK_HEARTBEAT_URL` | cron | A new heartbeat in Better Stack; the old one then alerts until deleted. |
| `VITE_UMAMI_WEBSITE_ID`, `VITE_ADSENSE_CLIENT_ID` | frontend | Build-time values: changing them triggers a rebuild of the static site. |

## Data-subject requests (DSGVO)

Learners email the operator ([ADR-0019](adr/0019-admin-allowlist-and-manual-gdpr-fulfillment.md)). Every admin action is logged (`admin action`, ids only).

- **Auskunft / Datenübertragbarkeit (Art. 15/20)**: `/admin/users` → search the email → open the account → "Daten exportieren" downloads the JSON (profile, progress, Fokus marks, reports, exams). Send it to the verified address of the account only.
- **Berichtigung (Art. 16)**: learners edit name, gender, exam variant and email themselves on `/profile`; anything else by hand on request.
- **Löschung (Art. 17)**: learners can delete themselves on `/profile`. On request, `/admin/users` → open the account → "Account löschen" removes the account and everything attached to it (`services/user.py`).
- **Einschränkung / Widerspruch (Art. 18/21)**: handled case by case; there is no tooling.
- Answer within a month (Art. 12(3) DSGVO).

## AI-check abuse

- `/admin` shows each account's "Sanitizer-Flags" (`ai_flags_count`). Past `GRADING_SANITIZER_LOG_THRESHOLD`, every further check of that account is logged with question id and outcome, never the text ([ADR-0040](adr/0040-ai-grading-sanitizer-and-abuse-monitoring.md)).
- To stop an account: `/admin` → "KI-Prüfung entziehen", or set its weekly limit to 0 ("Limit speichern"). The app-wide default budget is on `/admin/settings` ([ADR-0036](adr/0036-weekly-ai-check-budget-with-admin-overrides.md)).
- Cost ceiling: the Anthropic workspace's own spend limit backs up the per-account budget.

## Daily KPI report

- The `sks-lotse-daily-report` cron runs daily at 06:00 UTC ([ADR-0032](adr/0032-daily-kpi-report.md)) and mails aggregates to `ADMIN_EMAILS`.
- Locally: `cd backend && python -m scripts.send_daily_report` (needs a `.env` with a database and `RESEND_API_KEY`).
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
