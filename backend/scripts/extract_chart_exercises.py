"""Extract the ten SKS chart exercises (Kartenaufgaben) from the navigation PDF.

Usage (reads the PDF directly, no DB needed; needs PyMuPDF from requirements-dev.txt):

    PYTHONPATH=. .venv/bin/python scripts/extract_chart_exercises.py [--force]
    # review app/data/chart_exercises.yaml by hand against the PDF

A one-off (the source PDF doesn't change), so no pipeline: this proposes
app/data/chart_exercises.yaml and renders the images to
frontend/public/charts/, both committed. The app reads the YAML at runtime
(app/services/chart_exercises.py, ADR-0052).

What becomes what:
- The task text (scenario in black, questions in blue with their point
  bullets) is extracted as text: the learner reads it on a phone, and the
  later AI check needs it. PDF line wraps are joined; the Greek phi/lambda
  the PDF draws from a private-use font are mapped back.
- The official solution is rendered as images of its region in the PDF
  (from below "Lösung:" to the next task, split at page breaks). Its tables
  (MgK -> Abl -> ... -> KüG, underlines marking additions) and the drawn
  current triangle don't survive text extraction, and an image keeps the
  official wording and layout exactly. The region is cut in two at its first
  point bullet: above it the derivation (tide tables, stream diamond, ...),
  from it on the results that score — the solution proper.
- The "Formblatt Gezeiten" is the same scanned form in every sheet; the
  last sheet's copy is rendered once.

Refuses to overwrite a reviewed file unless --force.
"""

import argparse
import re
from pathlib import Path

import pymupdf
import yaml

REPO = Path(__file__).resolve().parent.parent.parent
PDF_PATH = REPO / "docs" / "Navigationsaufgaben-SKS.pdf"
DATA_PATH = REPO / "backend" / "app" / "data" / "chart_exercises.yaml"
IMAGES_DIR = REPO / "frontend" / "public" / "charts"

SHEET_RE = re.compile(r"Lösungsbogen\s+(\d+)")
HEADER_RE = re.compile(r"^Aufgabe\s+(\d+)\s*$")
BLUE = 0x0084B6
# The PDF draws phi/lambda from "Universal-GreekwithMathPi" at private-use code points.
GREEK = {"": "φ", "": "λ"}
# Layout slips of the PDF, fixed on the extracted text (the wording stays the official one).
TEXT_FIXES = {
    # The last list item's line break lands before "Erdboden" instead of after "über dem".
    "Höhe des Feuerträgers über dem\n\u2013 Erdboden.": "Höhe des Feuerträgers über dem Erdboden.",
    # A charted depth 34,4 m is printed "34" with a subscript "4"; the PDF flattens it to "344".
    "Rechteck mit der Zahl 344,": "Rechteck mit der Zahl 34₄,",
}
FORM_CLIP = pymupdf.Rect(36, 22, 550, 582)
ZOOM = 2.0  # 144 dpi: sharp on high-density screens at ~520 CSS px
CONTENT_X = (40.0, 560.0)
FOOTER_Y = 800.0  # below: the page number (the grey bottom bar is skipped as a bar)
MARGIN = 4.0


def _span_text(span: dict) -> str:
    text = span["text"]
    for private, greek in GREEK.items():
        text = text.replace(private, greek)
    return text


def _words_text(spans: list[dict]) -> str:
    """Join spans; the small b/k after an "O" (O_b, O_k) is a subscript, written as RichText expects."""
    text = ""
    for span in spans:
        piece = _span_text(span)
        if span["size"] < 9 and piece.strip() in {"b", "k"} and text.endswith("O"):
            piece = "_" + piece.strip()
        text += piece
    return text


