"""Extract the 15 Navigationsaufgaben of the SBF See catalog from its PDF.

Usage (reads the PDF directly, no DB needed; needs PyMuPDF from requirements-dev.txt):

    PYTHONPATH=. .venv/bin/python scripts/extract_sbf_navigation.py [--force]
    PYTHONPATH=. .venv/bin/python scripts/extract_sbf_navigation.py --task-images
    PYTHONPATH=. .venv/bin/python scripts/extract_sbf_navigation.py --refresh
    # review app/data/sbf_navigation.yaml by hand against the PDF, task by task

A one-off (the catalog of 2023 doesn't change), so no pipeline: this proposes
app/data/sbf_navigation.yaml, which the export reads (ADR-0068).

What becomes what:
- The notice page: the sentence on the Übungskarte D49, the 8 chart sections with their two corner
  coordinates, and the pool of the 15 questions (286-300) the tasks draw their 9 from.
- Per task: the situation (one paragraph per blank line) and the table "Nummer | Aufgabenstellung |
  Ergebnis" as 9 subtasks, plus the footnotes below it. A line break inside a cell stays where the
  next word would still have fitted on the line (a list, e.g. two bearings), and is joined otherwise.
- `--task-images` cuts each subtask as the PDF prints it, its table row and, apart, its result (shown
  only once answered, as the Kartenaufgaben of SKS Lotse do, ADR-0063), into
  frontend/src/sbf/navigation/originals/aufgabe-NN-M-aufgabe.png and -ergebnis.png, and sets
  `original` of every subtask in the reviewed YAML, leaving the rest of it untouched. Not under
  public-sbf/: the build ships those files whatever VITE_SBF says, while these come only with the
  Navigationsaufgaben (ADR-0068).
- `--refresh` extracts the official text again (after a change to TEXT_FIXES or TYPO_FIXES) into the
  reviewed YAML, keeping what the review added: `own_tolerance`, `aids`, `original`.
- Not from the PDF: `own_tolerance` (SKS Lotse's own, not official, set in the review) and `aids`
  (SpFV Anlage 3 Nr. 1.3, transcribed from the regulation).
- The one exception to the official wording: the obvious typos in TYPO_FIXES, each with the official
  text, recorded in the YAML's `typo_fixes` (ADR-0068). tests/test_sbf_navigation.py extracts the PDF
  again and fails on any other difference between it and the reviewed YAML.

Refuses to overwrite a reviewed file unless --force.
"""

import argparse
import re
from pathlib import Path
from typing import Any

import pymupdf
import yaml

REPO = Path(__file__).resolve().parent.parent.parent
PDF_PATH = REPO / "docs" / "Fragenkatalog-SBF-See-2023.pdf"
DATA_PATH = REPO / "backend" / "app" / "data" / "sbf_navigation.yaml"
IMAGES_DIR = REPO / "frontend" / "src" / "sbf" / "navigation" / "originals"

