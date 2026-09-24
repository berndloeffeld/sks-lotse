from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exam import EXAM_DURATION_MINUTES, QUESTION_COUNT, compose_exam
from app.core.exam_variant import subjects_for_variant
from app.core.jwt import get_current_user
from app.models.exam_attempt import ExamAttempt, ExamAttemptQuestion
from app.models.question import Question
from app.models.user import User
from app.schemas.exam import ExamAnswerUpdate, ExamGradeUpdate, ExamRead, ExamStats, ExamSummary
from app.services import exam as exam_service
from app.services.progress import credit_correct_answers

router = APIRouter(prefix="/exams", tags=["exams"], dependencies=[Depends(get_current_user)])


def _get_attempt(db: Session, user: User, exam_id: int) -> ExamAttempt:
    attempt = db.get(ExamAttempt, exam_id)
    # Someone else's exam is reported as missing, not forbidden.
    if attempt is None or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Exam not found")
    exam_service.expire_if_due(db, attempt)
    return attempt


def _get_question(attempt: ExamAttempt, position: int) -> ExamAttemptQuestion:
    for question in attempt.questions:
        if question.position == position:
            return question
    raise HTTPException(status_code=404, detail="Exam question not found")


def _require_in_progress(attempt: ExamAttempt) -> None:
    if exam_service.status(attempt) != "in_progress":
        raise HTTPException(status_code=409, detail="The exam is already submitted")


@router.post("", response_model=ExamRead, status_code=201)
def start_exam(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ExamRead:
    allowed = subjects_for_variant(current_user.exam_variant)
    if allowed is None:
        raise HTTPException(status_code=400, detail="Choose an exam variant in your profile first")
    if exam_service.running_attempts(db, current_user):
        raise HTTPException(status_code=409, detail="An exam is already in progress")

    rows = db.execute(select(Question.id, Question.subject).where(Question.subject.in_(allowed))).all()
    picked = compose_exam([(row.id, row.subject) for row in rows])
    if len(picked) < QUESTION_COUNT:
        raise HTTPException(status_code=503, detail="Not enough questions in the catalog")

    now = exam_service.now()
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
    return exam_service.read_exam(db, attempt)


@router.get("", response_model=list[ExamSummary])
def list_exams(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return [
        ExamSummary(**exam_service.summary_fields(a)) for a in exam_service.own_attempts(db, current_user)
    ]


@router.get("/stats", response_model=ExamStats)
def exam_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ExamStats:
    return exam_service.stats(db, current_user)


@router.get("/{exam_id}", response_model=ExamRead)
def get_exam(exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return exam_service.read_exam(db, _get_attempt(db, current_user, exam_id))


@router.put("/{exam_id}/questions/{position}/answer", status_code=204)
def save_answer(
    exam_id: int,
    position: int,
    body: ExamAnswerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    attempt = _get_attempt(db, current_user, exam_id)
    question = _get_question(attempt, position)
    _require_in_progress(attempt)
    question.answer_text = body.answer_text
    db.commit()


@router.post("/{exam_id}/submit", response_model=ExamRead)
def submit_exam(exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    attempt = _get_attempt(db, current_user, exam_id)
    _require_in_progress(attempt)
    attempt.submitted_at = exam_service.now()
    db.commit()
    return exam_service.read_exam(db, attempt)


def _credit_correct_answers(db: Session, user: User, attempt: ExamAttempt) -> None:
    """Feed the "Richtig" answers into the Lernstand once the self-assessment is final (ADR-0037).

    Only at that point, so a grade changed while grading is still open counts once, with its final
    value. "Teilweise"/"Falsch" never lower the Lernstand.
    """
    correct = [q.question_id for q in attempt.questions if q.outcome == "richtig" and q.question_id]
    credit_correct_answers(db, user.id, correct, exam_service.now())


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
    status = exam_service.status(attempt)
    if status == "in_progress":
        raise HTTPException(status_code=409, detail="Submit the exam before grading it")
    if status == "completed":
        raise HTTPException(status_code=409, detail="The self-assessment is already complete")
    question.outcome = body.outcome
    finalized = all(q.outcome is not None for q in attempt.questions)
    if finalized:
        attempt.graded_at = exam_service.now()
    db.commit()
    if finalized:
        _credit_correct_answers(db, current_user, attempt)
    return exam_service.read_exam(db, attempt)


@router.delete("/{exam_id}", status_code=204)
def delete_exam(
    exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> None:
    db.delete(_get_attempt(db, current_user, exam_id))
    db.commit()
