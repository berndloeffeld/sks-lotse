"""Collapse the official Seemannschaft I / II catalogs into three subjects.

Seemannschaft I ("Antriebsmaschine und unter Segel") and Seemannschaft II
("Antriebsmaschine") share most of their questions almost word-for-word —
only rigging/sail-trim (I) and engine/boat-type (II) content really differs
between the two exam variants. Storing every shared question twice is pure
redundancy, so this script collapses the two into three subjects:
seemannschaft_allgemein (shared), seemannschaft_segeln (I-only) and
seemannschaft_motor (II-only). See CLAUDE.md → Question Catalog and
docs/adr/ for the reasoning.

Usage (must run after import_catalog.py, which always recreates
seemannschaft_1/seemannschaft_2 from scratch, and before manage_topics.py,
which assigns topics keyed on the post-merge subjects):

    PYTHONPATH=. .venv/bin/python scripts/merge_seemannschaft.py propose
    # review/edit scripts/data/seemannschaft_duplicates.yaml by hand
    PYTHONPATH=. .venv/bin/python scripts/merge_seemannschaft.py apply

`propose` only ever suggests candidates for a human to check — matching is
plain text-similarity (no LLM needed, the duplicates are near word-for-word
identical). `apply` is the only step that touches the database, and only
ever reads from the reviewed YAML file, never re-computes similarity itself.
"""

import argparse
import difflib
import re
from pathlib import Path

import yaml

from app.core.database import SessionLocal
from app.models.question import Question

DATA_PATH = Path(__file__).resolve().parent / "data" / "seemannschaft_duplicates.yaml"
SIMILARITY_THRESHOLD = 0.75

WHITESPACE_RE = re.compile(r"\s+")


def normalize(text: str) -> str:
    return WHITESPACE_RE.sub(" ", text).strip().lower()


def propose(force: bool) -> None:
    if DATA_PATH.exists() and not force:
        raise SystemExit(f"{DATA_PATH} already exists — pass --force to overwrite")

    db = SessionLocal()
    try:
        segeln = (
            db.query(Question).filter(Question.subject == "seemannschaft_1").order_by(Question.number).all()
        )
        motor = (
            db.query(Question).filter(Question.subject == "seemannschaft_2").order_by(Question.number).all()
        )
    finally:
        db.close()

    motor_norm = {m.number: normalize(m.question_text) for m in motor}
    used_motor_numbers: set[int] = set()
    pairs = []
    for s in segeln:
        s_norm = normalize(s.question_text)
        best_number, best_ratio = None, 0.0
        for m_number, m_norm in motor_norm.items():
            if m_number in used_motor_numbers:
                continue
            ratio = difflib.SequenceMatcher(None, s_norm, m_norm).ratio()
            if ratio > best_ratio:
                best_number, best_ratio = m_number, ratio
        if best_number is not None and best_ratio >= SIMILARITY_THRESHOLD:
            pairs.append(
                {
                    "seemannschaft_1": s.number,
                    "seemannschaft_2": best_number,
                    "similarity": round(best_ratio, 3),
                }
            )
            used_motor_numbers.add(best_number)

    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(yaml.dump(pairs, allow_unicode=True, sort_keys=False))
    print(f"Wrote {len(pairs)} candidate duplicate pairs to {DATA_PATH}")
    print(f"Seemannschaft I: {len(segeln)} questions, Seemannschaft II: {len(motor)} questions")


def apply_() -> None:
    pairs = yaml.safe_load(DATA_PATH.read_text()) or []
    pair_map: dict[int, int] = {p["seemannschaft_1"]: p["seemannschaft_2"] for p in pairs}
    matched_motor_numbers = set(pair_map.values())

    db = SessionLocal()
    try:
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

        counts = {
            subject: db.query(Question).filter(Question.subject == subject).count()
            for subject in ("seemannschaft_allgemein", "seemannschaft_segeln", "seemannschaft_motor")
        }
    finally:
        db.close()

    print(f"Merged {len(pair_map)} duplicate pairs into seemannschaft_allgemein.")
    print(f"Resulting counts: {counts}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    propose_parser = subparsers.add_parser("propose")
    propose_parser.add_argument("--force", action="store_true")
    subparsers.add_parser("apply")

    args = parser.parse_args()
    if args.command == "propose":
        propose(args.force)
    else:
        apply_()


if __name__ == "__main__":
    main()
