from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.features import chart_exercises_enabled_for
from app.core.jwt import get_current_user
from app.models.chart_attempt import ChartAttempt
from app.models.user import User
from app.schemas.chart_exercise import (
    ChartAnswerUpdate,
    ChartAttemptRead,
    ChartExercise,
    ChartExercisesOverview,
    ChartPointsUpdate,
)
from app.services import chart_exercises as service


def require_chart_exercises(current_user: User = Depends(get_current_user)) -> User:
    """The CHART_EXERCISES flag (ADR-0052): for a learner it doesn't cover, the feature doesn't exist."""
    if not chart_exercises_enabled_for(current_user.email):
        raise HTTPException(status_code=404, detail="Not found")
    return current_user


router = APIRouter(
    prefix="/chart-exercises", tags=["chart-exercises"], dependencies=[Depends(require_chart_exercises)]
)


def _get_exercise(number: int) -> ChartExercise:
    sheet = service.exercise(number)
    if sheet is None:
        raise HTTPException(status_code=404, detail="Chart exercise not found")
    return sheet


def _get_attempt(db: Session, user: User, attempt_id: int) -> tuple[ChartAttempt, ChartExercise]:
    attempt = db.get(ChartAttempt, attempt_id)
    # Someone else's run is reported as missing, not forbidden.
    if attempt is None or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Chart attempt not found")
    return attempt, _get_exercise(attempt.exercise_number)


def _apply(db: Session, action) -> None:
    """Run a service step, mapping its refusals to HTTP (unknown task 404, out of order 409)."""
    try:
        action()
    except LookupError:
        raise HTTPException(status_code=404, detail="Chart task not found") from None
    except service.ChartTaskConflict as conflict:
        raise HTTPException(status_code=409, detail=str(conflict)) from None
    db.commit()


@router.get("", response_model=ChartExercisesOverview)
def list_chart_exercises(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> ChartExercisesOverview:
    return service.overview(db, current_user)


@router.post("/{number}/attempts", response_model=ChartAttemptRead, status_code=201)
def start_chart_attempt(
    number: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> ChartAttemptRead:
    sheet = _get_exercise(number)
    if service.has_open_attempt(db, current_user, number):
        raise HTTPException(status_code=409, detail="This chart exercise is already in progress")
    attempt = ChartAttempt(user_id=current_user.id, exercise_number=number, started_at=service.now())
    db.add(attempt)
    try:
        db.commit()
    except IntegrityError:
        # A parallel start won the race past the check above; the one-open-run index rejected this one.
        db.rollback()
        raise HTTPException(status_code=409, detail="This chart exercise is already in progress") from None
    return service.read_attempt(attempt, sheet)


@router.get("/attempts/{attempt_id}", response_model=ChartAttemptRead)
def get_chart_attempt(
    attempt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> ChartAttemptRead:
    return service.read_attempt(*_get_attempt(db, current_user, attempt_id))


@router.put("/attempts/{attempt_id}/tasks/{task_number}/answer", response_model=ChartAttemptRead)
def answer_chart_task(
    attempt_id: int,
    task_number: int,
    body: ChartAnswerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChartAttemptRead:
    attempt, sheet = _get_attempt(db, current_user, attempt_id)
    _apply(db, lambda: service.answer_task(attempt, sheet, task_number, body.answer_text))
    return service.read_attempt(attempt, sheet)


@router.put("/attempts/{attempt_id}/tasks/{task_number}/points", response_model=ChartAttemptRead)
def award_chart_task_points(
    attempt_id: int,
    task_number: int,
    body: ChartPointsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChartAttemptRead:
    attempt, sheet = _get_attempt(db, current_user, attempt_id)
    _apply(db, lambda: service.award_points(attempt, sheet, task_number, body.points))
    return service.read_attempt(attempt, sheet)


@router.delete("/attempts/{attempt_id}", status_code=204)
def delete_chart_attempt(
    attempt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> None:
    attempt, _ = _get_attempt(db, current_user, attempt_id)
    db.delete(attempt)
    db.commit()
