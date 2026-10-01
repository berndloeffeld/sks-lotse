# 52. Kartenaufgaben: ten fixed exercises from a reviewed YAML, solutions as images, behind a flag

Status: Accepted

## Context

The written SKS exam has two parts: the Fragebogen, which the exam simulation covers ([ADR-0029](0029-exam-simulation.md)), and the **Kartenaufgabe** — 90 minutes, 30 points, worked in the paper practice chart "Übungskarte 49 (INT 1463)" with Karte 1/INT 1, the Begleitheft (Ausgabe 2013) and plotting tools. The WSV publishes ten solved Kartenaufgaben as a PDF (`docs/Navigationsaufgaben-SKS.pdf`, 81 pages): per sheet 16–18 tasks with their points (•/••/•••), the official solution with tolerances ("[± 1°]", "[Keine Toleranz]") and exactly one drawn current triangle (Stromdreieck); plus a blank "Formblatt Gezeiten" (a scan, the same form on every sheet).

What makes this different from the question catalog:

- The learner can't do the work in the browser: courses, bearings and positions are plotted in the paper chart they bring themselves. The app can only present the tasks in order and show what the right result was.
- The official solutions are laid out as calculation tables (MgK → Abl → mwK → Mw → rwK → BW → KdW → BS → KüG, sums marked by underlines) and a drawing. Text extraction scrambles the tables and loses the drawing.
- The content is ten fixed sheets that will not change. The catalog's machinery (data migrations, upsert sync, topic classification, [ADR-0022](0022-catalog-sync-by-upsert.md)) exists because the catalog is large and its rows carry learner progress by id.
- The ELWIS confirmation that the catalog is an amtliches Werk covers the question catalog; for this PDF it hasn't been asked yet.

## Decision

- **Content is a reviewed YAML read at runtime, not database rows.** A one-off script (`backend/scripts/extract_chart_exercises.py`, PyMuPDF) proposes `backend/app/data/chart_exercises.yaml` and the images; a human reviews both against the PDF and commits them. The backend loads the YAML once per process (`app/services/chart_exercises.py`); changes ship with a deploy. Learner runs refer to it by natural keys (`exercise_number`, `task_number`).
- **Task text as text, official solutions as images.** The scenario and the questions (with their points) are extracted as text — readable on a phone, and the input a later AI check will need. Layout slips are fixed on the extracted text, never the wording (`TEXT_FIXES`). Each official solution is rendered as an image of its region of the PDF page (split at page breaks), which keeps the tables, the tolerances and the drawn current triangle exactly as published. The region is cut in two above the text block holding its first point bullet: what's above is the **derivation** (tide tables, the stream diamond read off, …) and is shown only on request; from there on are the **results** that score, shown as the solution. A bullet on the last row of a calculation table keeps the whole table with the results.
- **The Formblatt Gezeiten is fillable**: its fields re-built as a form, laid out like the printed one, stored per run in the learner's browser only (`localStorage`) — scratch work like the paper chart, not progress, so it doesn't go to the server. The blank scan stays available for printing.
- **The learner self-assesses with points.** Tasks are worked strictly in order: answer (free text, may be empty), then the solution is revealed, then the learner gives themselves 0 up to the task's points, then the next task. The server enforces the order and withholds a task's solution until it is answered. The current triangle is drawn on paper and compared with the solution image. The runs don't feed the Lernstand — they are not catalog questions.
- **Two tables for the runs**: `chart_attempts` (one open run per learner and exercise, enforced by a partial unique index like the exam's) and `chart_attempt_tasks` (answer, time, points). Deleted with the account, included in the admin export, described in the Datenschutzerklärung.
- **Behind a feature flag** `CHART_EXERCISES` (`off` | `admins` | `on`, like `STRIPE_CHECKOUT`, [ADR-0048](0048-stripe-hosted-checkout-with-webhook-fulfilment.md)). For a learner it doesn't cover the routes answer 404 and the UI hides the feature (`UserRead.can_use_chart_exercises`). Production runs `admins` (declared in `render.yaml`) until the usage rights of the PDF are confirmed.
- **Before the start**, the page states that chart, Karte 1, Begleitheft and tools are the learner's own, not part of SKS Lotse, and asks them to confirm they have them ready. During a run the Formblatt, the tasks so far (with the learner's answers and the solutions) and the sheet's rules stay one tap away: beside the task on a wide screen as cards that fold open and shut (which are open is remembered in the browser), behind a bar at the bottom on a phone.

## Consequences

- No data migration, no sync, no cache invalidation for the content — and no admin editing either: a correction is a commit. At ten sheets that's the right trade ("avoid pipeline overkill" in `CLAUDE.md`).
- Solutions as images are exact but not machine-readable: no automatic comparison with the learner's answer, no search, and screen readers get only an alt text. The later Lotsen-Check for Kartenaufgaben will need the solution as text; the tolerances in it would then also allow an automatic check of numeric results. Deliberately left for then.
- About 5 MB of PNGs in `frontend/public/charts/`, served by the static site like the catalog images ([ADR-0033](0033-catalog-images-as-static-files.md)).
- Rejected: seeding the tasks as rows through data migrations (the catalog's way) — machinery without benefit for fixed content; transcribing the solution tables by hand — slow and error-prone, and it would still lose the drawing; drawing the current triangle in the browser — much work, poor on a phone, and the exam is on paper anyway; self-assessment as Richtig/Teilweise/Falsch — the Kartenaufgabe is scored in points per task, so points are what the learner should practise giving.
- Not part of the exam simulation yet. [ADR-0029](0029-exam-simulation.md) anticipated a second part with its own 90 minutes and 30 points; the runs here are untimed.
