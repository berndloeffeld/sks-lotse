from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.features import chart_exercises_enabled_for
from app.core.jwt import get_current_user
from app.models.chart_attempt import ChartAttempt, ChartAttemptTask
from app.models.user import User
from app.schemas.chart_exercise import (
    ChartAiCheckRead,
    ChartAnswerUpdate,
    ChartAttemptRead,
    ChartExercise,
    ChartExercisesOverview,
    ChartPointsUpdate,
)
from app.services import chart_exercises as service
from app.services import lotse_check, token_wallet
from app.services.chart_grader import grade_chart_answer


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


def _refusals_as_http(action):
    """Run a service step, mapping its refusals to HTTP (unknown task 404, out of order 409)."""
    try:
        return action()
    except LookupError:
        raise HTTPException(status_code=404, detail="Chart task not found") from None
    except service.ChartTaskConflict as conflict:
        raise HTTPException(status_code=409, detail=str(conflict)) from None


def _apply(db: Session, action) -> None:
    _refusals_as_http(action)
    db.commit()


def _check_target(
    user: User, attempt: ChartAttempt, sheet: ChartExercise, task_number: int
) -> ChartAttemptTask:
    answer = _refusals_as_http(lambda: service.ai_check_target(attempt, sheet, task_number))
    if len(answer.answer_text) > settings.grading_max_answer_chars:
        raise HTTPException(status_code=422, detail="The answer is too long for the Lotsen-Check")
    if user.token_balance < token_wallet.TOKENS_PER_CHART_CHECK:
        raise HTTPException(status_code=402, detail="Not enough tokens for an answer check")
    return answer


def _caps(task_key: str) -> lotse_check.CheckCaps:
    """Once per task of a run (a guard against a double click paying twice — the stored suggestion
    refuses a second check anyway), then the hourly cap the catalog check uses too (ADR-0058)."""
    return lotse_check.CheckCaps(
        bucket="chart_ai_check:task",
        key=task_key,
        limit=1,
        window_seconds=lotse_check.DAY_SECONDS,
        detail="This task is already being checked",
        log_label="chart-ai-check",
    )


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


@router.post("/attempts/{attempt_id}/tasks/{task_number}/ai-check", response_model=ChartAiCheckRead)
def ai_check_chart_task(
    request: Request,
    attempt_id: int,
    task_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChartAiCheckRead:
    """The Lotsen-Check's suggestion for the stored answer to the current task (ADR-0058), stored with it."""
    attempt, sheet = _get_attempt(db, current_user, attempt_id)
    answer = _check_target(current_user, attempt, sheet, task_number)
    task = next(task for task in sheet.tasks if task.number == task_number)
    earlier = service.earlier_answers(attempt, sheet, task_number)
    graded, tokens_remaining = lotse_check.run_paid_check(
        request.app,
        db,
        current_user,
        amount=token_wallet.TOKENS_PER_CHART_CHECK,
        caps=_caps(f"{current_user.id}:{attempt.id}:{task_number}"),
        grade=lambda: grade_chart_answer(service.catalog().hints, earlier, task, answer.answer_text),
        log_label="Chart AI check",
    )
    service.store_suggestion(answer, graded.result)
    db.commit()
    lotse_check.record_sanitizer_flag_and_log(
        db,
        current_user,
        sanitized=graded.sanitized,
        log_label="chart-ai-check",
        detail=f"task={attempt.exercise_number}/{task_number} points={graded.result.points}",
    )
    return ChartAiCheckRead(attempt=service.read_attempt(attempt, sheet), tokens_remaining=tokens_remaining)
