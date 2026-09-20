"""Extract the images embedded in the catalog PDF and propose which question each belongs to.

Usage (reads the PDF directly, no DB needed; needs PyMuPDF from requirements-dev.txt):

    PYTHONPATH=. .venv/bin/python scripts/extract_catalog_images.py [--force]
    # review/edit scripts/data/question_images.yaml by hand
    PYTHONPATH=. .venv/bin/python scripts/import_catalog.py

Writes every image as a PNG to frontend/public/catalog/ (the static site
serves them, see ADR-0033) and proposes scripts/data/question_images.yaml:
one entry per image, keyed on the *raw* PDF key (`seemannschaft_1` /
`seemannschaft_2`, before the merge), in reading order, with its pixel size.
Applying the reviewed file happens in app/services/catalog_seed.py
(`attach_images`), which also runs as an Alembic data migration — that's what
seeds production. Only the committed PNGs and the YAML need to exist there.

The proposal is a heuristic: an image belongs to the question whose
"Nummer N:" heading precedes it, and counts as part of the *answer* once
answer-typeset text (anything but Georgia-Bold, see `_is_question_font`)
has appeared for that question. A sketch-only answer has no such text, so
its image is proposed as a question image — fix those by hand (a question
with both an empty and a solved sketch: the second one is the answer).
Refuses to overwrite a reviewed file unless --force.
"""

import argparse
import re
from pathlib import Path

import fitz  # PyMuPDF
import yaml

from app.services.catalog_seed import DATA_DIR, PDF_PATH, SUBJECTS

DATA_PATH = DATA_DIR / "question_images.yaml"
IMAGES_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "catalog"

NUMBER_RE = re.compile(r"\s*Nummer\s+(\d+):")
# Every page carries the site's banner (213x58, top right) — not part of any question.
BANNER_SIZE = (213, 58)


def _section_starts(doc: fitz.Document) -> dict[int, str]:
    """Page number -> raw subject, where each subject's section begins.

    Same anchor as catalog_seed.extract_sections: the "Sie sind hier:"
    breadcrumb, whose first occurrence is the title page's.
    """
    starts = [i + 1 for i, page in enumerate(doc) if "Sie sind hier:" in page.get_text()][1:]
    if len(starts) != len(SUBJECTS):
        raise ValueError(f"expected {len(SUBJECTS)} sections, found {len(starts)}")
    return {page: SUBJECTS[i][0] for i, page in enumerate(starts)}


def propose() -> list[dict]:
    doc = fitz.open(PDF_PATH)
    starts = _section_starts(doc)
    subject = number = None
    answer_seen = False
    counts: dict[tuple[str, int], int] = {}
    entries = []

    for page_number, page in enumerate(doc, start=1):
        if page_number in starts:
            subject, number, answer_seen = starts[page_number], None, False
        items = []  # (y, kind, payload) in reading order
        for block in page.get_text("dict")["blocks"]:
            if block["type"] == 0:
                items.append((block["bbox"][1], "text", block))
        for info in page.get_image_info(xrefs=True):
            if (info["width"], info["height"]) != BANNER_SIZE:
                items.append((info["bbox"][1], "image", info))
        for _, kind, payload in sorted(items, key=lambda item: item[0]):
            if kind == "text":
                text = "".join(s["text"] for line in payload["lines"] for s in line["spans"])
                if match := NUMBER_RE.match(text):
                    number, answer_seen = int(match.group(1)), False
                elif any(
                    "Georgia-Bold" not in s["font"] and s["text"].strip()
                    for line in payload["lines"]
                    for s in line["spans"]
                ):
                    answer_seen = True
                continue
            if subject is None or number is None:
                raise ValueError(f"image on page {page_number} before the first question of its section")
            key = (subject, number)
            counts[key] = counts.get(key, 0) + 1
            filename = f"{subject}-{number}-{counts[key]}.png"
            pixmap = fitz.Pixmap(doc, payload["xref"])
            if pixmap.n >= 4:  # drop alpha/CMYK: the page background is white anyway
                pixmap = fitz.Pixmap(fitz.csRGB, pixmap)
            IMAGES_DIR.mkdir(parents=True, exist_ok=True)
            pixmap.save(IMAGES_DIR / filename)
            entries.append(
                {
                    "subject": subject,
                    "number": number,
                    "part": "answer" if answer_seen else "question",
                    "file": filename,
                    "width": pixmap.width,
                    "height": pixmap.height,
                }
            )
    return entries


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--force", action="store_true", help="overwrite a reviewed question_images.yaml")
    args = parser.parse_args()
    if DATA_PATH.exists() and not args.force:
        raise SystemExit(f"{DATA_PATH} already exists (reviewed by hand) — pass --force to overwrite it.")
    entries = propose()
    header = (
        "# Reviewed catalog images: which question (raw PDF key, before the Seemannschaft merge) and which\n"
        "# part (question/answer) each PNG in frontend/public/catalog/ belongs to, in reading order.\n"
        "# Proposed by scripts/extract_catalog_images.py, corrected by hand — see its docstring.\n"
    )
    DATA_PATH.write_text(header + yaml.safe_dump(entries, sort_keys=False, allow_unicode=True))
    print(f"Wrote {len(entries)} images to {IMAGES_DIR} and the proposal to {DATA_PATH}.")


if __name__ == "__main__":
    main()
