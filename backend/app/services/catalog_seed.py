"""Seed/sync the question catalog from its committed source files.

This is the single source of truth for turning `docs/Fragenkatalog-SKS.pdf`
plus the reviewed fixtures under `backend/scripts/data/` into `questions`
and `topics` rows. It runs in two halves:

- `build_catalog()` computes the complete target state in memory — parse
  the PDF, collapse Seemannschaft I/II via the reviewed duplicate list,
  attach each question's reviewed topic slug. Pure, no DB, no LLM.
- `sync_catalog()` makes the DB match that state by upsert: rows are keyed
  on (subject, number) / (subject, slug), so an unchanged question keeps
  its id — and with it every learner's `question_progress` row. Only a
  question that really disappeared from the catalog gets deleted (and its
  progress with it, via the FK cascade). See ADR-0022.

The Alembic data migrations call both (`sync_catalog(op.get_bind(),
build_catalog())`), which seeds every environment automatically, including
Render's `alembic upgrade head` before every deploy (docs/catalog-pipeline.md).
`seed_catalog()` runs both on a Session, for `backend/scripts/import_catalog.py`.
The *proposing* half of the pipeline (LLM classification, duplicate-similarity
matching) stays CLI-only and produces the reviewed YAML files this module just
applies.

`sync_catalog()` deliberately writes through the frozen table definitions
below, never the ORM models: those always describe the schema at head,
while a data migration runs against the schema of *its* revision. A column
added to `Question` later would otherwise end up in the INSERT of a
migration that runs before the column exists, breaking every fresh
`alembic upgrade head`. The oldest migration that still syncs is
e5b3a9c1d720 (the earlier ones are no-ops now), so the columns below are
the ones `questions`/`topics` have as of that revision. If a later migration
renames or drops one of them, the older data migrations need their own copy
of this module's logic.
"""

import dataclasses
import re
from collections.abc import Sequence
from pathlib import Path

import pypdf
import sqlalchemy as sa
import yaml
from sqlalchemy.engine import Connection, Row
from sqlalchemy.orm import Session

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
PDF_PATH = _BACKEND_DIR.parent / "docs" / "Fragenkatalog-SKS.pdf"
DATA_DIR = _BACKEND_DIR / "scripts" / "data"
TOPICS_PATH = DATA_DIR / "topics.yaml"
ASSIGNMENTS_DIR = DATA_DIR / "topic_assignments"
SEEMANNSCHAFT_DUPLICATES_PATH = DATA_DIR / "seemannschaft_duplicates.yaml"
IMAGES_PATH = DATA_DIR / "question_images.yaml"
# The static frontend serves these (ADR-0033); the API only hands out file names.
IMAGES_DIR = _BACKEND_DIR.parent / "frontend" / "public" / "catalog"

SUBJECTS = [
    ("navigation", "Navigation"),
    ("schifffahrtsrecht", "Schifffahrtsrecht"),
    ("wetterkunde", "Wetterkunde"),
    ("seemannschaft_1", "Seemannschaft I"),
    ("seemannschaft_2", "Seemannschaft II"),
]

SEEMANNSCHAFT_SUBJECTS = ("seemannschaft_allgemein", "seemannschaft_segeln", "seemannschaft_motor")

BREADCRUMB_RE = re.compile(r"Sie sind hier:")
NUMBER_RE = re.compile(r"Nummer\s+(\d+):\s*\n")
WHITESPACE_RE = re.compile(r"[ \t]+")
ANY_WHITESPACE_RE = re.compile(r"\s+")
BLANK_LINES_RE = re.compile(r"\n\s*\n+")
# A line starting like this begins a list item ("1. ", "a) ", "- ", "• ") and
# keeps its line break; every other break in the PDF text is just its layout
# wrapping the line.
LIST_ITEM_START_RE = re.compile(r"(?:\d+\.|[a-z]\)|[-•–])\s")  # noqa: RUF001 - the catalog uses en dashes as list bullets
# Never occurs in the PDF's text: marks where a question's answer begins.
ANSWER_START = "\x1e"