def _lines(page: pymupdf.Page) -> list[dict]:
    """The page's text lines, top to bottom, with a bullet count and a colour."""
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            spans = [s for s in line["spans"] if s["text"].strip()]
            if not spans:
                continue
            marks = [s for s in spans if not s["text"].replace("•", "").strip()]
            bullets = sum(s["text"].count("•") for s in marks)
            words = [s for s in spans if s not in marks]
            text = re.sub(r"\s+", " ", _words_text(words).replace("\t", " ")).strip()
            text = re.sub(r"\|\s*(\w+)\s*\|", r"|\1|", text)  # "| BW |" -> "|BW|"
            y0 = min(s["bbox"][1] for s in spans)
            y1 = max(s["bbox"][3] for s in spans)
            # The 16pt bullet glyph reaches into the row above; the text's own top is where the row starts.
            text_y0 = min((s["bbox"][1] for s in words), default=y0)
            blue = any(s["color"] == BLUE for s in words)
            out.append(
                {
                    "y0": y0,
                    "text_y0": text_y0,
                    "y1": y1,
                    "x0": min(s["bbox"][0] for s in spans),
                    "text": text,
                    "bullets": bullets,
                    "blue": blue,
                }
            )
    out.sort(key=lambda line: (round(line["y0"]), line["x0"]))
    return _merge_same_row(out)


def _merge_same_row(lines: list[dict]) -> list[dict]:
    """A bullet and its text are separate PDF lines on the same baseline: merge them."""
    merged: list[dict] = []
    for line in lines:
        prev = merged[-1] if merged else None
        if prev and abs(line["y1"] - prev["y1"]) < 5 and not HEADER_RE.match(prev["text"]):
            prev["text"] = f"{prev['text']} {line['text']}".strip()
            prev["bullets"] += line["bullets"]
            prev["blue"] = prev["blue"] or line["blue"]
            prev["y0"] = min(prev["y0"], line["y0"])
            prev["text_y0"] = min(prev["text_y0"], line["text_y0"])
            prev["y1"] = max(prev["y1"], line["y1"])
        else:
            merged.append(dict(line))
    return merged


def _join(parts: list[str]) -> str:
    """Join wrapped lines: a trailing hyphen before a lowercase word is a word break."""
    text = ""
    for raw in parts:
        part = raw.replace("\u00ad ", "")
        if text.endswith("\u00ad"):  # a soft hyphen: the word goes on
            text = text[:-1] + part
        elif part.startswith(("\u2013 ", "- ")) and text:  # a list item keeps its own line
            text = f"{text}\n{part}"
        elif text.endswith("-") and part[:1].islower():
            text = text[:-1] + part
        elif text:
            text = f"{text} {part}"
        else:
            text = part
    for wrong, right in TEXT_FIXES.items():
        text = text.replace(wrong, right)
    return text


def _content_bottom(page: pymupdf.Page, top: float, limit: float) -> float:
    """Lowest text or drawing between top and limit (ignoring full-width grey bars)."""
    bottom = top
    for line in _lines(page):
        # Lines sit edge to edge: the first solution line starts where "Lösung:" ends.
        if line["y1"] > top + 1 and line["y1"] <= limit:
            bottom = max(bottom, line["y1"])
    for drawing in page.get_drawings():
        rect = drawing["rect"]
        if (
            rect.y1 > top + 1
            and rect.y0 >= top - MARGIN
            and rect.y1 <= limit
            and not (rect.width > 400 and rect.height < 25)
        ):
            bottom = max(bottom, rect.y1)
    return bottom


class Sheet:
    def __init__(self, number: int) -> None:
        self.number = number
        self.tasks: list[dict] = []

    def task(self, number: int, points: int) -> dict:
        task = {
            "number": number,
            "points": points,
            "text": [],
            "questions": [],
            "solution_regions": [],
            # (page, top, bottom, bullets) of every solution line, to find where the results start.
            "solution_lines": [],
        }
        self.tasks.append(task)
        return task


