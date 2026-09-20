from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exam import (
    EXAM_DURATION_MINUTES,
    MAX_POINTS,
    OUTCOME_POINTS,
    POINTS_PER_QUESTION,
    QUESTIONS_PER_GROUP,
    SUBJECT_GROUPS,
    ExamStatus,
    as_utc,
    compose_exam,
    result_for,
)
from app.core.exam_variant import subjects_for_variant
from app.core.jwt import get_current_user
from app.models.exam_attempt import ExamAttempt, ExamAttemptQuestion
from app.models.question import Question
from app.models.user import User
from app.schemas.exam import (
    ExamAnswerUpdate,
    ExamGradeUpdate,
    ExamGroupScore,
    ExamQuestionRead,
    ExamRead,
    ExamStats,
    ExamStatsPoint,
    ExamSummary,
)

router = APIRouter(prefix="/exams", tags=["exams"], dependencies=[Depends(get_current_user)])


def _now() -> datetime:
    return datetime.now(UTC)


def _status(attempt: ExamAttempt) -> ExamStatus:
    if attempt.submitted_at is None:
        return "in_progress"
    return "grading" if attempt.graded_at is None else "completed"


def _expire_if_due(db: Session, attempt: ExamAttempt) -> None:
    """Auto-submits an attempt whose 90 minutes are over (no scheduler needed: checked on access)."""
    if attempt.submitted_at is None and _now() >= as_utc(attempt.deadline_at):
        attempt.submitted_at = attempt.deadline_at
        attempt.timed_out = True
        db.commit()


def _own_attempts(db: Session, user: User) -> list[ExamAttempt]:
    stmt = select(ExamAttempt).where(ExamAttempt.user_id == user.id).order_by(ExamAttempt.started_at.desc())
    attempts = list(db.execute(stmt).scalars())
    for attempt in attempts:
        _expire_if_due(db, attempt)
    return attempts


def _get_attempt(db: Session, user: User, exam_id: int) -> ExamAttempt:
    attempt = db.get(ExamAttempt, exam_id)
    # Someone else's exam is reported as missing, not forbidden.
    if attempt is None or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Exam not found")
    _expire_if_due(db, attempt)
    return attempt


def _get_question(attempt: ExamAttempt, position: int) -> ExamAttemptQuestion:
    for question in attempt.questions:
        if question.position == position:
            return question
    raise HTTPException(status_code=404, detail="Exam question not found")


def _points(question: ExamAttemptQuestion) -> int | None:
    return None if question.outcome is None else OUTCOME_POINTS[question.outcome]


def _total_points(attempt: ExamAttempt) -> int:
    return sum(_points(q) or 0 for q in attempt.questions)


def _group_scores(attempts: list[ExamAttempt]) -> list[ExamGroupScore]:
    earned = dict.fromkeys(SUBJECT_GROUPS, 0)
    possible = dict.fromkeys(SUBJECT_GROUPS, 0)
    for attempt in attempts:
        for question in attempt.questions:
            earned[question.subject_group] += _points(question) or 0
            possible[question.subject_group] += POINTS_PER_QUESTION
    return [ExamGroupScore(subject_group=g, points=earned[g], max_points=possible[g]) for g in SUBJECT_GROUPS]


def _summary_fields(attempt: ExamAttempt) -> dict:
    completed = _status(attempt) == "completed"
    points = _total_points(attempt) if completed else None
    return {
        "id": attempt.id,
        "status": _status(attempt),
        "exam_variant": attempt.exam_variant,
        "started_at": attempt.started_at,
        "submitted_at": attempt.submitted_at,
        "timed_out": attempt.timed_out,
        "answered_count": sum(1 for q in attempt.questions if q.answer_text and q.answer_text.strip()),
        "question_count": len(attempt.questions),
        "points": points,
        "max_points": MAX_POINTS,
        "result": result_for(points) if points is not None else None,
    }


def _read(db: Session, attempt: ExamAttempt) -> ExamRead:
    catalog = {}
    question_ids = [q.question_id for q in attempt.questions if q.question_id is not None]
    if question_ids:
        catalog = {
            q.id: q for q in db.execute(select(Question).where(Question.id.in_(question_ids))).scalars()
        }
    revealed = _status(attempt) != "in_progress"
    questions = []
    for eq in attempt.questions:
        source = catalog.get(eq.question_id) if eq.question_id is not None else None
        questions.append(
            ExamQuestionRead(
                position=eq.position,
                subject_group=eq.subject_group,
                question_id=eq.question_id,
                subject=source.subject if source else None,
                number=source.number if source else None,
                question_text=source.question_text if source else None,
                answer_text=eq.answer_text,
                official_answer=source.answer_text if source and revealed else None,
                outcome=eq.outcome,
                points=_points(eq),
            )
        )
    completed = _status(attempt) == "completed"
    return ExamRead(
        **_summary_fields(attempt),
        deadline_at=attempt.deadline_at,
        server_now=_now(),
        group_scores=_group_scores([attempt]) if completed else None,
        questions=questions,
    )


