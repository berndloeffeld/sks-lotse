# 0071. SBF Navigationsaufgaben with an account: saved runs and a Lotsen-Check with SKS Lotse's own tolerances

Status: Accepted — amends [ADR-0058](0058-lotsen-check-for-chart-exercises.md) (a third kind of check: follow-on errors count, right or wrong instead of points), [ADR-0065](0065-own-derivations-for-catalog-questions.md) (a deliberate exception: own tolerances go to this check, marked as not official) and [ADR-0068](0068-sbf-navigation-tasks-from-reviewed-yaml.md) (runs saved with an account, beside the guest's run in the page)

## Context

The 15 Navigationsaufgaben See run in the page for guests, and nothing is stored ([ADR-0068](0068-sbf-navigation-tasks-from-reviewed-yaml.md)). With accounts on sbf-lotse.de ([ADR-0070](0070-sbf-api-host-and-site-per-request.md)), a learner should keep a run (resume it on another device, see the result later) and get a suggested grade per subtask, as SKS Lotse's Kartenaufgaben have ([ADR-0058](0058-lotsen-check-for-chart-exercises.md)).

What differs from the Kartenaufgaben:
- **One point per subtask**, right or wrong (SpFV Anlage 3 Nr. 1.1), not up to three points per task.
- **Follow-on errors count as correct** in the SBF exam. The SKS chart check names them but gives no points.
- **No official derivation.** The YAML has the result of each subtask and, beside it, SKS Lotse's own tolerance (`own_tolerance`, e.g. ±1° for a course). That tolerance is marked "nicht amtlich, übliche Prüfungspraxis" on the page ([ADR-0068](0068-sbf-navigation-tasks-from-reviewed-yaml.md)). Without it, "rwK = 079°" leaves the model only the exact value, which no examiner applies to a value taken from a chart.
- **Some results are entries in the chart** ("Siehe Karte"), which the model can't see.

[ADR-0065](0065-own-derivations-for-catalog-questions.md) keeps SKS Lotse's own content away from the Lotsen-Check, so the model judges by the official text only.

## Decision

**Saved runs in tables of their own**, `sbf_navigation_attempts` and `sbf_navigation_attempt_subtasks`, not in `chart_attempts` with a column for the collection:
- **The SKS side stays unchanged.** None of SKS Lotse's queries on the Kartenaufgaben (overview, KPIs, admin export, the one-open-run index) has to tell the two collections apart.
- **The same rules as a Kartenaufgabe run:**
  - one open run per task;
  - the subtasks strictly in order, each answered once;
  - then the learner's point, 0 or 1; the last point completes the run.
- **Only the learner's own data is stored:** answers, points and the check's suggestion. The task's content stays in the committed YAML; the page reads it from the export.
- **Routes under `/api/v1/sbf-navigation`:**
  - They need a session and are only for SBF Lotse: a request the backend doesn't resolve to SBF Lotse (by `Origin`, else by the API host) gets 403.
  - Personal data like the Kartenaufgaben runs: deleted with the account, in the admin export, in the Datenschutzerklärung.
- **The frontend** keeps the guest's run in the page. Once signed in (with `VITE_SBF_ACCOUNTS=on`), the same view runs on the server's state. The task cards show the open run or the latest result; the profile has a tab "Läufe".

**The Lotsen-Check per subtask**, `POST /sbf-navigation/attempts/{id}/subtasks/{n}/ai-check`:
- Model, budget and refusals as the Kartenaufgaben's check (`anthropic_chart_grading_model`, adaptive thinking at effort `medium`, 45 s). 2 tokens (`TOKENS_PER_SBF_NAVIGATION_CHECK`, also in `GET /pricing`).
- Through `lotse_check.run_paid_check`: a cap of one per subtask, the shared hourly cap, the tokens refunded when the check fails, `lotse_check_log.kind = "sbf_navigation"`.
- **The prompt** (approved by the project owner on 2026-10-24):
  - In the system prompt: the rules (one point; the official result is the measure; a value within SKS Lotse's tolerance counts as correct; follow-on errors count as correct, SpFV Anlage 3 Nr. 1.1) and the typical SBF mistakes (Abl/Mw sign, the Mw not carried forward to the task's year, time from distance and speed, Koppelort and Besteckversetzung).
  - In a cached block: the chart, the allowed aids and the scoring, from the YAML.
  - Per check: the situation and the task's footnotes, the earlier subtasks of this run (text, official result, the learner's answer, chart entries left out), this subtask with its official result, and `own_tolerance` as `[Bewertungshilfe: … — nicht amtlich, übliche Prüfungspraxis]`.
  - Nothing about the account. Learner text escaped and declared not to be instructions ([ADR-0040](0040-ai-grading-sanitizer-and-abuse-monitoring.md)).
- **The reply:** `feedback`, `suspected_error`, `correct`.
  - It is stored with the subtask (`ai_correct`, `ai_feedback`, `ai_suspected_error`); a second check of the same answer is refused (409).
  - The suggestion preselects the point; giving it stays the learner's step. The sanitizer backstop applies as for the Kartenaufgaben.
- **Not for a chart entry** (`ai_checkable` false when the result is "Siehe Karte").
- **A guest** sees the check as a teaser, as in "Lernen nach Thema" ([ADR-0054](0054-learning-by-topic-open-without-login.md)).

**The exception to ADR-0065 is this one, and only this one.** SKS Lotse's own tolerance goes to the SBF check, always marked as not official and as a grading aid. SKS Lotse's own derivations for catalog questions still never go to any check.

## Consequences

- A learner on sbf-lotse.de keeps their runs and gets a suggestion that applies the SBF exam's rules: a follow-on error is right, a value within the usual tolerance is right.
- **The suggestion can rest on SKS Lotse's tolerance**, not only on the official text. The feedback says so ("innerhalb der üblichen Toleranz"), and the page shows the tolerance as not official. The learner still decides.
- **The model doesn't see the chart.** Values only the chart gives (the Mw, positions, distances) it knows only from the official results, so a suspected error stays a guess there; the prompt tells it to say so rather than invent a cause.
- A third kind of check in the KPIs and on the admin dashboard (`lotse_checks_sbf_navigation`). An answered subtask of a saved run counts as learning activity, like an answered Kartenaufgabe task.
- **The "Lotsen-Check" rule in CLAUDE.md** now names what this check sends.
- **Rejected:**
  - `chart_attempts` with a collection column: every SKS query on it would need a filter, and the rules differ (points, follow-on errors).
  - **The official result only, without the tolerance:** "079°" against "078°" would be wrong, which no examiner marks so.
  - **Checking numbers against the tolerance in code:** the answers are free text with several values, descriptions and units, and it gives no reason for a mistake.
  - **Haiku at 1 token:** the check recomputes chains of corrections like the Kartenaufgaben's, where the stronger model paid off ([ADR-0058](0058-lotsen-check-for-chart-exercises.md)).