def _add_task_line(task: dict, line: dict) -> None:
    """A task line is a question (blue, with its point bullets), a question's wrapped line, or scenario."""
    if line["bullets"]:
        task["questions"].append({"points": line["bullets"], "lines": [line["text"]]})
    elif line["blue"] and task["questions"]:
        task["questions"][-1]["lines"].append(line["text"])
    else:
        task["text"].append(line["text"])


def _add_line(task: dict, line: dict, page_no: int, in_solution: bool) -> None:
    """A task line goes into the task; a solution line is only noted, for where its results start."""
    if not in_solution:
        _add_task_line(task, line)
    else:
        task["solution_lines"].append((page_no, line["text_y0"], line["y1"], line["bullets"]))


def _parse_sheet(doc: pymupdf.Document, number: int, pages: list[int]) -> Sheet:
    sheet = Sheet(number)
    task: dict | None = None
    in_solution = False
    for page_no in pages:
        page = doc[page_no]
        lines = [line for line in _lines(page) if line["y1"] < FOOTER_Y]
        solution_top = 30.0 if in_solution else None
        for line in lines:
            header = HEADER_RE.match(line["text"])
            if header or line["text"] == "Notizen":
                if in_solution and task is not None and solution_top is not None:
                    task["solution_regions"].append((page_no, solution_top, line["y0"] - MARGIN))
                if not header:  # the sheet's blank "Notizen" section ends its last task
                    in_solution, solution_top = False, None
                    break
                task = sheet.task(int(header.group(1)), line["bullets"])
                in_solution, solution_top = False, None
                continue
            if task is None:
                continue
            if line["text"].startswith("Lösung:"):
                in_solution, solution_top = True, line["y1"] + MARGIN / 2
                continue
            _add_line(task, line, page_no, in_solution)
        if in_solution and task is not None and solution_top is not None:
            task["solution_regions"].append((page_no, solution_top, FOOTER_Y))
    return sheet


def _results_start(lines: list[tuple[int, float, float, int]]) -> tuple[int, float] | None:
    """Where the results start: the top of the text block holding the solution's first bullet.

    A bullet can sit on the last row of a calculation table (rwP = ...); then the whole table is the
    result, so the cut goes above the block — at the blank line before it, not through the table.
    """
    first = next((i for i, line in enumerate(lines) if line[3]), None)
    if first is None:
        return None
    while first > 0 and lines[first - 1][0] == lines[first][0] and lines[first - 1][2] >= lines[first][1] - 3:
        first -= 1
    page_no, top, _, _ = lines[first]
    return page_no, top - 1


def _split_regions(task: dict) -> list[tuple[str, int, float, float]]:
    """The solution regions as ("herleitung" | "loesung", page, top, limit), cut at the first bullet."""
    start = _results_start(task["solution_lines"])
    if start is None:  # no bullet: all of it is the solution
        return [("loesung", *region) for region in task["solution_regions"]]
    split_page, split_y = start
    parts = []
    for page_no, top, limit in task["solution_regions"]:
        if page_no < split_page or (page_no == split_page and limit <= split_y):
            parts.append(("herleitung", page_no, top, limit))
        elif page_no > split_page or top >= split_y:
            parts.append(("loesung", page_no, top, limit))
        else:
            parts += [("herleitung", page_no, top, split_y), ("loesung", page_no, split_y, limit)]
    return parts


def _render_region(doc: pymupdf.Document, page_no: int, top: float, limit: float, path: Path) -> dict | None:
    """Render one solution region; None when it holds nothing (a solution that ended on the page before)."""
    page = doc[page_no]
    content = _content_bottom(page, top, limit)
    if content - top < MARGIN:
        return None
    # The grey bars are 12pt-wide strokes: their top edge is half a stroke above the path.
    bars = [d["rect"].y0 - (d.get("width") or 0) / 2 for d in page.get_drawings() if d["rect"].width > 400]
    bottom = min([content + MARGIN, *(y for y in bars if y > content - MARGIN)])  # never into a bar
    clip = pymupdf.Rect(CONTENT_X[0], top, CONTENT_X[1], bottom)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), clip=clip)
    pix.save(path)
    return {"src": f"{path.parent.name}/{path.name}", "width": pix.width, "height": pix.height}


