"""Assign each catalog question to one of the topics in data/topics.yaml.

The topic *names* in data/topics.yaml are either transcribed verbatim from the
official catalog's own table of contents, or a short collective name grouping
several such headings together (see that file's header, and ADR-0020) — either
way, this script never invents or renames topics itself. Its only job is
classifying each question into one of the given topics, which is why it works
from a fixed allow-list of slugs per subject rather than asking the model to
come up with categories itself.

Usage (reads the PDF directly, no DB needed; seemannschaft topics are keyed
on the merged subjects — seemannschaft_allgemein/_motor/_segeln — so the
reviewed scripts/data/seemannschaft_duplicates.yaml must be final first).
Needs ANTHROPIC_API_KEY set (backend/.env) — this is a local dev-only tool,
not read by the running app:

    PYTHONPATH=. .venv/bin/python scripts/manage_topics.py [--force | --missing]
    # review/edit scripts/data/topic_assignments/<subject>.yaml by hand

`--missing` classifies only the questions an existing file has no entry for
(e.g. after un-merging a Seemannschaft pair) and adds them to that file,
leaving every already-reviewed assignment untouched.
    PYTHONPATH=. .venv/bin/python scripts/import_catalog.py

Applying the reviewed files happens in app/services/catalog_seed.py
(assign_topics), which also runs automatically as an Alembic data
migration — that's what applies these assignments in production. That
side never calls an LLM; only this script does, and only to produce the
reviewed YAML files.
"""

import argparse

import yaml
from anthropic import Anthropic
from pydantic import BaseModel

from app.core.config import settings
from app.services.catalog_seed import ASSIGNMENTS_DIR, load_topics, merge_seemannschaft, parse_catalog_pdf

MODEL = "claude-haiku-4-5"


class Assignment(BaseModel):
    number: int
    slug: str


class TopicAssignments(BaseModel):
    # A flat list rather than a {number: slug} dict — Claude's structured-output
    # schema requires additionalProperties: false, which rules out a dict with
    # dynamic (per-question-number) keys.
    assignments: list[Assignment]


def propose(force: bool, missing_only: bool = False) -> None:
    topics_by_subject = load_topics()
    client = Anthropic(api_key=settings.anthropic_api_key)
    catalog = merge_seemannschaft(parse_catalog_pdf())

    for subject, topics in topics_by_subject.items():
        out_path = ASSIGNMENTS_DIR / f"{subject}.yaml"
        reviewed: dict[int, str] = {}
        if missing_only and out_path.exists():
            reviewed = yaml.safe_load(out_path.read_text()) or {}
        elif out_path.exists() and not force:
            print(f"Skipping {subject}: {out_path} already exists (use --force or --missing)")
            continue

        questions = sorted(
            (q for q in catalog if q.subject == subject and q.number not in reviewed), key=lambda q: q.number
        )
        if not questions:
            print(f"Skipping {subject}: nothing to classify")
            continue

        allowed_slugs = {t["slug"] for t in topics}
        topic_list_text = "\n".join(f"- {t['slug']}: {t['name']}" for t in topics)
        questions_text = "\n".join(f"{q.number}: {q.question_text}" for q in questions)
        prompt = (
            "You are classifying questions from the official SKS question catalog (subject "
            f"'{subject}') into the following official sub-topics. Use "
            "ONLY the slugs listed below, do not invent new "
            "categories. Provide exactly one entry per question number.\n\n"
            f"Sub-topics:\n{topic_list_text}\n\nQuestions:\n{questions_text}"
        )

        response = client.messages.parse(
            model=MODEL,
            max_tokens=16000,
            messages=[{"role": "user", "content": prompt}],
            output_format=TopicAssignments,
        )
        assignments = {a.number: a.slug for a in response.parsed_output.assignments}

        invalid = {num: slug for num, slug in assignments.items() if slug not in allowed_slugs}
        missing = [q.number for q in questions if q.number not in assignments]
        if invalid:
            print(f"{subject}: {len(invalid)} assignments used an unknown slug: {invalid}")
        if missing:
            print(f"{subject}: {len(missing)} questions got no assignment: {missing}")

        ASSIGNMENTS_DIR.mkdir(parents=True, exist_ok=True)
        out_path.write_text(yaml.dump({**reviewed, **assignments}, allow_unicode=True, sort_keys=True))
        print(f"{subject}: wrote {len(assignments)} new assignments to {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--force", action="store_true", help="overwrite existing assignment files")
    mode.add_argument("--missing", action="store_true", help="only classify questions without an assignment")
    args = parser.parse_args()
    propose(args.force, missing_only=args.missing)


if __name__ == "__main__":
    main()
