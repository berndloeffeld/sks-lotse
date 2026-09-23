"""Rules of the exam simulation (docs/adr/0029-exam-simulation.md).

Numbers follow the official Durchführungsrichtlinien Sportküstenschifferschein
(Nr. 6.2, 7.1, Anlage 1): the Fragebogen part has 30 questions, 90 minutes and
60 points. The per-subject split comes from the exam bodies' published exam
layout, the Richtlinien only demand a "wohlausgewogener Querschnitt".
"""

import random
from typing import Literal

from app.core.exam_variant import ExamVariant

EXAM_DURATION_MINUTES = 90
POINTS_PER_QUESTION = 2
MAX_POINTS = 60

# Order = order of the questions in the exam.
SUBJECT_GROUPS = ("navigation", "schifffahrtsrecht", "wetterkunde", "seemannschaft")
QUESTIONS_PER_GROUP: dict[str, int] = {
    "navigation": 9,
    "schifffahrtsrecht": 7,
    "wetterkunde": 5,
    "seemannschaft": 9,
}
QUESTION_COUNT = sum(QUESTIONS_PER_GROUP.values())

# Self-assessment -> points. Not defined by the Richtlinien (examiners award
# points per answer); this is the natural mapping of our three outcomes.
OUTCOME_POINTS: dict[str, int] = {"richtig": 2, "teilweise_richtig": 1, "falsch": 0}

PASS_MIN_POINTS = 39
ORAL_MIN_POINTS = 33

ExamStatus = Literal["in_progress", "grading", "completed"]
ExamResult = Literal["bestanden", "muendliche_nachpruefung", "nicht_bestanden"]


def subject_group(subject: str) -> str:
    """Maps a catalog subject to its exam subject group."""
    return "seemannschaft" if subject.startswith("seemannschaft") else subject


def compose_exam(
    questions: list[tuple[int, str]], variant: ExamVariant, rng: random.Random | None = None
) -> list[tuple[int, str]]:
    """Randomly picks the exam's questions as (question_id, subject_group), in exam order.

    `questions` are (id, subject) pairs already restricted to the variant's subjects.
    """
    rng = rng or random.Random()  # noqa: S311 - exam composition, not a secret
    by_group: dict[str, list[int]] = {group: [] for group in SUBJECT_GROUPS}
    for question_id, subject in questions:
        by_group[subject_group(subject)].append(question_id)
    picked: list[tuple[int, str]] = []
    for group in SUBJECT_GROUPS:
        pool = by_group[group]
        count = min(QUESTIONS_PER_GROUP[group], len(pool))
        picked.extend((question_id, group) for question_id in rng.sample(pool, count))
    return picked


def result_for(points: int) -> ExamResult:
    if points >= PASS_MIN_POINTS:
        return "bestanden"
    if points >= ORAL_MIN_POINTS:
        return "muendliche_nachpruefung"
    return "nicht_bestanden"
