from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.jwt import require_admin
from app.models.exam_attempt import ExamAttempt
from app.models.focus_topic import FocusTopic
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.question_report import QuestionReport
from app.models.topic import Topic
from app.models.user import User
from app.schemas.admin import (
    AdminExamAttemptExport,
    AdminExamQuestionExport,
    AdminFocusTopicExport,
    AdminQuestionProgressExport,
    AdminQuestionReportExport,
    AdminQuestionReportRead,
    AdminUserExport,
    AdminUserRead,
    AdminUserSearchRequest,
    AdminUserUpdate,
)
from app.schemas.kpis import KpiReport
from app.services.kpis import compute_kpis
from app.services.user import delete_user_and_progress

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

_NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND)


def _question_progress_count(db: Session, user_id: int) -> int:
    return db.execute(
        select(func.count()).select_from(QuestionProgress).where(QuestionProgress.user_id == user_id)
    ).scalar_one()


def _admin_user_read(user: User, question_progress_count: int) -> AdminUserRead:
    return AdminUserRead(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
        exam_variant=user.exam_variant,
        first_name=user.first_name,
        last_name=user.last_name,
        gender=user.gender,
        ai_grading_enabled=user.ai_grading_enabled,
        ads_removed=user.ads_removed,
        ai_checks_day=user.ai_checks_day,
        ai_checks_used=user.ai_checks_used,
        question_progress_count=question_progress_count,
    )


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise _NOT_FOUND
    return user


@router.post("/users/search", response_model=AdminUserRead)
def search_user(payload: AdminUserSearchRequest, db: Session = Depends(get_db)) -> AdminUserRead:
    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if user is None:
        raise _NOT_FOUND
    return _admin_user_read(user, _question_progress_count(db, user.id))


@router.patch("/users/{user_id}", response_model=AdminUserRead)
def update_user(user_id: int, payload: AdminUserUpdate, db: Session = Depends(get_db)) -> AdminUserRead:
    """Unlock/revoke the AI check (ADR-0031) and/or remove ads for an account — until payment exists."""
    user = _get_user_or_404(db, user_id)
    if payload.ai_grading_enabled is not None:
        user.ai_grading_enabled = payload.ai_grading_enabled
    if payload.ads_removed is not None:
        user.ads_removed = payload.ads_removed
    db.commit()
    return _admin_user_read(user, _question_progress_count(db, user.id))


@router.get("/kpis", response_model=KpiReport)
def get_kpis(db: Session = Depends(get_db)):
    return compute_kpis(db, datetime.now(UTC))


@router.get("/question-reports", response_model=list[AdminQuestionReportRead])
def list_question_reports(db: Session = Depends(get_db)) -> list[AdminQuestionReportRead]:
    """All "Frage melden" notes, newest first (ADR-0030)."""
    rows = db.execute(
        select(QuestionReport, Question.subject, Question.number, User.email)
        .join(Question, Question.id == QuestionReport.question_id)
        .join(User, User.id == QuestionReport.user_id)
        .order_by(QuestionReport.created_at.desc(), QuestionReport.id.desc())
    ).all()
    return [
        AdminQuestionReportRead(
            question_id=report.question_id,
            subject=subject,
            question_number=number,
            category=report.category,
            comment=report.comment,
            created_at=report.created_at,
            user_id=report.user_id,
            user_email=email,
        )
        for report, subject, number, email in rows
    ]


@router.get("/users/{user_id}/export", response_model=AdminUserExport)
def export_user(user_id: int, db: Session = Depends(get_db)) -> AdminUserExport:
    user = _get_user_or_404(db, user_id)

    rows = db.execute(
        select(QuestionProgress, Question.subject, Question.number)
        .join(Question, Question.id == QuestionProgress.question_id)
        .where(QuestionProgress.user_id == user_id)
    ).all()

    focus_rows = db.execute(
        select(FocusTopic, Topic)
        .join(Topic, Topic.id == FocusTopic.topic_id)
        .where(FocusTopic.user_id == user_id)
        .order_by(Topic.subject, Topic.display_order)
    ).all()

    report_rows = db.execute(
        select(QuestionReport, Question.subject, Question.number)
        .join(Question, Question.id == QuestionReport.question_id)
        .where(QuestionReport.user_id == user_id)
        .order_by(QuestionReport.created_at)
    ).all()

    attempts = list(
        db.execute(
            select(ExamAttempt).where(ExamAttempt.user_id == user_id).order_by(ExamAttempt.started_at)
        ).scalars()
    )
    # One catalog lookup for all attempts, not one per attempt.
    question_ids = {q.question_id for a in attempts for q in a.questions if q.question_id is not None}
    catalog = (
        {q.id: q for q in db.execute(select(Question).where(Question.id.in_(question_ids))).scalars()}
        if question_ids
        else {}
    )
    exam_attempts = []
    for attempt in attempts:
        exam_attempts.append(
            AdminExamAttemptExport(
                exam_id=attempt.id,
                exam_variant=attempt.exam_variant,
                started_at=attempt.started_at,
                deadline_at=attempt.deadline_at,
                submitted_at=attempt.submitted_at,
                graded_at=attempt.graded_at,
                timed_out=attempt.timed_out,
                questions=[
                    AdminExamQuestionExport(
                        position=q.position,
                        subject_group=q.subject_group,
                        subject=catalog[q.question_id].subject if q.question_id in catalog else None,
                        question_number=catalog[q.question_id].number if q.question_id in catalog else None,
                        answer_text=q.answer_text,
                        outcome=q.outcome,
                    )
                    for q in attempt.questions
                ],
            )
        )

    return AdminUserExport(
        user=_admin_user_read(user, len(rows)),
        exam_attempts=exam_attempts,
        focus_topics=[
            AdminFocusTopicExport(
                subject=topic.subject,
                topic_slug=topic.slug,
                topic_name=topic.name,
                created_at=focus.created_at,
            )
            for focus, topic in focus_rows
        ],
        question_reports=[
            AdminQuestionReportExport(
                question_id=report.question_id,
                subject=subject,
                question_number=number,
                category=report.category,
                comment=report.comment,
                created_at=report.created_at,
            )
            for report, subject, number in report_rows
        ],
        question_progress=[
            AdminQuestionProgressExport(
                question_id=progress.question_id,
                subject=subject,
                question_number=number,
                half_life_days=progress.half_life_days,
                last_graded_at=progress.last_graded_at,
                last_correct_at=progress.last_correct_at,
                review_due_at=progress.review_due_at,
                created_at=progress.created_at,
                updated_at=progress.updated_at,
            )
            for progress, subject, number in rows
        ],
        exported_at=datetime.now(UTC),
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)) -> None:
    user = _get_user_or_404(db, user_id)
    delete_user_and_progress(db, user)
