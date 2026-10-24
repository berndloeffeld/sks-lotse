from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.jwt import get_current_user
from app.core.site import Site, resolve_site
from app.models.sbf_navigation_attempt import SbfNavigationAttempt, SbfNavigationAttemptSubtask
from app.models.user import User
from app.schemas.sbf_navigation import (
    SbfNavigationAiCheckRead,
    SbfNavigationAnswerUpdate,
    SbfNavigationAttemptRead,
    SbfNavigationOverview,
    SbfNavigationPointUpdate,
    SbfNavigationTask,
)
from app.services import lotse_check, sbf_navigation, token_wallet
from app.services import sbf_navigation_runs as service
from app.services.sbf_navigation_grader import grade_sbf_answer


def require_sbf_site(site: Site = Depends(resolve_site)) -> None:
    """The saved runs belong to SBF Lotse (ADR-0071): a request from another origin is refused."""
    if site != "sbf":
        raise HTTPException(status_code=403, detail="Only on SBF Lotse")


router = APIRouter(
    prefix="/sbf-navigation",
    tags=["sbf-navigation"],
    dependencies=[Depends(get_current_user), Depends(require_sbf_site)],
)


def _get_task(number: int) -> SbfNavigationTask:
    task = sbf_navigation.task(number)
    if task is None:
        raise HTTPException(status_code=404, detail="Navigation task not found")
    return task


def _get_attempt(db: Session, user: User, attempt_id: int) -> tuple[SbfNavigationAttempt, SbfNavigationTask]:
    attempt = db.get(SbfNavigationAttempt, attempt_id)
    # Someone else's run is reported as missing, not forbidden.
    if attempt is None or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Navigation attempt not found")
    return attempt, _get_task(attempt.task_number)


def _refusals_as_http(action):
    """Run a service step, mapping its refusals to HTTP (unknown subtask 404, out of order 409)."""
    try:
        return action()
    except LookupError:
        raise HTTPException(status_code=404, detail="Subtask not found") from None
    except service.SbfSubtaskConflict as conflict:
        raise HTTPException(status_code=409, detail=str(conflict)) from None


def _apply(db: Session, action) -> None:
    _refusals_as_http(action)
    db.commit()


def _check_target(user: User, attempt: SbfNavigationAttempt, task: SbfNavigationTask, number: int):
    subtask, row = _refusals_as_http(lambda: service.ai_check_target(attempt, task, number))
    if len(row.answer_text) > settings.grading_max_answer_chars:
        raise HTTPException(status_code=422, detail="The answer is too long for the Lotsen-Check")
    if user.token_balance < token_wallet.TOKENS_PER_SBF_NAVIGATION_CHECK:
        raise HTTPException(status_code=402, detail="Not enough tokens for an answer check")
    return subtask, row


def _caps(subtask_key: str) -> lotse_check.CheckCaps:
    """Once per subtask of a run (a guard against a double click paying twice — the stored suggestion
    refuses a second check anyway), then the hourly cap the other checks use too (ADR-0071)."""
    return lotse_check.CheckCaps(
        bucket="sbf_ai_check:subtask",
        key=subtask_key,
        limit=1,
        window_seconds=lotse_check.DAY_SECONDS,
        detail="This subtask is already being checked",
        log_label="sbf-ai-check",
    )


def _store_and_read(
    db: Session, user: User, attempt: SbfNavigationAttempt, task: SbfNavigationTask, number: int, row, graded
) -> SbfNavigationAttemptRead:
    service.store_suggestion(row, graded.result)
    db.commit()
    lotse_check.record_sanitizer_flag_and_log(
        db,
        user,
        sanitized=graded.sanitized,
        log_label="sbf-ai-check",
        detail=f"subtask={attempt.task_number}/{number} correct={graded.result.correct}",
    )
    return service.read_attempt(attempt, task)


@router.get("", response_model=SbfNavigationOverview)
def list_sbf_navigation(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> SbfNavigationOverview:
    return service.overview(db, current_user)


@router.post("/{number}/attempts", response_model=SbfNavigationAttemptRead, status_code=201)
def start_sbf_navigation_attempt(
    number: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> SbfNavigationAttemptRead:
    task = _get_task(number)
    if service.has_open_attempt(db, current_user, number):
        raise HTTPException(status_code=409, detail="This navigation task is already in progress")
    attempt = SbfNavigationAttempt(user_id=current_user.id, task_number=number, started_at=service.now())
    db.add(attempt)
    try:
        db.commit()
    except IntegrityError:
        # A parallel start won the race past the check above; the one-open-run index rejected this one.
        db.rollback()
        raise HTTPException(status_code=409, detail="This navigation task is already in progress") from None
    return service.read_attempt(attempt, task)


@router.get("/attempts/{attempt_id}", response_model=SbfNavigationAttemptRead)
def get_sbf_navigation_attempt(
    attempt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> SbfNavigationAttemptRead:
    return service.read_attempt(*_get_attempt(db, current_user, attempt_id))


@router.put("/attempts/{attempt_id}/subtasks/{number}/answer", response_model=SbfNavigationAttemptRead)
def answer_sbf_navigation_subtask(
    attempt_id: int,
    number: int,
    body: SbfNavigationAnswerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SbfNavigationAttemptRead:
    attempt, task = _get_attempt(db, current_user, attempt_id)
    _apply(db, lambda: service.answer_subtask(attempt, task, number, body.answer_text))
    return service.read_attempt(attempt, task)


@router.put("/attempts/{attempt_id}/subtasks/{number}/point", response_model=SbfNavigationAttemptRead)
def award_sbf_navigation_point(
    attempt_id: int,
    number: int,
    body: SbfNavigationPointUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SbfNavigationAttemptRead:
    attempt, task = _get_attempt(db, current_user, attempt_id)
    _apply(db, lambda: service.award_point(attempt, task, number, body.point))
    return service.read_attempt(attempt, task)


@router.delete("/attempts/{attempt_id}", status_code=204)
def delete_sbf_navigation_attempt(
    attempt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> None:
    attempt, _ = _get_attempt(db, current_user, attempt_id)
    db.delete(attempt)
    db.commit()


@router.post("/attempts/{attempt_id}/subtasks/{number}/ai-check", response_model=SbfNavigationAiCheckRead)
def ai_check_sbf_navigation_subtask(
    request: Request,
    attempt_id: int,
    number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SbfNavigationAiCheckRead:
    """The Lotsen-Check's suggestion for the stored answer to the current subtask (ADR-0071), stored."""
    attempt, task = _get_attempt(db, current_user, attempt_id)
    subtask, row = _check_target(current_user, attempt, task, number)
    earlier = service.earlier_answers(attempt, task, number)
    answer: SbfNavigationAttemptSubtask = row
    graded, tokens_remaining = lotse_check.run_paid_check(
        request.app,
        db,
        current_user,
        kind="sbf_navigation",
        amount=token_wallet.TOKENS_PER_SBF_NAVIGATION_CHECK,
        caps=_caps(f"{current_user.id}:{attempt.id}:{number}"),
        grade=lambda: grade_sbf_answer(sbf_navigation.catalog(), task, earlier, subtask, answer.answer_text),
        log_label="SBF AI check",
    )
    read = _store_and_read(db, current_user, attempt, task, number, answer, graded)
    return SbfNavigationAiCheckRead(attempt=read, tokens_remaining=tokens_remaining)
