"""What the GDPR admin tools list, show and export about accounts (ADR-0019).

`build_user_export` is the Art. 15/20 DSGVO export: every row stored for the account, with catalog
references resolved to subject and number so the export reads without the database.
"""

from datetime import UTC, datetime

from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.chart_attempt import ChartAttempt
from app.models.exam_attempt import ExamAttempt
from app.models.focus_topic import FocusTopic
from app.models.purchase import Purchase
from app.models.question import Question
from app.models.question_grading_log import QuestionGradingLog
from app.models.question_progress import QuestionProgress
from app.models.question_report import QuestionReport
from app.models.topic import Topic
from app.models.user import User
from app.schemas.admin import (
    AdminChartAttemptExport,
    AdminChartTaskExport,
    AdminExamAttemptExport,
    AdminExamQuestionExport,
    AdminFocusTopicExport,
    AdminGradingEntry,
    AdminPurchaseExport,
    AdminQuestionGradingExport,
    AdminQuestionHistory,
    AdminQuestionHistoryUser,
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


def _from_row[M: BaseModel](model: type[M], row: object, **joined: object) -> M:
    """`model` filled from `row`'s attributes of the same name, plus the `joined` values a
    query brought along. A schema field `row` doesn't have fails loudly (AttributeError) rather
    than silently dropping out of the export."""
    return model.model_validate(
        {name: joined[name] if name in joined else getattr(row, name) for name in model.model_fields}
    )


def admin_user_read(app, db: Session, user: User) -> AdminUserRead:
    return _from_row(
        AdminUserRead,
        user,
        question_progress_count=_question_progress_count(db, user.id),
        is_blocked=blocklist.is_email_blocked(app, db, user.email),
    )


def _exam_attempts(db: Session, user: User) -> list[AdminExamAttemptExport]:
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
    return [
        _from_row(
            AdminExamAttemptExport,
            attempt,
            exam_id=attempt.id,
            questions=[
                _from_row(
                    AdminExamQuestionExport,
                    q,
                    subject=catalog[q.question_id].subject if q.question_id in catalog else None,
                    question_number=catalog[q.question_id].number if q.question_id in catalog else None,
                )
                for q in attempt.questions
            ],
        )
        for attempt in attempts
    ]


def _chart_attempts(db: Session, user: User) -> list[AdminChartAttemptExport]:
    attempts = db.execute(
        select(ChartAttempt).where(ChartAttempt.user_id == user.id).order_by(ChartAttempt.started_at)
    ).scalars()
    return [
        _from_row(
            AdminChartAttemptExport,
            attempt,
            attempt_id=attempt.id,
            tasks=[_from_row(AdminChartTaskExport, task) for task in attempt.tasks],
        )
        for attempt in attempts
    ]


def build_user_export(app, db: Session, user: User) -> AdminUserExport:
    progress_rows = db.execute(
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
    grading_rows = db.execute(
        select(QuestionGradingLog, Question.subject, Question.number)
        .join(Question, Question.id == QuestionGradingLog.question_id)
        .where(QuestionGradingLog.user_id == user.id)
        .order_by(QuestionGradingLog.graded_at, QuestionGradingLog.id)
    ).all()
    purchases = db.execute(
        select(Purchase).where(Purchase.user_id == user.id).order_by(Purchase.created_at)
    ).scalars()

    return AdminUserExport(
        user=admin_user_read(app, db, user),
        exam_attempts=_exam_attempts(db, user),
        chart_attempts=_chart_attempts(db, user),
        focus_topics=[
            _from_row(
                AdminFocusTopicExport,
                focus,
                subject=topic.subject,
                topic_slug=topic.slug,
                topic_name=topic.name,
            )
            for focus, topic in focus_rows
        ],
        question_reports=[
            _from_row(AdminQuestionReportExport, report, subject=subject, question_number=number)
            for report, subject, number in report_rows
        ],
        question_progress=[
            _from_row(AdminQuestionProgressExport, progress, subject=subject, question_number=number)
            for progress, subject, number in progress_rows
        ],
        question_gradings=[
            _from_row(AdminQuestionGradingExport, grading, subject=subject, question_number=number)
            for grading, subject, number in grading_rows
        ],
        purchases=[_from_row(AdminPurchaseExport, purchase) for purchase in purchases],
        exported_at=datetime.now(UTC),
    )


def question_history(db: Session, question_id: int) -> AdminQuestionHistory:
    """Every learner's gradings of one question, with the half-life each produced (ADR-0051).

    Learners ordered by their latest grading, newest first; each learner's gradings oldest first.
    """
    rows = db.execute(
        select(QuestionGradingLog, User.email)
        .join(User, User.id == QuestionGradingLog.user_id)
        .where(QuestionGradingLog.question_id == question_id)
        .order_by(QuestionGradingLog.graded_at, QuestionGradingLog.id)
    ).all()
    by_user: dict[int, AdminQuestionHistoryUser] = {}
    for grading, email in rows:
        learner = by_user.setdefault(
            grading.user_id, AdminQuestionHistoryUser(user_id=grading.user_id, email=email, gradings=[])
        )
        learner.gradings.append(_from_row(AdminGradingEntry, grading))
    users = sorted(by_user.values(), key=lambda learner: learner.gradings[-1].graded_at, reverse=True)
    return AdminQuestionHistory(question_id=question_id, users=users)