TITLE_RE = re.compile(r"^Navigationsaufgabe (\d+)$")
SECTION_RE = re.compile(r"^(\d)\. (N.+?); (N.+)$")
POOL_RE = re.compile(r"^(\d{3})\. (.+)$")
FOOTER_RE = re.compile(r"^(Stand: |© )")
# Layout slips of the PDF, fixed on the extracted text (the wording stays the official one).
TEXT_FIXES: dict[str, str] = {
    # Task 14.1: a soft hyphen ends the line, so the PDF prints "weiß-rot-" / "grün" (the sector colours).
    "weiß-rot\u00ad grün": "weiß-rot-grün",
    # Task 5.1: the bearings stand on lines of their own, as in every other task; the line before
    # happens to end where the first one would no longer have fitted.
    "zu entnehmen. Wasserturm Langeoog MgP": "zu entnehmen.\nWasserturm Langeoog MgP",
    # Task 7.1: an ordinary wrap, which the cell's padding makes look like a kept break.
    "Position des\nMotorbootes um 11:00 Uhr.": "Position des Motorbootes um 11:00 Uhr.",
    # Task 14.2: one colour per line; the label is lower case, so the reflow took it for a wrap.
    '"flaches Wasser" hellgrün: "Watt"': '"flaches Wasser"\nhellgrün: "Watt"',
}
# Obvious typos in the official text, corrected by decision of the operator (ADR-0068; the only change
# to the official wording anywhere in SKS Lotse): (task, subtask, field) → (official, corrected), the
# official text occurring exactly once in that field. Keep them few and obvious.
TYPO_FIXES: dict[tuple[int, int, str], tuple[str, str]] = {
    (1, 1, "result"): ("rwk = 079°", "rwK = 079°"),
    (1, 6, "text"): ("mit den Hand-Peilkompass", "mit dem Hand-Peilkompass"),
    (2, 8, "text"): ("mit den Hand-Peilkompass", "mit dem Hand-Peilkompass"),
    (4, 6, "result"): ("53° 48,2'N", "53° 48,2' N"),
    (4, 8, "result"): ("Tonne rwp = 035°", "Tonne rwP = 035°"),
    (7, 9, "result"): ("273° -1,1 sm", "273° - 1,1 sm"),
    (12, 8, "result"): ("296° -0,7 sm", "296° - 0,7 sm"),
    (15, 9, "text"): ("008° 23,2 E", "008° 23,2' E"),
}
# A gap between two lines wider than this many line heights starts a new paragraph.
PARAGRAPH_GAP = 1.6


def _lines(page: pymupdf.Page, clip: pymupdf.Rect) -> list[dict[str, Any]]:
    """The text lines inside `clip`, top to bottom: their box, words and text."""
    grouped: dict[tuple[int, int], list[tuple[float, float, float, float, str]]] = {}
    for x0, y0, x1, y1, word, block, line, _ in page.get_text("words", clip=clip):
        grouped.setdefault((block, line), []).append((x0, y0, x1, y1, word))
    lines = []
    for words in grouped.values():
        words.sort()
        lines.append(
            {
                "x0": words[0][0],
                "x1": words[-1][2],
                "y0": min(w[1] for w in words),
                "y1": max(w[3] for w in words),
                "first_width": words[0][2] - words[0][0],
                "text": " ".join(w[4] for w in words),
            }
        )
    return sorted(lines, key=lambda line: (round(line["y0"]), line["x0"]))


# A line that starts a new item of a list, even where the PDF would have had to wrap anyway:
# a label ("Kennung: ...") or the same first word as the line before ("Leuchttonne ..." twice).
LABEL_RE = re.compile(r"^[A-ZÄÖÜ][\wäöüß/-]*: ")


def _new_item(previous: dict[str, Any], line: dict[str, Any]) -> bool:
    return bool(LABEL_RE.match(line["text"])) or line["text"].split()[0] == previous["text"].split()[0]


def _reflow(lines: list[dict[str, Any]], right: float) -> str:
    """Join lines the PDF wrapped, keep the breaks it didn't need (a list, a new item)."""
    text = ""
    for i, line in enumerate(lines):
        if i:
            previous = lines[i - 1]
            space = 3.0
            wrapped = previous["x1"] + space + line["first_width"] > right - 2
            if not wrapped or _new_item(previous, line):
                text += "\n"
            elif not text.endswith("-"):
                text += " "
        text += line["text"]
    return _fix(text)


def _paragraphs(lines: list[dict[str, Any]]) -> list[str]:
    """Prose, split into paragraphs at the wider vertical gaps; lines within one joined."""
    paragraphs: list[list[dict[str, Any]]] = []
    for line in lines:
        height = line["y1"] - line["y0"]
        if paragraphs and line["y0"] - paragraphs[-1][-1]["y1"] < PARAGRAPH_GAP * height:
            paragraphs[-1].append(line)
        else:
            paragraphs.append([line])
    return [_fix(_join(group)) for group in paragraphs]