# The PDF flattens a chart symbol's typesetting into plain digits. Navigation
# 84 asks about the drying height "2" underlined with a small "3" (= 2,3 m, as
# on a Seekarte), which the PDF text yields as "2 3" — unrecognisable. The
# symbol is restored in Unicode (digit + combining low line, subscript digit);
# the wording is otherwise untouched.
QUESTION_TEXT_FIXES = {("navigation", 84): ("Tiefenangabe 2 3.", "Tiefenangabe 2\u0332\u2083.")}
# Same for answers: Navigation 48 names the Koppelort O_k and the beobachteten
# Ort O_b, but the PDF text drops the subscripts and appends them after the
# sentence ("(O ) ... (O ), ... Zeitpunkt. k b"). Unicode has no subscript b,
# so they are written "O_k"/"O_b" and drawn as markup by RichText.
ANSWER_TEXT_FIXES = {
    ("navigation", 48): (
        "Koppelort (O ) zum beobachteten Ort (O ), bezogen auf den gleichen Zeitpunkt. k b",
        "Koppelort (O_k) zum beobachteten Ort (O_b), bezogen auf den gleichen Zeitpunkt.",
    )
}

# Frozen as of revision 16af6f481bf6 (the first data migration) — see the
# module docstring for why these aren't the ORM models.
_topics = sa.table(
    "topics",
    sa.column("id", sa.Integer),
    sa.column("subject", sa.String),
    sa.column("slug", sa.String),
    sa.column("name", sa.String),
    sa.column("display_order", sa.Integer),
)


_questions = sa.table(
    "questions",
    sa.column("id", sa.Integer),
    sa.column("subject", sa.String),
    sa.column("number", sa.Integer),
    sa.column("question_text", sa.Text),
    sa.column("answer_text", sa.Text),
    sa.column("topic_id", sa.Integer),
    sa.column("seemannschaft_1_number", sa.Integer),
    sa.column("seemannschaft_2_number", sa.Integer),
    sa.column("question_images", sa.JSON),
    sa.column("answer_images", sa.JSON),
)


@dataclasses.dataclass(frozen=True)
class CatalogImage:
    src: str  # file name inside frontend/public/catalog/
    width: int
    height: int


@dataclasses.dataclass(frozen=True)
class CatalogQuestion:
    subject: str
    number: int
    question_text: str
    answer_text: str
    seemannschaft_1_number: int | None = None
    seemannschaft_2_number: int | None = None
    topic_slug: str | None = None
    question_images: tuple[CatalogImage, ...] = ()
    answer_images: tuple[CatalogImage, ...] = ()


def unwrap_soft_breaks(s: str) -> str:
    """Join lines the PDF only wrapped; keep breaks before list items."""
    lines = [line.strip() for line in s.split("\n")]
    out = lines[0]
    for line in lines[1:]:
        out += ("\n" if LIST_ITEM_START_RE.match(line) else " ") + line
    return out


def clean(s: str) -> str:
    s = WHITESPACE_RE.sub(" ", s)
    s = BLANK_LINES_RE.sub("\n", s)
    return unwrap_soft_breaks(s.strip())


def split_question_answer(body: str) -> tuple[str, str]:
    """Split one question's body at the ANSWER_START marker.

    The marker comes from `extract_marked_text`: the catalog sets every
    question in bold, every answer in regular type, so the first switch from
    bold to regular is the boundary. A body can carry more than one marker
    when an answer puts a single word in bold (e.g. Navigation 70) — only
    the first one splits; the rest are dropped without touching the text.
    """
    question, _, answer = body.partition(ANSWER_START)
    return clean(question), clean(answer.replace(ANSWER_START, ""))


def _is_question_font(font_dict) -> bool:
    return "Georgia-Bold" in ((font_dict or {}).get("/BaseFont") or "")


def extract_marked_text(reader: pypdf.PdfReader) -> str:
    """The PDF's text, with ANSWER_START before every bold -> regular switch.

    Punctuation alone can't tell where a question ends: questions span
    several sentences ("... ab? Nennen Sie Beispiele."), end in a "."
    instead of a "?", or carry numbered sub-questions — and the answers
    look just the same. The typesetting can: questions are set in
    Georgia-Bold (or -BoldItalic), answers in Verdana (with the odd
    abbreviation in regular Georgia). Whitespace-only fragments don't count
    as a switch. Apart from the markers, the result is exactly
    `page.extract_text()` — the text visitor sees the same fragments.
    """
    pages = []
    in_bold = False
    for page in reader.pages:
        fragments: list[str] = []

        def visit(text, _cm, _tm, font_dict, _font_size, fragments=fragments):
            nonlocal in_bold
            if text.strip():
                bold = _is_question_font(font_dict)
                if in_bold and not bold:
                    fragments.append(ANSWER_START)
                in_bold = bold
            fragments.append(text)

        page.extract_text(visitor_text=visit)
        pages.append("".join(fragments))
    return "\n".join(pages)


