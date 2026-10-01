# 56. Kartenaufgaben open to guests, run in the page from a committed export

Status: Accepted — amends [ADR-0052](0052-chart-exercises-from-reviewed-yaml.md) (at `on`, guests run the sheets without a login, the server's order applies to accounts only) and [ADR-0054](0054-learning-by-topic-open-without-login.md) (the Kartenaufgaben join "Lernen nach Thema" as open without a login).

## Context

"Lernen nach Thema" is open without a login since [ADR-0054](0054-learning-by-topic-open-without-login.md): guests read, answer and grade themselves, nothing is saved, the pages are prerendered for search engines. The Kartenaufgaben ([ADR-0052](0052-chart-exercises-from-reviewed-yaml.md), [ADR-0053](0053-chart-solutions-transcribed-as-text.md)) stayed behind the login and the `CHART_EXERCISES` flag, though they are just as much what people search for ("SKS Kartenaufgabe Lösung"), and the WSV material may be shown publicly since 2026-10-01. The operator asked what it would look like if they were open too. Options considered:

1. **A showcase**: the sheets' task texts open and prerendered, solutions, derivations and points only with an account. Little work, but a guest can't practise.
2. **A guest run like ADR-0054's**: the whole run (task, own answer, official solution, own points, next task) in the browser, nothing saved.
3. **Only one sheet as a trial**, the others behind the login.

And for when guests get them: opening them together with the flag's `on` (one decision for everyone), or a separate switch for guests.

## Decision

- **A guest run (option 2), following the flag.** Guests get the Kartenaufgaben only while the flag is `on`; at `admins` and `off` nothing changes for them. Opening them stays a reviewed PR that switches `render.yaml` and updates `docs/FEATURES.md` ([ADR-0052](0052-chart-exercises-from-reviewed-yaml.md)).
- **The build knows the flag**: `VITE_CHART_EXERCISES` (same values, unset = `off`, anything else fails the build), declared in `render.yaml` next to the API's `CHART_EXERCISES`. A backend test fails while the two differ. The API still decides for logged-in learners (`UserRead.can_use_chart_exercises`); the build only decides whether guests see the pages and whether they are prerendered.
- **Data from a committed export, no new open API route**, as for the catalog: `backend/scripts/export_chart_exercises.py` writes `frontend/src/data/chart_exercises.gen.json` from `chart_exercises.yaml`, solutions included; `backend/tests/test_chart_exercises_export.py` fails while it is stale. The client loads it as its own chunk, only on the `/charts` pages.
- **The run lives in the page** (`src/chartGuestRun.ts`): the API's rules ported (tasks strictly in order, a solution only once its task is answered, points from 0 to the task's), shaped like the API's run so the run's components are shared. Nothing is sent or saved, the run is gone with the page. The Formblatt Gezeiten stays scratch work in the browser as for learners, under the sheet's number, emptied when a guest starts a new run.
- **`/charts` and `/charts/<n>` are open and prerendered** (without the static ad script, like `/learn`), and listed in the sitemap; the run itself (`/charts/attempts/<id>`) stays a learner's. Below every sheet's page, **all its tasks with their official solutions, each folded shut**, for guests and learners alike, like the topic list of [ADR-0054](0054-learning-by-topic-open-without-login.md). A logged-in learner who opens such a page directly sees the guest's version until the session check returns, then their own.
- The landing page's Kartenaufgaben preview links to `/charts` while the flag is `on`.

## Consequences

- The Kartenaufgaben are indexable and usable without an account; the account is what keeps runs and points, and lets a run be interrupted.
- **For guests, the order is the browser's word, not the server's**: the solutions are in the export, as the catalog's answers are. That's fine for practice one sets oneself (nobody grades a guest), and a learner's run still gets its solutions from the API only once answered. Below the run the solutions are a click away anyway.
- One more generated file to commit after a change to `chart_exercises.yaml` (re-run the export, enforced by the test), and one more variable to keep in step in `render.yaml` (enforced by a test).
- Guests cause no API traffic for the Kartenaufgaben; the pages come from the static site.
- Each page needs its rewrite in `render.yaml` ([ADR-0057](0057-prerendered-pages-as-flat-files-with-a-rewrite-each.md)), in the PR that switches to `on`. Between the Blueprint sync and that deploy, `/charts` answers empty for a few minutes.
- Rejected: the showcase (a guest can't try what the feature is about); one sheet as a trial (an arbitrary line, and with two transcribed sheets half the content); a public API route for the sheets (an open route and a second data path for the build, as in [ADR-0054](0054-learning-by-topic-open-without-login.md)); keeping a guest's run in the browser (the same reason ADR-0054 gave for the gradings); a separate flag for guests (two switches for one decision).
