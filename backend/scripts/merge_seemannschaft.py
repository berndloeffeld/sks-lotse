"""Collapse the official Seemannschaft I / II catalogs into three subjects.

Seemannschaft I ("Antriebsmaschine und unter Segel") and Seemannschaft II
("Antriebsmaschine") share most of their questions almost word-for-word —
only rigging/sail-trim (I) and engine/boat-type (II) content really differs
between the two exam variants. Storing every shared question twice is pure
redundancy, so this script collapses the two into three subjects:
seemannschaft_allgemein (shared), seemannschaft_segeln (I-only) and
seemannschaft_motor (II-only). See CLAUDE.md → Question Catalog and
docs/adr/ for the reasoning.

Usage (reads the PDF directly, no DB needed; run before manage_topics.py,
which assigns topics keyed on the post-merge subjects):

    PYTHONPATH=. .venv/bin/python scripts/merge_seemannschaft.py [--force]
    # review/edit scripts/data/seemannschaft_duplicates.yaml by hand
    PYTHONPATH=. .venv/bin/python scripts/import_catalog.py

This only ever suggests candidates for a human to check — matching is plain
text-similarity (no LLM needed, the duplicates are near word-for-word
identical). Applying the reviewed file happens in
app/services/catalog_seed.py (merge_seemannschaft), which also runs
automatically as an Alembic data migration — that's what seeds production.
"""

import argparse
import difflib
import re

import yaml

from app.services.catalog_seed import SEEMANNSCHAFT_DUPLICATES_PATH, parse_catalog_pdf

DATA_PATH = SEEMANNSCHAFT_DUPLICATES_PATH
SIMILARITY_THRESHOLD = 0.75

WHITESPACE_RE = re.compile(r"\s+")


def normalize(text: str) -> str:
    return WHITESPACE_RE.sub(" ", text).strip().lower()


def propose(force: bool) -> None:
    if DATA_PATH.exists() and not force:
        raise SystemExit(f"{DATA_PATH} already exists — pass --force to overwrite")

    raw = parse_catalog_pdf()
    segeln = sorted((q for q in raw if q.subject == "seemannschaft_1"), key=lambda q: q.number)
    motor = sorted((q for q in raw if q.subject == "seemannschaft_2"), key=lambda q: q.number)

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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="overwrite an existing duplicates file")
    propose(parser.parse_args().force)


if __name__ == "__main__":
    main()
