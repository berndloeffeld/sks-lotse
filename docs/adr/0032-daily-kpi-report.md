# 0032. Daily KPI report by email

Status: Accepted — addendum in [ADR-0041](0041-agb-acceptance-and-inactivity-retention.md): `last_login_at` now exists, but only for retention, not for this report

## Context

With real learners arriving, the operator needs a few numbers without opening the database: growth, activity, learning progress and problems. The app keeps no event log and no last-login timestamp, and Umami only sees anonymous page traffic. A report has to come out of the tables that already exist, and it must not become a second store of personal data.

## Decision

- `app/services/kpis.py` (`compute_kpis`) derives everything from existing tables with plain SQL aggregates: `users` (sign-ups, exam variant), `question_progress` (activity, "gelernt" streaks), `exam_attempts`, `focus_topics`, `question_reports`. The result is a Pydantic `KpiReport` and contains **only aggregates** — no email address, no per-learner row.
- **Activity is learning activity**: a learner counts as active on a day when a question was graded or an exam started (`question_progress.updated_at`, `exam_attempts.started_at`). Logging in without learning is invisible. DAU/WAU/MAU, stickiness (DAU/MAU) and a retention figure (accounts from 7–14 days ago that were active in the last 7 days) follow from that. A real `last_seen_at` would need a migration and a write per session; not worth it yet.
- **One report, two doors**: `GET /api/v1/admin/kpis` (admin allowlist, same guard as the other admin routes) returns it as JSON, and `backend/scripts/send_daily_report.py` renders it as German plain text and mails it via Resend to every address in `ADMIN_EMAILS`. It exits non-zero when there is no recipient or a send fails, so a broken run is visible in Render.
- **Scheduler**: a Render Cron Job (`sks-lotse-daily-report` in `render.yaml`, 06:00 UTC, `python -m scripts.send_daily_report`). CLAUDE.md's data-layer conventions say to add a real scheduler once the app has a reason for one; a report that must arrive daily is that reason — piggybacking on request traffic would make "daily" depend on someone using the app.
- Errors are not part of the report: unhandled exceptions are logged at ERROR by Uvicorn and alerted on in Better Stack.

## Consequences

- The cron service needs `DATABASE_URL`, `JWT_SECRET` (Settings validation), `RESEND_API_KEY` and `ADMIN_EMAILS`; the `sync: false` values are entered once in the Render dashboard, like the backend's. It bills as its own service (small monthly minimum).
- The numbers are approximations of "users": a learner who only reads and never grades is not counted as active, and re-grading a question moves its `updated_at`, so "ratings" count questions touched, not gradings.
- The report mail goes only to allowlisted operators and has no personal data, so it needs no extra mention beyond the existing Datenschutzerklärung; the Resend processor is already listed.
- OTP-request volume is not reported: `otp_codes` rows are deleted after expiry ([ADR-0010](0010-opportunistic-otp-code-cleanup.md)), so they say nothing about the day.
- Not covered yet: conversion and LLM cost (there is no payment), Umami visitors (open the dashboard).
- Addendum (2026-09-23, [ADR-0041](0041-agb-acceptance-and-inactivity-retention.md)): `users.last_login_at` now exists after all, added for AGB-driven inactivity retention, not for this report — the KPI figures above stay defined purely by learning activity.
