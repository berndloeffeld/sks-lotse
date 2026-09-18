"""Seed/rebuild the question catalog from its committed source files.

This is the single source of truth for turning `docs/Fragenkatalog-SKS.pdf`
plus the reviewed fixtures under `backend/scripts/data/` into `questions`
and `topics` rows. It's used by both:

- the manual CLI scripts (`backend/scripts/import_catalog.py`,
  `merge_seemannschaft.py`, `manage_topics.py`) — useful for iterating on
  the parser/taxonomy locally without a full migration cycle, and
- the Alembic data migration that seeds every environment automatically
  (including Render's `alembic upgrade head` before every deploy — see
  CLAUDE.md → Question Catalog). That's what actually populates
  production; nothing here ever calls an LLM — the *proposing* half of
  the pipeline (LLM classification, duplicate-similarity matching) stays
  CLI-only and produces the reviewed YAML files this module just applies.
"""

import re
from pathlib import Path

import pypdf
import yaml
from sqlalchemy.orm import Session

from app.models.question import Question
from app.models.topic import Topic

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
PDF_PATH = _BACKEND_DIR.parent / "docs" / "Fragenkatalog-SKS.pdf"
DATA_DIR = _BACKEND_DIR / "scripts" / "data"
TOPICS_PATH = DATA_DIR / "topics.yaml"
ASSIGNMENTS_DIR = DATA_DIR / "topic_assignments"
SEEMANNSCHAFT_DUPLICATES_PATH = DATA_DIR / "seemannschaft_duplicates.yaml"

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


def parse_catalog_pdf(pdf_path: Path = PDF_PATH) -> list[Question]:
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


def import_catalog(db: Session) -> int:
    """Replace the full contents of `questions` with a fresh PDF parse."""
    questions = parse_catalog_pdf()
    db.query(Question).delete()
    db.add_all(questions)
    db.commit()
    return len(questions)


def merge_seemannschaft(db: Session) -> dict[str, int]:
    """Collapse seemannschaft_1/seemannschaft_2 into the 3 merged subjects.

    Reads the human-reviewed duplicate-pair list committed at
    SEEMANNSCHAFT_DUPLICATES_PATH — never recomputes similarity itself.
    Must run after import_catalog().
    """
    pairs = yaml.safe_load(SEEMANNSCHAFT_DUPLICATES_PATH.read_text()) or []
    pair_map: dict[int, int] = {p["seemannschaft_1"]: p["seemannschaft_2"] for p in pairs}
    matched_motor_numbers = set(pair_map.values())

    segeln_rows = {q.number: q for q in db.query(Question).filter(Question.subject == "seemannschaft_1")}
    motor_rows = {q.number: q for q in db.query(Question).filter(Question.subject == "seemannschaft_2")}

    next_number = 1
    for num1, num2 in sorted(pair_map.items()):
        row1 = segeln_rows[num1]
        row2 = motor_rows[num2]
        row1.subject = "seemannschaft_allgemein"
        row1.number = next_number
        row1.seemannschaft_1_number = num1
        row1.seemannschaft_2_number = num2
        next_number += 1
        db.delete(row2)

    for num1, row in segeln_rows.items():
        if num1 in pair_map:
            continue
        row.subject = "seemannschaft_segeln"
        row.seemannschaft_1_number = num1
        row.seemannschaft_2_number = None

    for num2, row in motor_rows.items():
        if num2 in matched_motor_numbers:
            continue
        row.subject = "seemannschaft_motor"
        row.seemannschaft_1_number = None
        row.seemannschaft_2_number = num2

    db.commit()

    return {
        subject: db.query(Question).filter(Question.subject == subject).count()
        for subject in ("seemannschaft_allgemein", "seemannschaft_segeln", "seemannschaft_motor")
    }


def load_topics() -> dict[str, list[dict]]:
    return yaml.safe_load(TOPICS_PATH.read_text())


def apply_topics(db: Session) -> list[tuple[str, int]]:
    """Upsert Topic rows from TOPICS_PATH and set Question.topic_id from
    the reviewed per-subject files under ASSIGNMENTS_DIR. Never calls an
    LLM — both inputs are already committed, reviewed data. Must run
    after merge_seemannschaft() for seemannschaft_* subjects.

    Returns the (subject, number) pairs that got no assignment.
    """
    topics_by_subject = load_topics()

    topic_id_by_subject_slug: dict[tuple[str, str], int] = {}
    for subject, topics in topics_by_subject.items():
        for t in topics:
            topic = db.query(Topic).filter(Topic.subject == subject, Topic.slug == t["slug"]).one_or_none()
            if topic is None:
                topic = Topic(
                    subject=subject, slug=t["slug"], name=t["name"], display_order=t["display_order"]
                )
                db.add(topic)
            else:
                topic.name = t["name"]
                topic.display_order = t["display_order"]
            db.flush()
            topic_id_by_subject_slug[(subject, t["slug"])] = topic.id

    unassigned: list[tuple[str, int]] = []
    for subject in topics_by_subject:
        assignments_path = ASSIGNMENTS_DIR / f"{subject}.yaml"
        if not assignments_path.exists():
            continue
        assignments = yaml.safe_load(assignments_path.read_text()) or {}
        questions = {q.number: q for q in db.query(Question).filter(Question.subject == subject)}
        for number, slug in assignments.items():
            question = questions.get(number)
            if question is not None:
                question.topic_id = topic_id_by_subject_slug.get((subject, slug))
        for number in questions:
            if number not in assignments:
                unassigned.append((subject, number))

    db.commit()
    return unassigned


def seed_catalog(db: Session) -> None:
    """Run the full pipeline: import -> merge -> topic assignment."""
    import_catalog(db)
    merge_seemannschaft(db)
    apply_topics(db)
