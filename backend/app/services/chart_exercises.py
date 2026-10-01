"""The Kartenaufgaben (ADR-0052, ADR-0053): the committed exercises and the learners' runs through them.

The exercises transcribed so far are read from app/data/chart_exercises.yaml (task text proposed
by scripts/extract_chart_exercises.py, solutions transcribed and reviewed by hand) — static data
that only changes with a deploy, so it's loaded once per process. A run works through the tasks
strictly in order: answer the current task, see its official solution, give yourself points, next
task.

The routes in app/api/v1/chart_exercises.py own the HTTP side; the rules live here.
"""

import json
from datetime import UTC, datetime
from functools import cache
from pathlib import Path

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.chart_attempt import ChartAttempt, ChartAttemptTask
from app.models.user import User
from app.schemas.chart_exercise import (
    ChartAttemptRead,
    ChartAttemptTaskRead,
    ChartExercise,
    ChartExerciseCatalog,
    ChartExercisesOverview,
    ChartExerciseSummary,
    ChartTask,
)

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "chart_exercises.yaml"
# The committed copy the frontend's guest runs and their prerender read (ADR-0056).
EXPORT_PATH = Path(__file__).resolve().parents[3] / "frontend" / "src" / "data" / "chart_exercises.gen.json"


class ChartTaskConflict(Exception):
    """The request doesn't fit where the run is (a task out of order, twice answered, ...)."""


def now() -> datetime:
    return datetime.now(UTC)


@cache
def catalog() -> ChartExerciseCatalog:
    return ChartExerciseCatalog.model_validate(yaml.safe_load(DATA_PATH.read_text(encoding="utf-8")))


def render_export(data: ChartExerciseCatalog) -> str:
    """The export file's exact text: stable, so a stale file shows up as a diff."""
    return json.dumps(data.model_dump(mode="json"), ensure_ascii=False, indent=1) + "\n"


def exercise(number: int) -> ChartExercise | None:
    return next((sheet for sheet in catalog().sheets if sheet.number == number), None)


def max_points(sheet: ChartExercise) -> int:
    return sum(task.points for task in sheet.tasks)


def points(attempt: ChartAttempt) -> int:
    return sum(task.points_awarded or 0 for task in attempt.tasks)


def current_task(attempt: ChartAttempt, sheet: ChartExercise) -> int | None:
    """The first task without points yet — answered or not; None once every task has points."""
    assessed = {task.task_number for task in attempt.tasks if task.points_awarded is not None}
    return next((task.number for task in sheet.tasks if task.number not in assessed), None)


def _task_read(task: ChartTask, answer: ChartAttemptTask | None) -> ChartAttemptTaskRead:
    return ChartAttemptTaskRead(
        number=task.number,
        max_points=task.points,
        text=task.text,
        questions=task.questions,
        answer_text=answer.answer_text if answer else None,
        solution=task.solution if answer else [],
        derivation=task.derivation if answer else [],
        points_awarded=answer.points_awarded if answer else None,
    )


def read_attempt(attempt: ChartAttempt, sheet: ChartExercise) -> ChartAttemptRead:
    current = current_task(attempt, sheet)
    answers = {task.task_number: task for task in attempt.tasks}
    visible = [task for task in sheet.tasks if current is None or task.number <= current]
    return ChartAttemptRead(
        id=attempt.id,
        exercise_number=attempt.exercise_number,
        started_at=attempt.started_at,
        completed_at=attempt.completed_at,
        task_count=len(sheet.tasks),
        max_points=max_points(sheet),
        points=points(attempt),
        current_task=current,
        tasks=[_task_read(task, answers.get(task.number)) for task in visible],
    )


def _require_current(attempt: ChartAttempt, sheet: ChartExercise, task_number: int) -> ChartTask:
    task = next((task for task in sheet.tasks if task.number == task_number), None)
    if task is None:
        raise LookupError(task_number)
    if current_task(attempt, sheet) != task_number:
        raise ChartTaskConflict("Only the current task can be worked on")
    return task


def answer_task(attempt: ChartAttempt, sheet: ChartExercise, task_number: int, answer_text: str) -> None:
    """Store the answer to the current task — once: the solution is shown right after."""
    _require_current(attempt, sheet, task_number)
    if any(task.task_number == task_number for task in attempt.tasks):
        raise ChartTaskConflict("The task is already answered")
    attempt.tasks.append(
        ChartAttemptTask(task_number=task_number, answer_text=answer_text, answered_at=now())
    )


def award_points(attempt: ChartAttempt, sheet: ChartExercise, task_number: int, awarded: int) -> None:
    """The learner's own points for the answered current task; the last one completes the run."""
    task = _require_current(attempt, sheet, task_number)
    answer = next((row for row in attempt.tasks if row.task_number == task_number), None)
    if answer is None:
        raise ChartTaskConflict("Answer the task first")
    if awarded > task.points:
        raise ChartTaskConflict(f"At most {task.points} points")
    answer.points_awarded = awarded
    if current_task(attempt, sheet) is None:
        attempt.completed_at = now()


def has_open_attempt(db: Session, user: User, number: int) -> bool:
    stmt = select(ChartAttempt.id).where(
        ChartAttempt.user_id == user.id,
        ChartAttempt.exercise_number == number,
        ChartAttempt.completed_at.is_(None),
    )
    return db.execute(stmt).first() is not None


def overview(db: Session, user: User) -> ChartExercisesOverview:
    attempts = list(
        db.execute(
            select(ChartAttempt).where(ChartAttempt.user_id == user.id).order_by(ChartAttempt.started_at)
        ).scalars()
    )
    data = catalog()
    summaries = []
    for sheet in data.sheets:
        own = [attempt for attempt in attempts if attempt.exercise_number == sheet.number]
        completed = [attempt for attempt in own if attempt.completed_at is not None]
        open_attempt = next((attempt for attempt in own if attempt.completed_at is None), None)
        latest = max(completed, key=lambda attempt: attempt.completed_at or attempt.started_at, default=None)
        summaries.append(
            ChartExerciseSummary(
                number=sheet.number,
                task_count=len(sheet.tasks),
                max_points=max_points(sheet),
                open_attempt_id=open_attempt.id if open_attempt else None,
                completed_count=len(completed),
                last_points=points(latest) if latest else None,
            )
        )
    return ChartExercisesOverview(
        source=data.source, hints=data.hints, tide_form=data.tide_form, exercises=summaries
    )