def extract_sections(text: str) -> list[tuple[str, str]]:
    starts = [m.start() for m in BREADCRUMB_RE.finditer(text)][1:]  # skip title-page breadcrumb
    starts.append(len(text))
    if len(starts) - 1 != len(SUBJECTS):
        raise ValueError(f"expected {len(SUBJECTS)} sections, found {len(starts) - 1}")
    return [(SUBJECTS[i][0], text[starts[i] : starts[i + 1]]) for i in range(len(SUBJECTS))]


def _apply_fix(
    fixes: dict[tuple[str, int], tuple[str, str]], key: tuple[str, int], text: str, part: str
) -> str:
    if key not in fixes:
        return text
    broken, fixed = fixes[key]
    if broken not in text:
        raise ValueError(f"{key[0]} {key[1]}: expected {broken!r} in the {part}")
    return text.replace(broken, fixed)


def parse_catalog_pdf(pdf_path: Path = PDF_PATH) -> list[CatalogQuestion]:
    """The raw PDF parse — Seemannschaft still as seemannschaft_1/seemannschaft_2."""
    text = extract_marked_text(pypdf.PdfReader(str(pdf_path)))

    questions = []
    for subject, section_text in extract_sections(text):
        parts = NUMBER_RE.split(section_text)[1:]  # alternating: number, body, number, body, ...
        for i in range(0, len(parts), 2):
            question_text, answer_text = split_question_answer(parts[i + 1])
            key = (subject, int(parts[i]))
            question_text = _apply_fix(QUESTION_TEXT_FIXES, key, question_text, "question")
            answer_text = _apply_fix(ANSWER_TEXT_FIXES, key, answer_text, "answer")
            questions.append(
                CatalogQuestion(
                    subject=subject,
                    number=int(parts[i]),
                    question_text=question_text,
                    answer_text=answer_text,
                )
            )
    return questions


def normalize_wording(text: str) -> str:
    """Whitespace-normalized text, for word-for-word comparisons."""
    return ANY_WHITESPACE_RE.sub(" ", text).strip()


def wording_differs(a: CatalogQuestion, b: CatalogQuestion) -> bool:
    """True unless both question and answer match word for word."""
    return normalize_wording(a.question_text) != normalize_wording(b.question_text) or normalize_wording(
        a.answer_text
    ) != normalize_wording(b.answer_text)


def merge_seemannschaft(questions: list[CatalogQuestion]) -> list[CatalogQuestion]:
    """Collapse seemannschaft_1/seemannschaft_2 into the 3 merged subjects.

    Reads the human-reviewed duplicate-pair list committed at
    SEEMANNSCHAFT_DUPLICATES_PATH — never recomputes similarity itself. A
    merged pair keeps the Seemannschaft I wording and is renumbered
    sequentially (in Seemannschaft I order) within seemannschaft_allgemein;
    variant-exclusive questions keep their original number.

    Showing Seemannschaft I wording to Motor learners is only faithful to
    their official catalog if both texts match, so a pair whose question or
    answer differs (see `wording_differs`) must carry a reviewed
    `accepted_difference` rationale — otherwise this raises. See ADR-0026.
    """
    pairs = yaml.safe_load(SEEMANNSCHAFT_DUPLICATES_PATH.read_text()) or []
    pair_map: dict[int, int] = {p["seemannschaft_1"]: p["seemannschaft_2"] for p in pairs}
    accepted = {p["seemannschaft_1"] for p in pairs if p.get("accepted_difference")}
    matched_motor_numbers = set(pair_map.values())

    segeln_rows = {q.number: q for q in questions if q.subject == "seemannschaft_1"}
    motor_rows = {q.number: q for q in questions if q.subject == "seemannschaft_2"}
    merged = [q for q in questions if q.subject not in ("seemannschaft_1", "seemannschaft_2")]

    for num1, num2 in pair_map.items():
        if num1 not in segeln_rows:
            raise ValueError(f"duplicate pair references unknown Seemannschaft I question {num1}")
        if num2 not in motor_rows:
            raise ValueError(f"duplicate pair references unknown Seemannschaft II question {num2}")
    unaccepted = [
        f"{num1}/{num2}"
        for num1, num2 in sorted(pair_map.items())
        if num1 not in accepted and wording_differs(segeln_rows[num1], motor_rows[num2])
    ]
    if unaccepted:
        raise ValueError(
            "Seemannschaft I/II pairs differ in wording but have no accepted_difference: "
            + ", ".join(unaccepted)
        )

    for new_number, (num1, num2) in enumerate(sorted(pair_map.items()), start=1):
        merged.append(
            dataclasses.replace(
                segeln_rows[num1],
                subject="seemannschaft_allgemein",
                number=new_number,
                seemannschaft_1_number=num1,
                seemannschaft_2_number=num2,
            )
        )

    for num1, row in segeln_rows.items():
        if num1 not in pair_map:
            segeln = dataclasses.replace(row, subject="seemannschaft_segeln", seemannschaft_1_number=num1)
            merged.append(segeln)

    for num2, row in motor_rows.items():
        if num2 not in matched_motor_numbers:
            motor = dataclasses.replace(row, subject="seemannschaft_motor", seemannschaft_2_number=num2)
            merged.append(motor)

    return merged


