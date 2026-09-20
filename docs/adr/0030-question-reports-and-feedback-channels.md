# 0030. Question reports and lightweight feedback channels

Status: Accepted

## Context

There was no way for learners to tell us anything from inside the app: the only contact was the address in Impressum/Datenschutz, and analytics (Umami, [ADR-0016](0016-umami-cloud-analytics-without-consent-banner.md)) recorded page views only. The most valuable feedback for this product is about the catalog itself — the PDF import has known limits (missing chart images, wrapped lines, the Seemannschaft merge) that learners notice long before we do — and about where learners drop out of the funnel. Learners are individuals with an exam date; feedback has to take seconds or none arrives.

## Decision

Three channels, ordered by effort:

1. **Feedback mail link** ("Feedback" in the footer and the account nav): a plain `mailto:` to the contact address (`frontend/src/contact.ts`). No backend, no new data.
2. **"Frage melden"**: a collapsed-by-default form under the official answer in `PracticePage` and `ExamGrading`. `POST /api/v1/questions/{id}/report` stores a `question_reports` row (`user_id`, `question_id`, `category`, optional `comment` ≤ 1000 chars, `created_at`), both FKs `ON DELETE CASCADE`, an index on `question_id`. `category` is one of a fixed set (`question_text`, `answer_text`, `typo`, `missing_image`, `other`), validated in Pydantic rather than typed as an enum (same reason as `GradingOutcomeField`). Abuse is bounded by a per-user cap (`check_and_record`, `QUESTION_REPORT_MAX_PER_WINDOW`, default 20/hour) on top of the blanket per-IP one. The operator reads them via `GET /api/v1/admin/question-reports` (admin only, newest first, with the reporter's email so they can reply) — no admin UI for now.
3. **Custom Umami events** for the core funnel (`login`, `question_graded`, `question_learned`, `focus_set`, `exam_started`, `exam_submitted`, `exam_completed`, `question_reported`) via `trackEvent` in `frontend/src/analytics.ts`. Properties are coarse fixed keys (`outcome`, `category`, `result`) — never free text, ids or answers.

## Consequences

- Reports are personal data (account link + free text): deleted with the account (`delete_user_and_progress`), included in the admin DSGVO export, and named in the Datenschutzerklärung. Legal basis: Art. 6(1)(f) DSGVO (interest in correcting the catalog), disclosed there.
- The catalog is upserted by `(subject, number)` ([ADR-0022](0022-catalog-sync-by-upsert.md)), so a report keeps pointing at the right question across re-syncs; if a question vanishes its reports go with it via the FK cascade.
- Events stay cookieless and unlinked to a person, so ADR-0016's "no consent banner" reasoning holds. They count against the Hobby plan's 100k events/month — fine at the current scale; revisit if traffic grows.
- Rejected for now: a general feedback form/NPS widget (the mail link covers it until it demonstrably doesn't), an admin UI for reports (an endpoint plus SQL is enough at this volume), and third-party survey tools (extra processor to disclose).