def _sheet_pages(doc: pymupdf.Document) -> dict[int, list[int]]:
    """Sheet number -> its task pages (after the cover sheet, before Notizen/Formblatt)."""
    sheets: dict[int, list[int]] = {}
    current = None
    for i, page in enumerate(doc):
        text = page.get_text()
        match = SHEET_RE.search(text)
        if match:
            current = int(match.group(1))
            sheets[current] = []
        elif current is not None and "FORMBLATT GEZEITEN" not in text and "Aufgabe" in text:
            sheets[current].append(i)
    return sheets


def _hints(doc: pymupdf.Document) -> list[str]:
    """The cover page's rules (Erlaubte Hilfsmittel, Hinweise), identical in every sheet."""
    first = next(i for i, page in enumerate(doc) if SHEET_RE.search(page.get_text()))
    paragraphs: list[list[str]] = []
    started = False
    for line in _lines(doc[first]):
        if line["text"].startswith("Erlaubte Hilfsmittel"):
            started = True
        if not started:
            continue
        if line["text"].endswith(":") or line["text"].startswith("Gesetzliche Zeit"):
            paragraphs.append([line["text"]])
        elif paragraphs:
            paragraphs[-1].append(line["text"])
    return [_join(p) for p in paragraphs]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--force", action="store_true", help="overwrite a reviewed YAML")
    args = parser.parse_args()
    if DATA_PATH.exists() and not args.force:
        raise SystemExit(f"{DATA_PATH} exists (reviewed?) — pass --force to overwrite")

    doc = pymupdf.open(PDF_PATH)
    sheets = []
    for number, pages in _sheet_pages(doc).items():
        sheet = _parse_sheet(doc, number, pages)
        out_dir = IMAGES_DIR / f"bogen-{number:02d}"
        out_dir.mkdir(parents=True, exist_ok=True)
        tasks = []
        for task in sheet.tasks:
            images: dict[str, list[dict]] = {"herleitung": [], "loesung": []}
            for part, page_no, top, limit in _split_regions(task):
                path = out_dir / f"aufgabe-{task['number']:02d}-{part}-{len(images[part]) + 1}.png"
                image = _render_region(doc, page_no, top, limit, path)
                if image:
                    images[part].append(image)
            tasks.append(
                {
                    "number": task["number"],
                    "points": task["points"],
                    "text": _join(task["text"]),
                    "questions": [
                        {"points": q["points"], "text": _join(q["lines"])} for q in task["questions"]
                    ],
                    "derivation_images": images["herleitung"],
                    "solution_images": images["loesung"],
                }
            )
        sheets.append({"number": number, "tasks": tasks})

    form_page = max(i for i, page in enumerate(doc) if "FORMBLATT GEZEITEN" in page.get_text())
    # Only the form's frame (the scan's page is otherwise blank but for the page number), grey like the scan.
    pix = doc[form_page].get_pixmap(dpi=200, clip=FORM_CLIP, colorspace=pymupdf.csGRAY)
    form_path = IMAGES_DIR / "formblatt-gezeiten.png"
    pix.save(form_path)

    data = {
        "source": "Wasserstraßen- und Schifffahrtsverwaltung des Bundes (WSV), Navigationsaufgaben SKS",
        "hints": _hints(doc),
        "tide_form": {"src": form_path.name, "width": pix.width, "height": pix.height},
        "sheets": sheets,
    }
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(
        yaml.safe_dump(data, allow_unicode=True, sort_keys=False, width=110), encoding="utf-8"
    )
    print(f"wrote {DATA_PATH} ({len(sheets)} sheets) and images under {IMAGES_DIR}")


if __name__ == "__main__":
    main()
