"""List every reviewed Seemannschaft I/II pair whose wording isn't identical.

A pair in scripts/data/seemannschaft_duplicates.yaml is stored once, as
seemannschaft_allgemein, with the Seemannschaft I wording — for both exam
variants. That's only faithful to the official catalog if the Seemannschaft
II question *and* answer say exactly the same thing. This script compares
both (whitespace-normalized) and prints a word-level diff for every pair
that doesn't match, with the pair's reviewed `accepted_difference`, if any —
the input for deciding per pair whether to keep it merged or split it back
into seemannschaft_segeln/_motor (see ADR-0026).

Usage (reads the PDF directly, no DB needed):

    PYTHONPATH=. .venv/bin/python scripts/diff_seemannschaft_pairs.py

Exits 0 either way — it's a report, not a check. The check is
merge_seemannschaft() in app/services/catalog_seed.py, which refuses to
merge a differing pair without an `accepted_difference`.
"""

import argparse
import difflib

import yaml

from app.services.catalog_seed import (
    SEEMANNSCHAFT_DUPLICATES_PATH,
    CatalogQuestion,
    normalize_wording,
    parse_catalog_pdf,
    wording_differs,
)


def word_diff(old: str, new: str) -> str:
    """Inline word diff: [-only in old-] {+only in new+}, shared words as-is."""
    a, b = normalize_wording(old).split(" "), normalize_wording(new).split(" ")
    out: list[str] = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == "equal":
            out.extend(a[i1:i2])
            continue
        if i2 > i1:
            out.append("[-" + " ".join(a[i1:i2]) + "-]")
        if j2 > j1:
            out.append("{+" + " ".join(b[j1:j2]) + "+}")
    return " ".join(out)


def differing_pairs(
    questions: list[CatalogQuestion], pairs: list[dict]
) -> list[tuple[dict, CatalogQuestion, CatalogQuestion]]:
    """The pairs whose question or answer differs, in Seemannschaft I order."""
    s1 = {q.number: q for q in questions if q.subject == "seemannschaft_1"}
    s2 = {q.number: q for q in questions if q.subject == "seemannschaft_2"}
    result = []
    for pair in sorted(pairs, key=lambda p: p["seemannschaft_1"]):
        q1, q2 = s1[pair["seemannschaft_1"]], s2[pair["seemannschaft_2"]]
        if wording_differs(q1, q2):
            result.append((pair, q1, q2))
    return result


def render(diffs: list[tuple[dict, CatalogQuestion, CatalogQuestion]], total: int) -> str:
    lines = [f"{len(diffs)} of {total} reviewed Seemannschaft I/II pairs differ ([-S I-] {{+S II+}})", ""]
    for pair, q1, q2 in diffs:
        lines.append("=" * 78)
        lines.append(f"S I #{q1.number} / S II #{q2.number}")
        lines.append(f"accepted_difference: {pair.get('accepted_difference') or '-'}")
        for label, a, b in (
            ("Frage", q1.question_text, q2.question_text),
            ("Antwort", q1.answer_text, q2.answer_text),
        ):
            same = normalize_wording(a) == normalize_wording(b)
            lines.append(f"{label}: " + ("identisch" if same else word_diff(a, b)))
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    formatter = argparse.RawDescriptionHelpFormatter
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=formatter)
    parser.parse_args()
    pairs = yaml.safe_load(SEEMANNSCHAFT_DUPLICATES_PATH.read_text()) or []
    print(render(differing_pairs(parse_catalog_pdf(), pairs), len(pairs)))


if __name__ == "__main__":
    main()