def _join(lines: list[dict[str, Any]]) -> str:
    text = ""
    for line in lines:
        text += ("" if not text or text.endswith("-") else " ") + line["text"]
    return text


def _fix(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text).strip()
    for wrong, right in TEXT_FIXES.items():
        text = text.replace(wrong, right)
    return text


def _notice(doc: pymupdf.Document) -> dict[str, Any]:
    """The notice page before the tasks: the chart, its 8 sections and the question pool."""
    page = next(i for i, p in enumerate(doc) if "Kartenausschnitte" in p.get_text())
    lines = [
        line["text"]
        for p in (doc[page], doc[page + 1])
        for line in _lines(p, p.rect)
        if not FOOTER_RE.match(line["text"])
    ]
    start = next(i for i, text in enumerate(lines) if text.startswith("Den Navigationsaufgaben"))
    chart, sections, pool_note, pool = [], [], "", []
    for text in lines[start:]:
        if TITLE_RE.match(text):
            break
        if section := SECTION_RE.match(text):
            sections.append({"number": int(section[1]), "corners": [section[2], section[3]]})
        elif item := POOL_RE.match(text):
            pool.append({"number": int(item[1]), "text": item[2]})
        elif text.startswith("Aus den nachfolgenden"):
            pool_note = text
        elif pool:
            pool[-1]["text"] += ("" if pool[-1]["text"].endswith("-") else " ") + text
        else:
            chart.append(text)
    # Two sentences: the chart the tasks are based on, then the one that introduces the sections.
    notice = _fix(" ".join(chart))
    chart_notice, _, sections_notice = notice.partition(". ")
    return {
        "chart_notice": f"{chart_notice}.",
        "sections_notice": sections_notice,
        "chart_sections": sections,
        "pool_notice": _fix(pool_note),
        "pool": [{"number": item["number"], "text": _fix(item["text"])} for item in pool],
    }


def _task(doc: pymupdf.Document, index: int, number: int) -> dict[str, Any]:
    page = doc[index]
    heading = f"Navigationsaufgabe {number}"
    title = next(line for line in _lines(page, page.rect) if line["text"] == heading and line["x0"] < 50)
    table = next(t for t in page.find_tables().tables if t.extract()[0][:1] == ["Nummer"])
    situation = _lines(page, pymupdf.Rect(page.rect.x0, title["y1"] + 1, page.rect.x1, table.bbox[1] - 1))
    subtasks = []
    for row in table.rows[1:]:
        cells = [pymupdf.Rect(cell) if cell else None for cell in row.cells]
        if not cells[0] or not page.get_textbox(cells[0]).strip():
            continue
        task_cell, result_cell = cells[1], cells[2]
        subtasks.append(
            {
                "number": int(page.get_textbox(cells[0]).strip().rstrip(".")),
                "text": _reflow(_lines(page, task_cell), task_cell.x1),
                "result": _reflow(_lines(page, result_cell), result_cell.x1),
                # SKS Lotse's own tolerance, not official: set in the review (ADR-0068).
                "own_tolerance": None,
            }
        )
    below = _lines(page, pymupdf.Rect(page.rect.x0, table.bbox[3] + 1, page.rect.x1, page.rect.y1))
    footnotes = _paragraphs([line for line in below if not FOOTER_RE.match(line["text"])])
    return {
        "number": number,
        "situation": _paragraphs(situation),
        "subtasks": subtasks,
        "footnotes": footnotes,
    }


