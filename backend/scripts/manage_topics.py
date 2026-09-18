"""Assign each catalog question to one of the official topics in data/topics.yaml.

The topic *names* in data/topics.yaml are transcribed verbatim from the
official catalog's own table of contents (see that file's header) — this
script never invents or renames topics. Its only job is classifying each
question into one of the given topics, which is why it works from a fixed
allow-list of slugs per subject rather than asking the model to come up
with categories itself.

Usage (must run after merge_seemannschaft.py apply, since seemannschaft
topics are keyed on the merged subjects — seemannschaft_allgemein/_motor/
_segeln — not the raw seemannschaft_1/seemannschaft_2 import_catalog.py
produces). Needs ANTHROPIC_API_KEY set (backend/.env) — this is a local
dev-only tool, not read by the running app:

    PYTHONPATH=. .venv/bin/python scripts/manage_topics.py propose
    # review/edit scripts/data/topic_assignments/<subject>.yaml by hand
    PYTHONPATH=. .venv/bin/python scripts/manage_topics.py apply

`apply`'s actual logic lives in app/services/catalog_seed.py, which also
runs automatically as an Alembic data migration — that's what applies
these assignments in production. It never calls an LLM; only `propose`
above does, and only to produce the reviewed YAML files `apply` reads.
"""

import argparse

import yaml
from anthropic import Anthropic
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.question import Question
from app.services.catalog_seed import ASSIGNMENTS_DIR, apply_topics, load_topics

MODEL = "claude-haiku-4-5"


class Assignment(BaseModel):
    number: int
    slug: str


class TopicAssignments(BaseModel):
    # A flat list rather than a {number: slug} dict — Claude's structured-output
    # schema requires additionalProperties: false, which rules out a dict with
    # dynamic (per-question-number) keys.
    assignments: list[Assignment]


def propose(force: bool) -> None:
    topics_by_subject = load_topics()
    client = Anthropic(api_key=settings.anthropic_api_key)

    db = SessionLocal()
    try:
        for subject, topics in topics_by_subject.items():
            out_path = ASSIGNMENTS_DIR / f"{subject}.yaml"
            if out_path.exists() and not force:
                print(f"Skipping {subject}: {out_path} already exists (use --force to overwrite)")
                continue

            questions = db.query(Question).filter(Question.subject == subject).order_by(Question.number).all()
            if not questions:
                print(f"Skipping {subject}: no questions found (run merge_seemannschaft.py first?)")
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
            out_path.write_text(yaml.dump(assignments, allow_unicode=True, sort_keys=True))
            print(f"{subject}: wrote {len(assignments)} assignments to {out_path}")
    finally:
        db.close()


def apply_() -> None:
    db = SessionLocal()
    try:
        unassigned = apply_topics(db)
    finally:
        db.close()

    if unassigned:
        print(f"{len(unassigned)} questions remain unassigned: {unassigned}")
    print("Topic assignment applied.")


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
