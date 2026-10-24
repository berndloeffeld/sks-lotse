# 0068. SBF Navigationsaufgaben from a reviewed YAML, open to guests, own tolerances marked as not official

Status: Accepted

## Context

The first content of SBF Lotse ([ADR-0067](0067-second-site-from-one-codebase.md)) is the 15 official Navigationsaufgaben of the SBF See catalog (Fragenkatalog See, Stand 1 August 2023, ELWIS). Each task has a situation and a table of 9 subtasks, "Nummer | Aufgabenstellung | Ergebnis", plus footnotes here and there. The grading follows two sources: SpFV Anlage 3 Nr. 1.1 gives 1 point per correct answer and counts a follow-on error as correct, and the ELWIS Bewertungsschlüssel (Stand 31 October 2022) passes the Navigationsaufgabe from 7 of 9 points.

The catalog gives results without tolerances, and the Übungskarte D49 they are worked on is not part of it. The SKS Kartenaufgaben solved the same kind of problem, an official PDF turned into a run a guest can work through:
- a reviewed YAML ([ADR-0052](0052-chart-exercises-from-reviewed-yaml.md));
- an export for guests ([ADR-0056](0056-chart-exercises-open-to-guests.md));
- the original beside the run ([ADR-0063](0063-chart-task-original-beside-the-form.md)).

The SKS catalog derivations showed how to add own content beside official content ([ADR-0065](0065-own-derivations-for-catalog-questions.md)).

SBF Lotse has no accounts yet, and its build makes no API call. The usage rights for the SBF catalog and the chart are being asked for, so the content must stay unpublished until confirmed.

## Decision

- **Content in a reviewed YAML, not in a database.**
  - `backend/scripts/extract_sbf_navigation.py` proposes `backend/app/data/sbf_navigation.yaml` from `docs/Fragenkatalog-SBF-See-2023.pdf` (PyMuPDF: the table as cells, line breaks kept only where the PDF did not need them).
  - The operator reviewed every task against the PDF, one at a time.
  - `backend/app/services/sbf_navigation.py` validates the file (`app/schemas/sbf_navigation.py`). `scripts/export_sbf_navigation.py` writes `frontend/src/data/sbf_navigation.gen.json`, and a test fails while it is stale.
  - There is no API route and no table.
- **The official wording, with one documented exception.**
  - `TEXT_FIXES` only repair layout slips of the extraction: a soft hyphen at a line end, list lines the reflow joined.
  - Obvious typos are corrected by the operator's decision. That is 8 so far: "rwk" for "rwK", "mit den" for "mit dem", missing spaces and a missing minute sign. Each sits in `TYPO_FIXES` with its official text, is recorded in the YAML's `typo_fixes`, and is named on the page ("Tippfehler im amtlichen Text korrigiert, dort steht …").
  - `tests/test_sbf_navigation.py` extracts the PDF again and fails on any other difference. It also fails when a fix's official text is not in the PDF exactly once.
- **Own tolerances, not official.** Each subtask has an `own_tolerance` beside its official `result`. Following the usual exam practice, the values are:
  - courses and bearings ±1°, distances ±0,1 sm, positions ±0,2′;
  - times ±1 min, or ±2 min where the result itself says "gegen";
  - speeds ±0,2 kn;
  - a Besteckversetzung ±10° in direction and ±0,2 sm in size;
  - none for chart work and descriptions.

  The page shows them below the official result, apart and labelled "nicht amtlich, übliche Prüfungspraxis". In this increment they are only shown. They don't grade, since the learner grades themselves.
- **Open to guests, in the page only**, as the SKS Kartenaufgaben are for guests:
  - the subtasks strictly in order, the result only once answered, then 0 or 1 point by the learner's own choice with the follow-on rule stated;
  - an evaluation by the Bewertungsschlüssel at the end;
  - nothing saved, and the run asks before it is left.

  The run's rules live in `src/sbf/navigationRun.ts` and `src/runVerdict.ts`, the threshold in the data (`pass_points: 7`). The SKS run components are not reused: they carry the Lotsen-Check and its API client, which the SBF build must not contain. Their look and keyboard handling are taken over:
  - Enter shows the result, Shift+Enter is a line break, Tab goes on to the button.
  - The points are tiles 0/1 that Tab cycles and Enter gives.
- **The original beside the run**, as in [ADR-0063](0063-chart-task-original-beside-the-form.md):
  - Per subtask, the script cuts its table row and, apart, its result (with the footnotes where it refers to them).
  - The side panel ("Offizieller Originaltext", folded by default, and "Verlauf") shows the current subtask's row, and its result once answered.
  - On a phone, a bar at the bottom opens them as a sheet.
- **The hints**: the chart in the catalog's one sentence (Übungskarte D49), the aids in the words of SpFV Anlage 3 Nr. 1.3, the grading with its sources. The 8 chart sections stay in the YAML but are not shown, since the catalog doesn't say which task uses which.
- **Behind VITE_SBF, absent from an "off" build.**
  - The data chunk's import sits behind the build's literal flag, so the bundler drops it.
  - The originals live in `frontend/src/sbf/navigation/originals/`, not in `public-sbf/`, and a Vite plugin emits them only at `on`.
  - The `/navigation` pages are prerendered and rewritten only at `on`.
  - `scripts/check-sbf-build.mjs` checks both builds in CI, and a backend test ties the rewrites to the flag.

## Consequences

- Turning the tasks on is one PR: `VITE_SBF: "on"` in `render.yaml` with its rewrites, and `docs/FEATURES.md`. It waits for the usage rights of the catalog and the Übungskarte D49.
- A new catalog edition shows up as a failing wording test. The tasks are then reviewed again, typo fixes included.
- The tolerances are ours, and a learner may read them as official. They are set apart and labelled at every place they appear, and the FAQ explains where they come from.
- 270 small PNG cuts (about 1.6 MB) ship with an `on` build, loaded one at a time beside the run.
- Accounts (increment 2) can store a run the way SKS Lotse stores Kartenaufgaben runs. The guest run's rules are already shaped so the API could enforce the same ones.
- Rejected:
  - Reusing the SKS Kartenaufgaben's run components. They would bring the API client into the SBF bundle, so we would have had to split them first, a refactor of SKS Lotse for no gain to it.
  - Tolerances as part of the result text. That would mix own and official text, the thing [ADR-0065](0065-own-derivations-for-catalog-questions.md) keeps apart.
  - Correcting typos silently. A difference from the original beside the run would then go unexplained.

## Update 2026-10-24: turned on

ELWIS confirmed the usage rights for the SBF catalog See and its Navigationsaufgaben. The confirmation covers the cuts of the PDF shown beside the run and the marked typo corrections (`TYPO_FIXES`). `render.yaml` sets `VITE_SBF: "on"` with the 16 `/navigation` rewrites. SKS Lotse now links SBF Lotse: in the footer, where both sites link each other, and on "So läuft die SKS-Prüfung ab", where the SBF See is the prerequisite.

