"""Saved runs through the SBF Navigationsaufgaben See, with an account (ADR-0071).

A guest runs a task in the page and nothing is stored (ADR-0068). With an account the same run goes
through here: the subtasks strictly in order, each answered once, then the official result shows and
the learner gives themselves 0 or 1 point (SpFV Anlage 3 Nr. 1.1); the last point completes the run.
The task's content stays in the committed YAML; the run stores only the learner's own answers,
points and the Lotsen-Check's suggestions.

The routes in app/api/v1/sbf_navigation.py own the HTTP side; the rules live here.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sbf_navigation_attempt import SbfNavigationAttempt, SbfNavigationAttemptSubtask
from app.models.user import User
from app.schemas.sbf_navigation import (
    SbfNavigationAiSuggestion,
    SbfNavigationAttemptRead,
    SbfNavigationOverview,
    SbfNavigationSubtaskRead,
    SbfNavigationTask,
    SbfNavigationTaskSummary,
    SbfSubtask,
)
from app.services import sbf_navigation
from app.services.sbf_navigation_grader import EarlierSubtask, SbfGradeResult, is_ai_checkable


class SbfSubtaskConflict(Exception):
    """The request doesn't fit where the run is (a subtask out of order, twice answered, ...)."""


def now() -> datetime:
    return datetime.now(UTC)


def points(attempt: SbfNavigationAttempt) -> int:
    return sum(row.point or 0 for row in attempt.subtasks)


def current_subtask(attempt: SbfNavigationAttempt, task: SbfNavigationTask) -> int | None:
    """The first subtask without a point yet — answered or not; None once every subtask has one."""
    assessed = {row.subtask_number for row in attempt.subtasks if row.point is not None}
    return next((sub.number for sub in task.subtasks if sub.number not in assessed), None)


def _suggestion(row: SbfNavigationAttemptSubtask) -> SbfNavigationAiSuggestion | None:
    if row.ai_correct is None:
        return None
    return SbfNavigationAiSuggestion(
        correct=row.ai_correct, feedback=row.ai_feedback or "", suspected_error=row.ai_suspected_error or ""
    )


def read_attempt(attempt: SbfNavigationAttempt, task: SbfNavigationTask) -> SbfNavigationAttemptRead:
    subtasks = {sub.number: sub for sub in task.subtasks}
    return SbfNavigationAttemptRead(
        id=attempt.id,
        task_number=attempt.task_number,
        started_at=attempt.started_at,
        completed_at=attempt.completed_at,
        subtask_count=len(task.subtasks),
        points=points(attempt),
        current_subtask=current_subtask(attempt, task),
        subtasks=[
            SbfNavigationSubtaskRead(
                number=row.subtask_number,
                answer_text=row.answer_text,
                point=row.point,
                ai_checkable=is_ai_checkable(subtasks[row.subtask_number]),
                ai_suggestion=_suggestion(row),
            )
            for row in attempt.subtasks
        ],
    )


def _require_current(attempt: SbfNavigationAttempt, task: SbfNavigationTask, number: int) -> SbfSubtask:
    subtask = next((sub for sub in task.subtasks if sub.number == number), None)
    if subtask is None:
        raise LookupError(number)
    if current_subtask(attempt, task) != number:
        raise SbfSubtaskConflict("Only the current subtask can be worked on")
    return subtask


def _answer_row(attempt: SbfNavigationAttempt, number: int) -> SbfNavigationAttemptSubtask | None:
    return next((row for row in attempt.subtasks if row.subtask_number == number), None)


def answer_subtask(
    attempt: SbfNavigationAttempt, task: SbfNavigationTask, number: int, answer_text: str
) -> None:
    """Store the answer to the current subtask — once: the official result is shown right after."""
    _require_current(attempt, task, number)
    if _answer_row(attempt, number) is not None:
        raise SbfSubtaskConflict("The subtask is already answered")
    attempt.subtasks.append(
        SbfNavigationAttemptSubtask(subtask_number=number, answer_text=answer_text, answered_at=now())
    )


def award_point(attempt: SbfNavigationAttempt, task: SbfNavigationTask, number: int, point: int) -> None:
    """The learner's own point for the answered current subtask; the last one completes the run."""
    _require_current(attempt, task, number)
    row = _answer_row(attempt, number)
    if row is None:
        raise SbfSubtaskConflict("Answer the subtask first")
    row.point = point
    if current_subtask(attempt, task) is None:
        attempt.completed_at = now()


def ai_check_target(
    attempt: SbfNavigationAttempt, task: SbfNavigationTask, number: int
) -> tuple[SbfSubtask, SbfNavigationAttemptSubtask]:
    """The answer the Lotsen-Check may look at (ADR-0071): the current subtask's, given but not yet
    assessed, not empty, not a chart entry, and not checked already — the answer can't change, so a
    second check would only cost the learner tokens for the same suggestion."""
    subtask = _require_current(attempt, task, number)
    if not is_ai_checkable(subtask):
        raise SbfSubtaskConflict("The result is an entry in the chart; the Lotsen-Check can't see it")
    row = _answer_row(attempt, number)
    if row is None:
        raise SbfSubtaskConflict("Answer the subtask first")
    if not row.answer_text.strip():
        raise SbfSubtaskConflict("There is no answer to check")
    if row.ai_correct is not None:
        raise SbfSubtaskConflict("The subtask is already checked")
    return subtask, row


def earlier_answers(
    attempt: SbfNavigationAttempt, task: SbfNavigationTask, number: int
) -> list[EarlierSubtask]:
    """The run's subtasks before this one with the learner's answers — for spotting follow-on errors."""
    answers = {row.subtask_number: row.answer_text for row in attempt.subtasks}
    return [
        EarlierSubtask(subtask=sub, answer_text=answers.get(sub.number, ""))
        for sub in task.subtasks
        if sub.number < number
    ]


def store_suggestion(row: SbfNavigationAttemptSubtask, result: SbfGradeResult) -> None:
    row.ai_correct = result.correct
    row.ai_feedback = result.feedback
    row.ai_suspected_error = result.suspected_error


def has_open_attempt(db: Session, user: User, number: int) -> bool:
    stmt = select(SbfNavigationAttempt.id).where(
        SbfNavigationAttempt.user_id == user.id,
        SbfNavigationAttempt.task_number == number,
        SbfNavigationAttempt.completed_at.is_(None),
    )
    return db.execute(stmt).first() is not None


def _summary(task: SbfNavigationTask, own: list[SbfNavigationAttempt]) -> SbfNavigationTaskSummary:
    completed = [attempt for attempt in own if attempt.completed_at is not None]
    open_attempt = next((attempt for attempt in own if attempt.completed_at is None), None)
    latest = max(completed, key=lambda attempt: attempt.completed_at or attempt.started_at, default=None)
    return SbfNavigationTaskSummary(
        number=task.number,
        open_attempt_id=open_attempt.id if open_attempt else None,
        open_answered=len(open_attempt.subtasks) if open_attempt else None,
        completed_count=len(completed),
        last_points=points(latest) if latest else None,
        last_completed_at=latest.completed_at if latest else None,
    )


def overview(db: Session, user: User) -> SbfNavigationOverview:
    attempts = list(
        db.execute(
            select(SbfNavigationAttempt)
            .where(SbfNavigationAttempt.user_id == user.id)
            .order_by(SbfNavigationAttempt.started_at)
        ).scalars()
    )
    data = sbf_navigation.catalog()
    return SbfNavigationOverview(
        pass_points=data.pass_points,
        tasks=[_summary(task, [a for a in attempts if a.task_number == task.number]) for task in data.tasks],
    )
