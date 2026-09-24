"""What the GDPR admin tools list, show and export about accounts (ADR-0019).

`build_user_export` is the Art. 15/20 DSGVO export: every row stored for the account, with catalog
references resolved to subject and number so the export reads without the database.
"""

from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.exam_attempt import ExamAttempt
from app.models.focus_topic import FocusTopic
from app.models.purchase import Purchase
from app.models.question import Question
from app.models.question_progress import QuestionProgress
from app.models.question_report import QuestionReport
from app.models.topic import Topic
from app.models.user import User
from app.schemas.admin import (
    AdminExamAttemptExport,
    AdminExamQuestionExport,
    AdminFocusTopicExport,
    AdminPurchaseExport,
    AdminQuestionProgressExport,
    AdminQuestionReportExport,
    AdminUserExport,
    AdminUserRead,
)
from app.services import blocklist


def _question_progress_count(db: Session, user_id: int) -> int:
    return db.execute(
        select(func.count()).select_from(QuestionProgress).where(QuestionProgress.user_id == user_id)
    ).scalar_one()


def list_users(db: Session, q: str, offset: int, limit: int) -> tuple[list[User], int]:
    """One page of accounts, newest first, and how many match in total.

    `q` matches a case-insensitive substring of the email or either name; `%`/`_` in it are
    taken literally. An empty `q` lists everyone.
    """
    stmt = select(User)
    needle = q.strip().lower()
    if needle:
        stmt = stmt.where(
            or_(
                *(
                    func.lower(column).contains(needle, autoescape=True)
                    for column in (User.email, User.first_name, User.last_name)
                )
            )
        )
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    page = db.execute(
        stmt.order_by(User.created_at.desc(), User.id.desc()).offset(offset).limit(limit)
    ).scalars()
    return list(page), total


def admin_user_read(
    app, db: Session, user: User, question_progress_count: int | None = None
) -> AdminUserRead:
    """`question_progress_count` is counted here unless the caller already has it (the export)."""
    if question_progress_count is None:
        question_progress_count = _question_progress_count(db, user.id)
    return AdminUserRead(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
        exam_variant=user.exam_variant,
        first_name=user.first_name,
        last_name=user.last_name,
        gender=user.gender,
        token_balance=user.token_balance,
        ads_removed=user.ads_removed,
        ai_flags_count=user.ai_flags_count,
        ai_flags_last_at=user.ai_flags_last_at,
        agb_accepted_version=user.agb_accepted_version,
        agb_accepted_at=user.agb_accepted_at,
        last_login_at=user.last_login_at,
        question_progress_count=question_progress_count,
        is_blocked=blocklist.is_email_blocked(app, db, user.email),
    )


def build_user_export(app, db: Session, user: User) -> AdminUserExport:
    rows = db.execute(
        select(QuestionProgress, Question.subject, Question.number)
        .join(Question, Question.id == QuestionProgress.question_id)
        .where(QuestionProgress.user_id == user.id)
    ).all()

    focus_rows = db.execute(
        select(FocusTopic, Topic)
        .join(Topic, Topic.id == FocusTopic.topic_id)
        .where(FocusTopic.user_id == user.id)
        .order_by(Topic.subject, Topic.display_order)
    ).all()

    report_rows = db.execute(
        select(QuestionReport, Question.subject, Question.number)
        .join(Question, Question.id == QuestionReport.question_id)
        .where(QuestionReport.user_id == user.id)
        .order_by(QuestionReport.created_at)
    ).all()

    purchase_rows = list(
        db.execute(
            select(Purchase).where(Purchase.user_id == user.id).order_by(Purchase.created_at)
        ).scalars()
    )

    attempts = list(
        db.execute(
            select(ExamAttempt).where(ExamAttempt.user_id == user.id).order_by(ExamAttempt.started_at)
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
        user=admin_user_read(app, db, user, len(rows)),
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
                streak_start_at=progress.streak_start_at,
                review_due_at=progress.review_due_at,
                created_at=progress.created_at,
                updated_at=progress.updated_at,
            )
            for progress, subject, number in rows
        ],
        purchases=[
            AdminPurchaseExport(
                product=purchase.product,
                tokens_granted=purchase.tokens_granted,
                amount_eur_cents=purchase.amount_eur_cents,
                granted_by=purchase.granted_by,
                created_at=purchase.created_at,
            )
            for purchase in purchase_rows
        ],
        exported_at=datetime.now(UTC),
    )
