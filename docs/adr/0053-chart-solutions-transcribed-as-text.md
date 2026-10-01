# 53. Kartenaufgaben: official solutions transcribed as text, sheets added as they are reviewed

Status: Accepted — amends [ADR-0052](0052-chart-exercises-from-reviewed-yaml.md)

## Context

[ADR-0052](0052-chart-exercises-from-reviewed-yaml.md) showed each official solution as an image cut from the WSV PDF: exact, but small print on a phone, out of step with the app's typography (the catalog's official answers are plain text), unreadable for screen readers, and not usable by a later Lotsen-Check. Its derivations were the PDF's bare working — tide tables and course conversions without a word on why a value has its sign or which way the table is read, which is exactly where learners get stuck.

## Decision

- **Solutions and derivations are text in `chart_exercises.yaml`**, transcribed task by task and confirmed by the operator against the PDF.
  - A **solution** is one part per point bullet of the PDF, each a list of results with their tolerance kept apart (`text`, `tolerance`) — as the PDF states them, so a later automatic check can use the tolerance. Shown like the catalog's official answers: plain text, a bullet per part only when there is more than one.
  - The **derivation** is paragraphs and tables. A sum in a calculation table is ruled off above, as in the PDF (`sum`, or `sum_until` when the line covers only some columns); `**…**` marks what the PDF prints bold.
  - **Working lines move from the results to the derivation**: the solution holds only what scores.
- **The derivation explains, not only reproduces.** Where the PDF's working leaves the step unsaid (why BW is negative, that a course conversion is read from KaK up to MgK, how the current triangle is constructed, how a fix follows from two bearings), the derivation says it, written for the learner and reviewed like the rest. It isn't marked as an addition: the solution's results stay the official ones, the derivation is the app's explanation of them.
- **Drawings stay images**: the current triangle (Stromdreieck) is the one scoring part that is a drawing; its part carries the official drawing cut from the PDF next to its label.
- **Only transcribed sheets are in the app.** Sheets 1 and 2 are done; 3–10 were removed together with their images and come back one by one as they are transcribed (the extraction script still proposes their task text; their solution images are in git history at commit `dc22c0b`). A run already open on a removed sheet answers 404 until the sheet returns.

## Consequences

- Solutions read like the rest of the app, scale on a phone, reach screen readers, and are input a Lotsen-Check for Kartenaufgaben can use.
- Transcription is slow (one task at a time, each confirmed) and a typo is possible where an image could not have one — the review against the PDF is what guards it, and the tests only check structure (every task has a solution, sheets numbered without gaps, every referenced image exists).
- `scripts/extract_chart_exercises.py --force` would now overwrite the transcribed solutions with images; it stays as the source for the next sheets' task text, its output merged by hand rather than taken over.
- Rejected: keeping the images and adding text alongside (two sources of truth for every result); OCR of the solution images (the tables' structure and the sum lines are what matters, and OCR loses both); marking our explanations as "Ergänzung SKS Lotse" (tried, and it made the derivations noisier without helping the learner).
