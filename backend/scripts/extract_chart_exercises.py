"""Extract the ten SKS chart exercises (Kartenaufgaben) from the navigation PDF.

Usage (reads the PDF directly, no DB needed; needs PyMuPDF from requirements-dev.txt):

    PYTHONPATH=. .venv/bin/python scripts/extract_chart_exercises.py [--force]
    # review app/data/chart_exercises.yaml by hand against the PDF

A one-off (the source PDF doesn't change), so no pipeline: this proposes
app/data/chart_exercises.yaml (and renders the blank form to
frontend/public/charts/). The app reads the YAML at runtime
(app/services/chart_exercises.py, ADR-0052, amended by ADR-0053).

What becomes what:
- The task text (scenario in black, questions in blue with their point
  bullets) is extracted as text: the learner reads it on a phone, and the
  later AI check needs it. PDF line wraps are joined; the Greek phi/lambda
  the PDF draws from a private-use font are mapped back.
- The official solution is NOT extracted: since ADR-0053 it is text, transcribed
  and confirmed by hand against the PDF, so each task is proposed with empty
  `derivation` and `solution` lists. The one image left is the drawn current
  triangle (Stromdreieck) of a task: cut it from the PDF by hand into
  frontend/public/charts/bogen-NN/aufgabe-NN-stromdreieck.png and reference it
  from its solution part (`image: {src, width, height}`).
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
FOOTER_Y = 800.0  # below: the page number


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


def _parse_sheet(doc: pymupdf.Document, number: int, pages: list[int]) -> Sheet:
    """A sheet's tasks; the lines from "Lösung:" to the next task header are the solution, not extracted."""
    sheet = Sheet(number)
    task: dict | None = None
    in_solution = False
    for page_no in pages:
        for line in (line for line in _lines(doc[page_no]) if line["y1"] < FOOTER_Y):
            header = HEADER_RE.match(line["text"])
            if header or line["text"] == "Notizen":
                if not header:  # the sheet's blank "Notizen" section ends its last task
                    in_solution = False
                    break
                task = sheet.task(int(header.group(1)), line["bullets"])
                in_solution = False
            elif task is None:
                continue
            elif line["text"].startswith("Lösung:"):
                in_solution = True
            elif not in_solution:
                _add_task_line(task, line)
    return sheet


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
        tasks = [
            {
                "number": task["number"],
                "points": task["points"],
                "text": _join(task["text"]),
                "questions": [{"points": q["points"], "text": _join(q["lines"])} for q in task["questions"]],
                # To be transcribed by hand against the PDF (ADR-0053).
                "derivation": [],
                "solution": [],
            }
            for task in sheet.tasks
        ]
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
    print(f"wrote {DATA_PATH} ({len(sheets)} sheets) and {form_path}; transcribe each solution by hand")


if __name__ == "__main__":
    main()