@router.post("", response_model=ExamRead, status_code=201)
def start_exam(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ExamRead:
    allowed = subjects_for_variant(current_user.exam_variant)
    if allowed is None or current_user.exam_variant is None:
        raise HTTPException(status_code=400, detail="Choose an exam variant in your profile first")
    if any(_status(a) == "in_progress" for a in _own_attempts(db, current_user)):
        raise HTTPException(status_code=409, detail="An exam is already in progress")

    rows = db.execute(select(Question.id, Question.subject).where(Question.subject.in_(allowed))).all()
    picked = compose_exam([(row.id, row.subject) for row in rows], current_user.exam_variant)
    if len(picked) < sum(QUESTIONS_PER_GROUP.values()):
        raise HTTPException(status_code=503, detail="Not enough questions in the catalog")

    now = _now()
    attempt = ExamAttempt(
        user_id=current_user.id,
        exam_variant=current_user.exam_variant,
        started_at=now,
        deadline_at=now + timedelta(minutes=EXAM_DURATION_MINUTES),
        timed_out=False,
        questions=[
            ExamAttemptQuestion(question_id=question_id, subject_group=group, position=index)
            for index, (question_id, group) in enumerate(picked, start=1)
        ],
    )
    db.add(attempt)
    try:
        db.commit()
    except IntegrityError:
        # A parallel start won the race past the check above; the database's
        # one-running-exam-per-learner index rejected this one.
        db.rollback()
        raise HTTPException(status_code=409, detail="An exam is already in progress") from None
    db.refresh(attempt)
    return _read(db, attempt)


@router.get("", response_model=list[ExamSummary])
def list_exams(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return [ExamSummary(**_summary_fields(a)) for a in _own_attempts(db, current_user)]


@router.get("/stats", response_model=ExamStats)
def exam_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ExamStats:
    completed = [a for a in _own_attempts(db, current_user) if _status(a) == "completed"]
    totals = [_total_points(a) for a in completed]
    chronological = sorted(completed, key=lambda a: as_utc(a.started_at))
    return ExamStats(
        completed_count=len(completed),
        passed_count=sum(1 for t in totals if result_for(t) == "bestanden"),
        average_points=round(sum(totals) / len(totals), 1) if totals else None,
        best_points=max(totals) if totals else None,
        max_points=MAX_POINTS,
        recent=[
            ExamStatsPoint(
                exam_id=a.id,
                submitted_at=a.submitted_at,
                points=_total_points(a),
                result=result_for(_total_points(a)),
            )
            for a in chronological[-10:]
        ],
        group_scores=_group_scores(completed),
    )


@router.get("/{exam_id}", response_model=ExamRead)
def get_exam(exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _read(db, _get_attempt(db, current_user, exam_id))


@router.put("/{exam_id}/questions/{position}/answer", status_code=204)
def save_answer(
    exam_id: int,
    position: int,
    body: ExamAnswerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    attempt = _get_attempt(db, current_user, exam_id)
    question = _get_question(attempt, position)
    if _status(attempt) != "in_progress":
        raise HTTPException(status_code=409, detail="The exam is already submitted")
    question.answer_text = body.answer_text
    db.commit()
    return Response(status_code=204)


@router.post("/{exam_id}/submit", response_model=ExamRead)
def submit_exam(exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    attempt = _get_attempt(db, current_user, exam_id)
    if _status(attempt) != "in_progress":
        raise HTTPException(status_code=409, detail="The exam is already submitted")
    attempt.submitted_at = _now()
    db.commit()
    return _read(db, attempt)


@router.put("/{exam_id}/questions/{position}/grade", response_model=ExamRead)
def grade_question(
    exam_id: int,
    position: int,
    body: ExamGradeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attempt = _get_attempt(db, current_user, exam_id)
    question = _get_question(attempt, position)
    status = _status(attempt)
    if status == "in_progress":
        raise HTTPException(status_code=409, detail="Submit the exam before grading it")
    if status == "completed":
        raise HTTPException(status_code=409, detail="The self-assessment is already complete")
    question.outcome = body.outcome
    if all(q.outcome is not None for q in attempt.questions):
        attempt.graded_at = _now()
    db.commit()
    return _read(db, attempt)


@router.delete("/{exam_id}", status_code=204)
def delete_exam(exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    attempt = _get_attempt(db, current_user, exam_id)
    for question in attempt.questions:
        db.delete(question)
    db.delete(attempt)
    db.commit()
    return Response(status_code=204)
