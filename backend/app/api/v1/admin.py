import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import ai_quota as ai_quota_core
from app.core.database import get_db
from app.core.jwt import require_admin
from app.models.question import Question
from app.models.question_report import QuestionReport
from app.models.user import User
from app.schemas.admin import (
    AdminQuestionReportRead,
    AdminSettingsRead,
    AdminSettingsUpdate,
    AdminUserExport,
    AdminUserListItem,
    AdminUserListPage,
    AdminUserRead,
    AdminUserUpdate,
)
from app.schemas.kpis import KpiReport
from app.schemas.question import QuestionRead
from app.services import admin_users
from app.services import ai_quota as ai_quota_service
from app.services import catalog as catalog_service
from app.services.kpis import compute_kpis
from app.services.user import delete_user_and_progress

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

_NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND)

logger = logging.getLogger(__name__)


def _audit(admin: User, action: str, **details: object) -> None:
    # Who did what to whom, for the GDPR record (ADR-0019) — ids and settings only, never the
    # exported data or an address.
    rendered = " ".join(f"{key}={value}" for key, value in details.items())
    logger.info("admin action: admin=%s action=%s %s", admin.id, action, rendered)


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise _NOT_FOUND
    return user


@router.get("/users", response_model=AdminUserListPage)
def list_users(
    q: str = Query(default="", max_length=254),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminUserListPage:
    """Accounts, newest first; `q` searches email and name. The term isn't logged (may be an address)."""
    users, total = admin_users.list_users(db, q, offset, limit)
    _audit(admin, "list_users", offset=offset, results=len(users))
    return AdminUserListPage(items=[AdminUserListItem.model_validate(u) for u in users], total=total)


@router.get("/users/{user_id}", response_model=AdminUserRead)
def get_user(user_id: int, db: Session = Depends(get_db)) -> AdminUserRead:
    user = _get_user_or_404(db, user_id)
    return admin_users.admin_user_read(user, admin_users.question_progress_count(db, user.id))


@router.patch("/users/{user_id}", response_model=AdminUserRead)
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminUserRead:
    """Unlock/revoke the AI check (ADR-0031), remove ads, set the weekly check limit (null = default)."""
    user = _get_user_or_404(db, user_id)
    if payload.ai_grading_enabled is not None:
        user.ai_grading_enabled = payload.ai_grading_enabled
    if payload.ads_removed is not None:
        user.ads_removed = payload.ads_removed
    if "ai_checks_weekly_limit" in payload.model_fields_set:
        user.ai_checks_weekly_limit = payload.ai_checks_weekly_limit
    db.commit()
    _audit(admin, "update_user", target_user=user.id, **payload.model_dump(exclude_unset=True))
    return admin_users.admin_user_read(user, admin_users.question_progress_count(db, user.id))


@router.get("/settings", response_model=AdminSettingsRead)
def get_settings(db: Session = Depends(get_db)) -> AdminSettingsRead:
    return AdminSettingsRead(ai_checks_weekly_default=ai_quota_core.weekly_default(db))


@router.put("/settings", response_model=AdminSettingsRead)
def update_settings(
    payload: AdminSettingsUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> AdminSettingsRead:
    """Set the app-wide default weekly AI-check budget (accounts without their own override follow it)."""
    ai_quota_service.set_weekly_default(db, payload.ai_checks_weekly_default)
    _audit(admin, "update_settings", ai_checks_weekly_default=payload.ai_checks_weekly_default)
    return AdminSettingsRead(ai_checks_weekly_default=payload.ai_checks_weekly_default)


@router.get("/kpis", response_model=KpiReport)
def get_kpis(db: Session = Depends(get_db)):
    return compute_kpis(db, datetime.now(UTC))


@router.get("/questions", response_model=list[QuestionRead])
def search_questions(
    request: Request,
    q: str = Query(default="", max_length=200),
    subject: str | None = Query(default=None, max_length=64),
    db: Session = Depends(get_db),
) -> list[QuestionRead]:
    """Look up question and official answer texts across all subjects, from the cached catalog."""
    return catalog_service.search_catalog(catalog_service.catalog(request, db), q, subject)


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
def export_user(
    user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> AdminUserExport:
    user = _get_user_or_404(db, user_id)
    _audit(admin, "export_user", target_user=user.id)
    return admin_users.build_user_export(db, user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> None:
    user = _get_user_or_404(db, user_id)
    delete_user_and_progress(db, user)
    _audit(admin, "delete_user", target_user=user_id)