def load_topics() -> dict[str, list[dict]]:
    return yaml.safe_load(TOPICS_PATH.read_text())


def assign_topics(questions: list[CatalogQuestion]) -> list[CatalogQuestion]:
    """Attach each question's reviewed topic slug from ASSIGNMENTS_DIR.

    Never calls an LLM — the per-subject files are already committed,
    reviewed data. A question with no assignment (or an assignment to a
    slug topics.yaml doesn't list) keeps topic_slug=None.
    """
    topics_by_subject = load_topics()
    assignments: dict[str, dict[int, str]] = {}
    for subject, topics in topics_by_subject.items():
        path = ASSIGNMENTS_DIR / f"{subject}.yaml"
        known_slugs = {t["slug"] for t in topics}
        raw = (yaml.safe_load(path.read_text()) or {}) if path.exists() else {}
        assignments[subject] = {number: slug for number, slug in raw.items() if slug in known_slugs}

    return [
        dataclasses.replace(q, topic_slug=assignments.get(q.subject, {}).get(q.number)) for q in questions
    ]


def attach_images(questions: list[CatalogQuestion]) -> list[CatalogQuestion]:
    """Attach each question's reviewed images from IMAGES_PATH.

    Keyed on the raw PDF key, so it runs before the Seemannschaft merge: a
    merged pair then carries the Seemannschaft I images, like its wording
    (ADR-0026). The PNG files themselves are extracted by
    scripts/extract_catalog_images.py and committed; nothing is read from the
    PDF here. Raises if an entry names an unknown question, a bad part or a
    file that isn't there.
    """
    entries = yaml.safe_load(IMAGES_PATH.read_text()) or []
    by_key = {(q.subject, q.number): q for q in questions}
    images: dict[tuple[str, int], dict[str, list[CatalogImage]]] = {}
    for entry in entries:
        key = (entry["subject"], entry["number"])
        if key not in by_key:
            raise ValueError(f"{IMAGES_PATH.name}: no question {key[0]} {key[1]} for {entry['file']}")
        if entry["part"] not in ("question", "answer"):
            raise ValueError(f"{IMAGES_PATH.name}: {entry['file']} has part {entry['part']!r}")
        if not (IMAGES_DIR / entry["file"]).is_file():
            raise ValueError(f"{IMAGES_PATH.name}: {entry['file']} is missing from {IMAGES_DIR}")
        image = CatalogImage(entry["file"], entry["width"], entry["height"])
        images.setdefault(key, {"question": [], "answer": []})[entry["part"]].append(image)
    return [
        dataclasses.replace(
            q,
            question_images=tuple(images[(q.subject, q.number)]["question"]),
            answer_images=tuple(images[(q.subject, q.number)]["answer"]),
        )
        if (q.subject, q.number) in images
        else q
        for q in questions
    ]


def build_catalog() -> list[CatalogQuestion]:
    """The complete target catalog: parse -> images -> merge -> topic assignment."""
    return assign_topics(merge_seemannschaft(attach_images(parse_catalog_pdf())))


