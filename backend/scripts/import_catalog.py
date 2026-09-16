"""One-off import of the official SKS question catalog PDF into the questions table.

Usage:
    PYTHONPATH=. .venv/bin/python scripts/import_catalog.py

Re-running is safe: it replaces the full contents of the questions table.

Known limitation: a handful of questions that ask two things in one
sentence without numbering them ("Was ist X? Wovon hängt sie ab?") get
split at the first "?", so the second part ends up prefixed onto the
answer. Numbered multi-part questions ("1. ...? 2. ...?") are handled
correctly. Chart/diagram images referenced by ~6 questions are not
extracted — image_ref is left null for all rows.
"""

import re
from pathlib import Path

import pypdf

from app.core.database import SessionLocal
from app.models.question import Question

PDF_PATH = Path(__file__).resolve().parent.parent.parent / "docs" / "Fragenkatalog-SKS.pdf"

SUBJECTS = [
    ("navigation", "Navigation"),
    ("schifffahrtsrecht", "Schifffahrtsrecht"),
    ("wetterkunde", "Wetterkunde"),
    ("seemannschaft_1", "Seemannschaft I"),
    ("seemannschaft_2", "Seemannschaft II"),
]

BREADCRUMB_RE = re.compile(r"Sie sind hier:")
NUMMER_RE = re.compile(r"Nummer\s+(\d+):\s*\n")
WHITESPACE_RE = re.compile(r"[ \t]+")
BLANK_LINES_RE = re.compile(r"\n\s*\n+")


def clean(s: str) -> str:
    s = WHITESPACE_RE.sub(" ", s)
    s = BLANK_LINES_RE.sub("\n", s)
    return s.strip()


def split_question_answer(body: str) -> tuple[str, str]:
    body = body.strip()

    expected = 1
    idx = 0
    while True:
        m = re.match(rf"{expected}\.\s.*?\?\s*(?:\([^)]*\)\s*)?", body[idx:], re.S)
        if not m:
            break
        idx += m.end()
        expected += 1

    if expected > 2:  # matched at least items 1 and 2 -> numbered multi-part question
        return clean(body[:idx]), clean(body[idx:])

    # Un-numbered question, possibly split over several "...?" sentences
    # (e.g. "Was ist X? Wovon hängt sie ab?"). Keep consuming leading
    # sentences that end in "?" with no "." before that "?" — a "." shows
    # up before the next "?" once the declarative answer text starts.
    idx = 0
    while True:
        m = re.match(r"[^.?]*\?\s*", body[idx:], re.S)
        if not m:
            break
        idx += m.end()

    if idx > 0:
        return clean(body[:idx]), clean(body[idx:])
    return clean(body), ""


def extract_sections(text: str) -> list[tuple[str, str]]:
    starts = [m.start() for m in BREADCRUMB_RE.finditer(text)][1:]  # skip title-page breadcrumb
    starts.append(len(text))
    if len(starts) - 1 != len(SUBJECTS):
        raise ValueError(f"expected {len(SUBJECTS)} sections, found {len(starts) - 1}")
    return [(SUBJECTS[i][0], text[starts[i] : starts[i + 1]]) for i in range(len(SUBJECTS))]


def parse_questions(pdf_path: Path) -> list[Question]:
    reader = pypdf.PdfReader(str(pdf_path))
    text = "\n".join(page.extract_text() for page in reader.pages)

    questions = []
    for subject, section_text in extract_sections(text):
        parts = NUMMER_RE.split(section_text)[1:]  # alternating: number, body, number, body, ...
        for i in range(0, len(parts), 2):
            number = int(parts[i])
            question_text, answer_text = split_question_answer(parts[i + 1])
            questions.append(
                Question(
                    subject=subject,
                    number=number,
                    question_text=question_text,
                    answer_text=answer_text,
                    image_ref=None,
                )
            )
    return questions


def main():
    questions = parse_questions(PDF_PATH)
    print(f"Parsed {len(questions)} questions from {PDF_PATH.name}")

    db = SessionLocal()
    try:
        db.query(Question).delete()
        db.add_all(questions)
        db.commit()
    finally:
        db.close()

    print("Import complete.")


if __name__ == "__main__":
    main()
