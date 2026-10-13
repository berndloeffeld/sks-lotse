# 0062. A table in a Kartenaufgabe's answer, stored as pipe rows in the plain text

Status: Accepted — amends [ADR-0052](0052-chart-exercises-from-reviewed-yaml.md) (what a task's `answer_text` holds) and [ADR-0058](0058-lotsen-check-for-chart-exercises.md) (the check reads those rows).

## Context

Many tasks of a Kartenaufgabe, the tide ones above all, are worked out as a table: the official derivation shows them that way ([ADR-0053](0053-chart-solutions-transcribed-as-text.md)), and so does the Formblatt Gezeiten. The answer field was a plain textarea, so a learner's table turned into text aligned by hand, hard to type on a phone and unreadable afterwards. The answer is stored in `chart_attempt_tasks.answer_text` (plain `Text`, at most 5,000 characters), included in the admin export and sent unchanged to the Lotsen-Check.

## Decision

- The answer field becomes a small **editor**, after Confluence's but much plainer: one frame with a tool bar on top ("Tabelle einfügen", then "Tabelle entfernen", which joins the text around it), the text, and the table inside the same frame, so the table is plainly part of the answer. A new table has 3 × 3 cells and a text field below it.
- Rows and columns are changed **at the table**: while the pointer is over it or the cursor in it, a grip above each column and beside each row opens that row's or column's menu (insert before or after, delete), "+" at the right and bottom edge appends one, and a cell's context menu (right click, or the context-menu key from the keyboard) has the entries for its row and its column. The grip's row or column is marked while its menu is open, and the entry pointed at marks what it would change: a line where the new one goes, red what would be deleted. At least one row and, besides the label column, one value column stay. Tab moves from cell to cell (the grips are out of the Tab order).
- **One table per answer**: a task asks for one calculation, and a second grid would make the form longer without a task that needs it.
- The **first column is always a header column** (grey, bold; `th scope="row"`), in the editor and the display alike: it holds the labels (HW Cuxhaven, Unterschied, …), as in the derivation's tables. It needs no mark in the stored text, so the format stays as below. A header row was considered and left out: the derivation's tables have none.
- The answer is still **one plain text**. A table is written one line per row, `| a | b | c |`, a `|` inside a cell escaped as `\|`; blocks are separated by a blank line, and empty rows and columns of the grid are dropped (`frontend/src/answerTable.ts`, `serializeAnswer`).
- Only for a Kartenaufgabe's answer, the display reads lines that start and end with `|` back as a table (`parseAnswer`, `ChartOwnAnswer`), with grid lines and the header column. Answers elsewhere (catalog, exam, admin) stay plain text.
- The Lotsen-Check gets the text as it is; its system prompt says that an answer can hold such rows.

## Consequences

- No API, schema or migration change: the stored answers, the export, the deletion and guests' runs (held in the page) are untouched, and an answer from before stays as it was.
- The rows are compact and an LLM reads them without help, but they count towards the Lotsen-Check's 1,000-character limit like any text.
- A line of text the learner types as `| … |` by hand shows as a table too. That is harmless, and the reason a table is recognised only when a line both starts and ends with `|` (`|BW|` inside a sentence stays text).
- An answer can't be changed once given, so the editor never has to read a stored answer back into the grid.
- Rejected: a rich-text editor library (Tiptap, Lexical: MIT, but their free table extensions bring the commands, not the grips and menus, so those would still be ours; their document would have to be converted to the rows, the editor is a contenteditable that jsdom tests poorly, and a dozen packages join the audited dependencies; CKEditor, TinyMCE and Handsontable also need a GPL or commercial license). a JSON structure in its own column (a migration, an API change and two ways of storing an answer, for what the plain rows already carry); Markdown with a rendering library (a new dependency and an HTML sanitizer for one feature, and Markdown tables need a header row the derivation's tables don't have).