def _rekey_seemannschaft(connection: Connection, questions: list[CatalogQuestion]) -> None:
    """Move existing Seemannschaft rows to their target (subject, number).

    `number` is derived for seemannschaft_allgemein (a pair's position in
    the reviewed duplicate list), so un-merging or adding a pair shifts
    every later one — and the plain (subject, number) upsert in
    `sync_catalog` would then silently attach learners' progress to a
    different question. The official catalog numbers
    (`seemannschaft_1_number`/`_2_number`) never shift, so they are the
    identity here:

    - a target with exactly an existing row's official numbers keeps it;
    - otherwise it takes over the existing row sharing its Seemannschaft I
      (else II) number — an un-merged pair's seemannschaft_segeln half keeps
      the old seemannschaft_allgemein row, id and progress included;
    - if that row is already taken (by the pair's other half), a new row is
      inserted with a copy of the old row's progress, so learners keep it in
      either exam variant;
    - an existing row no target claims is deleted, progress with it (its
      question left the catalog in that form, see ADR-0022).

    Only moves rows; `sync_catalog` then updates their contents as usual.
    See ADR-0026.
    """
    existing = connection.execute(
        sa.select(
            _questions.c.id,
            _questions.c.subject,
            _questions.c.number,
            _questions.c.seemannschaft_1_number,
            _questions.c.seemannschaft_2_number,
        ).where(_questions.c.subject.in_(SEEMANNSCHAFT_SUBJECTS))
    ).all()
    if not existing:
        return
    targets = [q for q in questions if q.subject in SEEMANNSCHAFT_SUBJECTS]
    claims, copies = _claim_rows(existing, targets)
    _delete_unclaimed(connection, existing, claims)
    _move_claimed(connection, existing, claims)
    _copy_taken_rows(connection, copies)


def _exact_claims(existing: Sequence[Row], targets: list[CatalogQuestion]) -> dict[int, CatalogQuestion]:
    """Existing row id -> the target with exactly that row's official numbers."""
    by_pair = {(r.seemannschaft_1_number, r.seemannschaft_2_number): r.id for r in existing}
    claims: dict[int, CatalogQuestion] = {}
    for q in targets:
        row_id = by_pair.get((q.seemannschaft_1_number, q.seemannschaft_2_number))
        if row_id is not None:
            claims[row_id] = q
    return claims


def _claim_rows(
    existing: Sequence[Row], targets: list[CatalogQuestion]
) -> tuple[dict[int, CatalogQuestion], list[tuple[CatalogQuestion, int]]]:
    """Which target takes over which existing row, and which targets need a copy of a row
    that's already taken (as (target, source row id))."""
    by_1 = {r.seemannschaft_1_number: r.id for r in existing if r.seemannschaft_1_number is not None}
    by_2 = {r.seemannschaft_2_number: r.id for r in existing if r.seemannschaft_2_number is not None}
    # Exact matches first, so a partial match never takes a row that still
    # exists unchanged.
    claims = _exact_claims(existing, targets)
    exact = set(claims.values())
    copies: list[tuple[CatalogQuestion, int]] = []
    for q in targets:
        if q in exact:
            continue
        row_id = by_1.get(q.seemannschaft_1_number)
        if row_id is None:
            row_id = by_2.get(q.seemannschaft_2_number)
        if row_id is None:
            continue  # a new question: sync_catalog inserts it
        if row_id in claims:
            copies.append((q, row_id))
        else:
            claims[row_id] = q
    return claims, copies


def _delete_unclaimed(
    connection: Connection, existing: Sequence[Row], claims: dict[int, CatalogQuestion]
) -> None:
    unclaimed = [r.id for r in existing if r.id not in claims]
    if unclaimed:
        connection.execute(sa.delete(_questions).where(_questions.c.id.in_(unclaimed)))


def _move_claimed(
    connection: Connection, existing: Sequence[Row], claims: dict[int, CatalogQuestion]
) -> None:
    moved = [
        r.id
        for r in existing
        if r.id in claims and (r.subject, r.number) != (claims[r.id].subject, claims[r.id].number)
    ]
    # Two steps, so no row ever lands on a key another row still holds
    # (uq_question_subject_number is checked per statement).
    for row_id in moved:
        connection.execute(sa.update(_questions).where(_questions.c.id == row_id).values(number=-row_id))
    for row_id in moved:
        q = claims[row_id]
        connection.execute(
            sa.update(_questions).where(_questions.c.id == row_id).values(subject=q.subject, number=q.number)
        )