def _apply_typo_fixes(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Correct the TYPO_FIXES in place; returns them as the YAML's record of what was changed."""
    records = []
    for (task, subtask, field), (official, corrected) in TYPO_FIXES.items():
        target = tasks[task - 1]["subtasks"][subtask - 1]
        if target[field].count(official) != 1:
            raise SystemExit(f"typo fix {task}.{subtask} {field}: {official!r} not found exactly once")
        target[field] = target[field].replace(official, corrected)
        records.append(
            {"task": task, "subtask": subtask, "field": field, "official": official, "corrected": corrected}
        )
    return records


def extract(doc: pymupdf.Document, *, fix_typos: bool = True) -> dict[str, Any]:
    """Everything the PDF gives, with the typo fixes applied; own tolerances and aids left empty."""
    tasks = []
    for index, page in enumerate(doc):
        lines = [line["text"] for line in _lines(page, page.rect)]
        # The task's title stands alone at the left margin; the breadcrumb names it too.
        numbers = {int(m[1]) for text in lines if (m := TITLE_RE.match(text))}
        if numbers and any(t.extract()[0][:1] == ["Nummer"] for t in page.find_tables().tables):
            tasks.append(_task(doc, index, numbers.pop()))
    typo_fixes = _apply_typo_fixes(tasks) if fix_typos else []
    return {
        "source": "Wasserstraßen- und Schifffahrtsverwaltung des Bundes (WSV), Fragenkatalog See, "
        "Stand: 01. August 2023, www.elwis.de",
        **_notice(doc),
        # SpFV Anlage 3 Nr. 1.3, transcribed from the regulation in the review.
        "aids": [],
        # Not from the PDF: SpFV Anlage 3 Nr. 1.1 and the ELWIS Bewertungsschlüssel (Stand 31.10.2022).
        "pass_points": 7,
        "scoring": [
            "1 Punkt je richtiger Antwort; Folgefehler gelten als richtig (SpFV Anlage 3 Nr. 1.1).",
            "Bestanden ab 7 von 9 Punkten (ELWIS, Bewertungsschlüssel, Stand 31.10.2022).",
        ],
        "typo_fixes": typo_fixes,
        "tasks": tasks,
    }


class _Dumper(yaml.SafeDumper):
    """Kept breaks inside a cell show as a block, so the review reads them as the PDF prints them."""


def _literal(dumper: yaml.SafeDumper, text: str) -> yaml.ScalarNode:
    style = "|" if "\n" in text else None
    return dumper.represent_scalar("tag:yaml.org,2002:str", text, style=style)


_Dumper.add_representer(str, _literal)


def _stack(doc: pymupdf.Document, index: int, parts: list[pymupdf.Rect], name: str) -> dict[str, Any]:
    """Render the page's `parts`, one below the other, into IMAGES_DIR/name."""
    sheet = pymupdf.open()
    width, height = max(part.width for part in parts), sum(part.height for part in parts)
    target = sheet.new_page(width=width, height=height)
    top = 0.0
    for part in parts:
        target.show_pdf_page(pymupdf.Rect(0, top, part.width, top + part.height), doc, index, clip=part)
        top += part.height
    pix = target.get_pixmap(matrix=pymupdf.Matrix(2, 2), colorspace=pymupdf.csGRAY)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    pix.save(IMAGES_DIR / name)
    return {"src": name, "width": pix.width, "height": pix.height}


def _cell(row: Any, column: int) -> pymupdf.Rect:
    return pymupdf.Rect(row.cells[column])


def _grow(rect: pymupdf.Rect) -> pymupdf.Rect:
    return pymupdf.Rect(rect.x0 - 1, rect.y0 - 1, rect.x1 + 1, rect.y1 + 1)


def _cut_originals(doc: pymupdf.Document, index: int, number: int) -> dict[int, dict[str, Any]]:
    """Per subtask, as the table prints it: its row under the header "Nummer | Aufgabenstellung", and
    its result under the header "Ergebnis" (with the footnotes, where the result refers to them)."""
    page = doc[index]
    table = next(t for t in page.find_tables().tables if t.extract()[0][:1] == ["Nummer"])
    header = table.rows[0]
    footer_lines = [
        line
        for line in _lines(page, pymupdf.Rect(page.rect.x0, table.bbox[3] + 1, page.rect.x1, page.rect.y1))
        if not FOOTER_RE.match(line["text"])
    ]
    bottom = max((line["y1"] for line in footer_lines), default=None)
    footnotes = pymupdf.Rect(table.bbox[0], table.bbox[3], table.bbox[2], bottom + 4) if bottom else None
    cuts = {}
    for row in table.rows[1:]:
        if row.cells[0] is None or not page.get_textbox(_cell(row, 0)).strip():
            continue
        subtask = int(page.get_textbox(_cell(row, 0)).strip().rstrip("."))
        question = [_cell(header, 0) | _cell(header, 1), _cell(row, 0) | _cell(row, 1)]
        result = [_cell(header, 2), _cell(row, 2)]
        if footnotes and "*)" in page.get_textbox(_cell(row, 2)):
            result.append(footnotes)
        stem = f"aufgabe-{number:02d}-{subtask}"
        # A point of margin around each part, so the cells' borders stay whole.
        cuts[subtask] = {
            "question": _stack(doc, index, [_grow(rect) for rect in question], f"{stem}-aufgabe.png"),
            "result": _stack(doc, index, [_grow(rect) for rect in result], f"{stem}-ergebnis.png"),
        }
    return cuts


def _add_task_images(doc: pymupdf.Document) -> None:
    data = yaml.safe_load(DATA_PATH.read_text(encoding="utf-8"))
    pages = {}
    for index, page in enumerate(doc):
        numbers = {int(m[1]) for line in _lines(page, page.rect) if (m := TITLE_RE.match(line["text"]))}
        if numbers and any(t.extract()[0][:1] == ["Nummer"] for t in page.find_tables().tables):
            pages[numbers.pop()] = index
    for old in IMAGES_DIR.glob("*.png"):
        old.unlink()
    for task in data["tasks"]:
        cuts = _cut_originals(doc, pages[task["number"]], task["number"])
        for subtask in task["subtasks"]:
            subtask["original"] = cuts[subtask["number"]]
    _write(data)
    print(f"cut the originals of {len(data['tasks'])} tasks into {IMAGES_DIR} and set them in {DATA_PATH}")


def _refresh(doc: pymupdf.Document) -> None:
    reviewed = yaml.safe_load(DATA_PATH.read_text(encoding="utf-8"))
    data = extract(doc)
    data["aids"] = reviewed["aids"]
    for task, old_task in zip(data["tasks"], reviewed["tasks"], strict=True):
        for subtask, old_subtask in zip(task["subtasks"], old_task["subtasks"], strict=True):
            subtask["own_tolerance"] = old_subtask["own_tolerance"]
            subtask["original"] = old_subtask.get("original")
    _write(data)
    print(f"refreshed the official text in {DATA_PATH}, kept the review's own tolerances, aids and originals")


def _write(data: dict[str, Any]) -> None:
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(
        yaml.dump(data, Dumper=_Dumper, allow_unicode=True, sort_keys=False, width=110), encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--force", action="store_true", help="overwrite a reviewed YAML")
    parser.add_argument("--task-images", action="store_true", help="only cut the tasks as printed")
    parser.add_argument("--refresh", action="store_true", help="re-extract the text, keep the review")
    args = parser.parse_args()
    if args.task_images:
        _add_task_images(pymupdf.open(PDF_PATH))
        return
    if args.refresh:
        _refresh(pymupdf.open(PDF_PATH))
        return
    if DATA_PATH.exists() and not args.force:
        raise SystemExit(f"{DATA_PATH} exists (reviewed?) — pass --force to overwrite")

    data = extract(pymupdf.open(PDF_PATH))
    _write(data)
    print(f"wrote {DATA_PATH} ({len(data['tasks'])} tasks); review each task by hand against the PDF")


if __name__ == "__main__":
    main()
