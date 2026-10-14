# 0063. Kartenaufgaben: the official task and solution shown as cuts of the PDF beside the Formblatt

Status: Accepted — amends [ADR-0053](0053-chart-solutions-transcribed-as-text.md).

## Context

A learner fills in the Formblatt Gezeiten in the side panel while the task is in the main column; on a long task the data to enter is scrolled out of sight, and on a phone the task is behind the sheet that holds the form. The learner wants the task as the examiner prints it (the exact wording, the point bullets) and, once answered, the official solution, within reach of the form. Until [ADR-0053](0053-chart-solutions-transcribed-as-text.md) the PDF's solutions were images; the tasks never were ([ADR-0052](0052-chart-exercises-from-reviewed-yaml.md) extracts them as text, which stays: it reads well on a phone, it is what screen readers get and what the Lotsen-Check is sent).

## Decision

- Every task also carries **`task_images`**, the task as the PDF prints it from its header down to "Lösung:", and **`solution_images`**, the official solution from "Lösung:" to the next task, cut into PNGs (one per page they span) by `backend/scripts/extract_chart_exercises.py --task-images` into `frontend/public/charts/bogen-NN/aufgabe-NN-aufgabe-K.png` and `aufgabe-NN-loesung-K.png`. The mode writes only the images and these two fields of the tasks already in the reviewed YAML, so it can't touch the transcribed solutions.
- `solution_images` is **withheld like `solution`** until the task is answered, in the API and in the guests' run alike, so it can't be read ahead. The task's images are no secret: they are in the API's answer from the start.
- Both are shown in a third card, **"Offizieller Originaltext"**, between the Formblatt Gezeiten and the Verlauf (on a phone a third button in the bar), **folded by default** (the Formblatt is what the learner works in; the card's state is remembered like the others): the current task's cut and, once it is answered, its solution below it; the last task's once the run is complete. The source is named below.
- A tap opens a picture at full resolution **on the same page**, over it: a click beside the picture, the cross or Escape closes it (`ImageLightbox`). It replaces the link to a new tab, also for the drawn current triangle in the solution. It is not a `Modal`: it is opened from the phone's tool sheet, which is one, and Escape must close only the picture (a capturing listener on `window` swallows the key before the sheet's).
- **Cheap to load**: only the current task's cut and its solution's are requested, and only while the card (on a phone: the sheet) is open; `loading="lazy"`, `decoding="async"` and the stored width and height keep the page from jumping. A cut is 2 to 45 KB; the 216 images of the six sheets are about 3 MB in all, served by the static site like the other chart images.

## Consequences

- The wording is shown twice, as text in the main column and as the original beside the form, and the solution twice too (transcribed, and as the PDF prints it). ADR-0053 rejected keeping both for the solution (two sources of truth); here the image is only the learner's reference copy and nothing reads it. The text stays what the app works with (the Lotsen-Check, the derivation, the search-engine copy), and a typo in a transcription is easier to spot next to the print.
- A new field with a default of `[]` is backward compatible for one deploy. The Lotsen-Check, the answers and the points are unchanged.
- A new sheet comes with its images: `--task-images` after its task text is merged into the YAML; `test_every_task_has_its_official_text_as_an_image` fails until every task has both kinds.
- Alt text is only "Aufgabe N im Original" and "Lösung zu Aufgabe N im Original": a screen reader gets the content from the text beside it.
- Rejected: replacing the text in the main column with the image (small print on a phone, nothing for screen readers or the check); the text in the side panel instead of the image (the learner asked for the original print, and the text is already there).