def _copy_taken_rows(connection: Connection, copies: list[tuple[CatalogQuestion, int]]) -> None:
    if not copies:
        return
    # Reflected rather than frozen: a copy has to carry every column the
    # table has at the migration's revision.
    progress = sa.Table("question_progress", sa.MetaData(), autoload_with=connection)
    carried = [c for c in progress.c if c.name not in ("id", "question_id")]
    for q, source_id in copies:
        new_id = connection.execute(
            sa.insert(_questions)
            .values(
                subject=q.subject,
                number=q.number,
                question_text=q.question_text,
                answer_text=q.answer_text,
            )
            .returning(_questions.c.id)
        ).scalar_one()
        connection.execute(
            progress.insert().from_select(
                [c.name for c in carried] + ["question_id"],
                sa.select(*carried, sa.literal(new_id)).where(progress.c.question_id == source_id),
            )
        )


def sync_catalog(connection: Connection, questions: list[CatalogQuestion]) -> None:
    """Make `topics`/`questions` match topics.yaml and `questions` by upsert.

    Doesn't commit — the caller owns the transaction (an Alembic migration's,
    or a Session's via seed_catalog).
    """
    topics_by_subject = load_topics()

    # Topics: upsert by (subject, slug), then drop the ones topics.yaml no
    # longer lists (e.g. merged away, see ADR-0020) once no question points
    # at them any more — hence after the questions below.
    existing_topics = {
        (row.subject, row.slug): row.id
        for row in connection.execute(sa.select(_topics.c.id, _topics.c.subject, _topics.c.slug))
    }
    for subject, topics in topics_by_subject.items():
        for t in topics:
            values = {"name": t["name"], "display_order": t["display_order"]}
            topic_id = existing_topics.get((subject, t["slug"]))
            if topic_id is None:
                connection.execute(sa.insert(_topics).values(subject=subject, slug=t["slug"], **values))
            else:
                connection.execute(sa.update(_topics).where(_topics.c.id == topic_id).values(**values))
    topic_ids = {
        (row.subject, row.slug): row.id
        for row in connection.execute(sa.select(_topics.c.id, _topics.c.subject, _topics.c.slug))
    }

    # Questions: upsert by (subject, number) so ids — and every learner's
    # question_progress row pointing at them — survive a re-sync. Seemannschaft
    # rows are first moved to their new key by official number.
    _rekey_seemannschaft(connection, questions)
    existing_questions = {
        (row.subject, row.number): row.id
        for row in connection.execute(sa.select(_questions.c.id, _questions.c.subject, _questions.c.number))
    }
    target_keys = {(q.subject, q.number) for q in questions}
    removed_ids = [qid for key, qid in existing_questions.items() if key not in target_keys]
    if removed_ids:
        connection.execute(sa.delete(_questions).where(_questions.c.id.in_(removed_ids)))

    for q in questions:
        values = {
            "question_text": q.question_text,
            "answer_text": q.answer_text,
            "topic_id": topic_ids.get((q.subject, q.topic_slug)) if q.topic_slug else None,
            "seemannschaft_1_number": q.seemannschaft_1_number,
            "seemannschaft_2_number": q.seemannschaft_2_number,
            "question_images": [dataclasses.asdict(i) for i in q.question_images],
            "answer_images": [dataclasses.asdict(i) for i in q.answer_images],
        }
        question_id = existing_questions.get((q.subject, q.number))
        if question_id is None:
            connection.execute(sa.insert(_questions).values(subject=q.subject, number=q.number, **values))
        else:
            connection.execute(sa.update(_questions).where(_questions.c.id == question_id).values(**values))

    for subject, topics in topics_by_subject.items():
        current_slugs = {t["slug"] for t in topics}
        connection.execute(
            sa.delete(_topics).where(_topics.c.subject == subject, _topics.c.slug.notin_(current_slugs))
        )


def seed_catalog(db: Session) -> list[tuple[str, int]]:
    """Build the catalog and sync it into the DB, committing the result.

    Returns the (subject, number) pairs that got no topic assignment.
    """
    questions = build_catalog()
    sync_catalog(db.connection(), questions)
    db.commit()
    return [(q.subject, q.number) for q in questions if q.topic_slug is None]
