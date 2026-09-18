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
produces):

    OPENAI_API_KEY=... PYTHONPATH=. .venv/bin/python scripts/manage_topics.py propose
    # review/edit scripts/data/topic_assignments/<subject>.yaml by hand
    PYTHONPATH=. .venv/bin/python scripts/manage_topics.py apply
"""

import argparse
import json
from pathlib import Path

import yaml
from openai import OpenAI

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.question import Question
from app.models.topic import Topic

TOPICS_PATH = Path(__file__).resolve().parent / "data" / "topics.yaml"
ASSIGNMENTS_DIR = Path(__file__).resolve().parent / "data" / "topic_assignments"
MODEL = "gpt-4.1-mini"


def load_topics() -> dict[str, list[dict]]:
    return yaml.safe_load(TOPICS_PATH.read_text())


def propose(force: bool) -> None:
    topics_by_subject = load_topics()
    client = OpenAI(api_key=settings.openai_api_key)

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
                "Du ordnest Fragen aus dem amtlichen SKS-Fragenkatalog (Fach "
                f"'{subject}') den folgenden amtlichen Unterthemen zu. Verwende "
                "AUSSCHLIESSLICH die unten aufgeführten Slugs, erfinde keine neuen "
                "Kategorien. Antworte als JSON-Objekt der Form "
                '{"assignments": {"<Fragennummer>": "<slug>"}} mit genau einem '
                "Eintrag pro Fragennummer.\n\n"
                f"Unterthemen:\n{topic_list_text}\n\nFragen:\n{questions_text}"
            )

            response = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
            )
            assignments = json.loads(response.choices[0].message.content).get("assignments", {})

            invalid = {num: slug for num, slug in assignments.items() if slug not in allowed_slugs}
            missing = [q.number for q in questions if str(q.number) not in assignments]
            if invalid:
                print(f"{subject}: {len(invalid)} assignments used an unknown slug: {invalid}")
            if missing:
                print(f"{subject}: {len(missing)} questions got no assignment: {missing}")

            ASSIGNMENTS_DIR.mkdir(parents=True, exist_ok=True)
            out_path.write_text(
                yaml.dump({int(k): v for k, v in assignments.items()}, allow_unicode=True, sort_keys=True)
            )
            print(f"{subject}: wrote {len(assignments)} assignments to {out_path}")
    finally:
        db.close()


def apply_() -> None:
    topics_by_subject = load_topics()

    db = SessionLocal()
    try:
        topic_id_by_subject_slug: dict[tuple[str, str], int] = {}
        for subject, topics in topics_by_subject.items():
            for t in topics:
                topic = (
                    db.query(Topic).filter(Topic.subject == subject, Topic.slug == t["slug"]).one_or_none()
                )
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
                print(f"Skipping {subject}: no {assignments_path}")
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
